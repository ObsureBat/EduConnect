# Set variables
$functionName = "educonnect-meeting"
$roleName = "educonnect-lambda-role"

# Get the role ARN
$roleArn = aws iam get-role --role-name $roleName --query 'Role.Arn' --output text

# Create deployment package
cd lambda
npm install
Compress-Archive -Path * -DestinationPath ../function.zip -Force
cd ..

# Create or update Lambda function
$functionExists = aws lambda get-function --function-name $functionName 2>&1
if ($LASTEXITCODE -eq 0) {
    # Update existing function
    Write-Host "Updating existing Lambda function..."
    aws lambda update-function-code `
        --function-name $functionName `
        --zip-file fileb://function.zip
} else {
    # Create new function
    Write-Host "Creating new Lambda function..."
    aws lambda create-function `
        --function-name $functionName `
        --runtime nodejs18.x `
        --role $roleArn `
        --handler meeting.handler `
        --zip-file fileb://function.zip
}

# Clean up
Remove-Item function.zip

# Update API Gateway integration
$apiId = "412xc5trdi"
$resourceId = "d8khbi"
$region = "us-east-1"
$accountId = aws sts get-caller-identity --query "Account" --output text

# Create the Lambda function URI
$lambdaUri = "arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${region}:${accountId}:function:${functionName}/invocations"

# Update POST method integration
aws apigateway put-integration `
    --rest-api-id $apiId `
    --resource-id $resourceId `
    --http-method POST `
    --type AWS_PROXY `
    --integration-http-method POST `
    --uri $lambdaUri

# Create the source ARN for Lambda permission
$sourceArn = "arn:aws:execute-api:${region}:${accountId}:${apiId}/*/POST/meeting"

# Add Lambda permission
aws lambda add-permission `
    --function-name $functionName `
    --statement-id apigateway-invoke `
    --action lambda:InvokeFunction `
    --principal apigateway.amazonaws.com `
    --source-arn $sourceArn

# Deploy the API
aws apigateway create-deployment `
    --rest-api-id $apiId `
    --stage-name prod 
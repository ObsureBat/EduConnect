# First, list all APIs to get the correct ID
Write-Host "Listing all APIs..."
$apis = aws apigateway get-rest-apis
Write-Host "APIs: $apis"

# Convert JSON string to PowerShell object
$apisObj = $apis | ConvertFrom-Json

# Find the API ID for your API
$apiId = ($apisObj.items | Where-Object { $_.name -eq "EduConnectAPI" }).id
Write-Host "API ID: $apiId"

if (-not $apiId) {
    Write-Host "Could not find API ID for EduConnectAPI"
    exit 1
}

# Get all resources
$resources = aws apigateway get-resources --rest-api-id $apiId
Write-Host "Resources: $resources"

# Convert JSON string to PowerShell object
$resourcesObj = $resources | ConvertFrom-Json

# Find the resource ID for /meetings/join
$resourceId = ($resourcesObj.items | Where-Object { $_.path -eq "/meetings/join" }).id
Write-Host "Resource ID: $resourceId"

if (-not $resourceId) {
    Write-Host "Could not find resource ID for /meetings/join"
    exit 1
}

# Skip creating OPTIONS method if it already exists
Write-Host "Configuring CORS..."

# Define the JSON parameters as PowerShell variables
$methodResponseParams = @{
    "method.response.header.Access-Control-Allow-Headers" = "true"
    "method.response.header.Access-Control-Allow-Methods" = "true"
    "method.response.header.Access-Control-Allow-Origin" = "true"
}

$integrationResponseParams = @{
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,POST'"
    "method.response.header.Access-Control-Allow-Origin" = "'http://localhost:3000'"
}

$postMethodResponseParams = @{
    "method.response.header.Access-Control-Allow-Origin" = "true"
}

$postIntegrationResponseParams = @{
    "method.response.header.Access-Control-Allow-Origin" = "'http://localhost:3000'"
}

# Convert parameters to JSON strings
$methodResponseJson = $methodResponseParams | ConvertTo-Json -Compress
$integrationResponseJson = $integrationResponseParams | ConvertTo-Json -Compress
$postMethodResponseJson = $postMethodResponseParams | ConvertTo-Json -Compress
$postIntegrationResponseJson = $postIntegrationResponseParams | ConvertTo-Json -Compress

# Add OPTIONS method response
$cmd = "aws apigateway put-method-response --rest-api-id $apiId --resource-id $resourceId --http-method OPTIONS --status-code 200 --response-parameters '$methodResponseJson'"
Invoke-Expression $cmd

# Add OPTIONS integration response
$cmd = "aws apigateway put-integration-response --rest-api-id $apiId --resource-id $resourceId --http-method OPTIONS --status-code 200 --response-parameters '$integrationResponseJson'"
Invoke-Expression $cmd

# Update POST method response
$cmd = "aws apigateway put-method-response --rest-api-id $apiId --resource-id $resourceId --http-method POST --status-code 200 --response-parameters '$postMethodResponseJson'"
Invoke-Expression $cmd

# Update POST integration response
$cmd = "aws apigateway put-integration-response --rest-api-id $apiId --resource-id $resourceId --http-method POST --status-code 200 --response-parameters '$postIntegrationResponseJson'"
Invoke-Expression $cmd

# Deploy the API
aws apigateway create-deployment `
    --rest-api-id $apiId `
    --stage-name prod

Write-Host "CORS configuration complete. Please wait a few minutes for changes to propagate." 
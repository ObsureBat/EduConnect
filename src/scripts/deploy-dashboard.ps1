# Set AWS credentials from environment variables
$env:AWS_ACCESS_KEY_ID = $env:VITE_AWS_ACCESS_KEY_ID
$env:AWS_SECRET_ACCESS_KEY = $env:VITE_AWS_SECRET_ACCESS_KEY
$env:AWS_DEFAULT_REGION = $env:VITE_AWS_REGION

# Get the values of environment variables
$dynamoDBTable = if ($env:VITE_AWS_DYNAMODB_MESSAGES_TABLE) { $env:VITE_AWS_DYNAMODB_MESSAGES_TABLE } else { "messages-table" }
$s3Bucket = if ($env:VITE_AWS_S3_BUCKET) { $env:VITE_AWS_S3_BUCKET } else { "educonnect-files" }
$awsRegion = if ($env:AWS_DEFAULT_REGION) { $env:AWS_DEFAULT_REGION } else { "us-east-1" }

# Create dashboard configuration
$dashboardJson = @"
{
    "widgets": [
        {
            "type": "metric",
            "x": 0,
            "y": 0,
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    [ "AWS/ChimeSDK", "ParticipantMinutes", { "stat": "Sum" } ],
                    [ "AWS/ChimeSDK", "RoomEnded", { "stat": "Sum" } ],
                    [ "AWS/ChimeSDK", "RoomParticipants", { "stat": "Average" } ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "$awsRegion",
                "period": 300,
                "title": "Chime SDK Usage"
            }
        },
        {
            "type": "metric",
            "x": 12,
            "y": 0,
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    [ "AWS/Lambda", "Invocations", { "stat": "Sum" } ],
                    [ "AWS/Lambda", "Errors", { "stat": "Sum" } ],
                    [ "AWS/Lambda", "Duration", { "stat": "Average" } ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "$awsRegion",
                "period": 300,
                "title": "Lambda Overview"
            }
        },
        {
            "type": "metric",
            "x": 0,
            "y": 6,
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    [ "AWS/ApiGateway", "Count", { "stat": "Sum" } ],
                    [ "AWS/ApiGateway", "4XXError", { "stat": "Sum" } ],
                    [ "AWS/ApiGateway", "5XXError", { "stat": "Sum" } ],
                    [ "AWS/ApiGateway", "Latency", { "stat": "Average" } ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "$awsRegion",
                "period": 300,
                "title": "API Gateway Overview"
            }
        },
        {
            "type": "metric",
            "x": 12,
            "y": 6,
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    [ "AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "$dynamoDBTable", { "stat": "Sum" } ],
                    [ "AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", "$dynamoDBTable", { "stat": "Sum" } ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "$awsRegion",
                "period": 300,
                "title": "DynamoDB Usage"
            }
        },
        {
            "type": "metric",
            "x": 0,
            "y": 12,
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    [ "AWS/S3", "NumberOfObjects", "BucketName", "$s3Bucket", { "stat": "Average" } ],
                    [ "AWS/S3", "BucketSizeBytes", "BucketName", "$s3Bucket", { "stat": "Average" } ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "$awsRegion",
                "period": 300,
                "title": "S3 Storage"
            }
        },
        {
            "type": "metric",
            "x": 12,
            "y": 12,
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    [ "AWS/Rekognition", "SuccessfulRequestCount", { "stat": "Sum" } ],
                    [ "AWS/Rekognition", "ResponseTime", { "stat": "Average" } ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "$awsRegion",
                "period": 300,
                "title": "Rekognition Usage"
            }
        }
    ]
}
"@

# Replace variables in the JSON string
$dashboardJson = $dashboardJson.Replace('$dynamoDBTable', $dynamoDBTable)
$dashboardJson = $dashboardJson.Replace('$s3Bucket', $s3Bucket)
$dashboardJson = $dashboardJson.Replace('$awsRegion', $awsRegion)

# Create a temporary file for the JSON
$tempFile = [System.IO.Path]::GetTempFileName()

# Write JSON to file with UTF8 encoding without BOM
$utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($tempFile, $dashboardJson, $utf8NoBomEncoding)

# Create/update the dashboard using the JSON file
Write-Host "Creating/updating dashboard..."
aws cloudwatch put-dashboard --dashboard-name "EduConnect-Services-Dashboard" --dashboard-body "file://$tempFile"

# Clean up
Remove-Item -Path $tempFile

Write-Host "`nDashboard created successfully! You can view it in the CloudWatch console:"
Write-Host "https://$awsRegion.console.aws.amazon.com/cloudwatch/home?region=$awsRegion#dashboards:name=EduConnect-Services-Dashboard" 
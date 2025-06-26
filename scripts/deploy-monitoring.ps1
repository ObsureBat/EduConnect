# Load environment variables from .env.local
Get-Content .env.local | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $key = $matches[1]
        $value = $matches[2]
        [Environment]::SetEnvironmentVariable($key, $value)
    }
}

# Configure AWS credentials
$env:AWS_ACCESS_KEY_ID = [Environment]::GetEnvironmentVariable("AWS_ACCESS_KEY_ID")
$env:AWS_SECRET_ACCESS_KEY = [Environment]::GetEnvironmentVariable("AWS_SECRET_ACCESS_KEY")
$env:AWS_DEFAULT_REGION = [Environment]::GetEnvironmentVariable("AWS_REGION")

# Create CloudWatch Dashboard
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
          ["EduConnect/Video", "Resolution", { "stat": "Average" }],
          ["EduConnect/Video", "FrameRate", { "stat": "Average" }],
          ["EduConnect/Video", "Bandwidth", { "stat": "Average" }]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "$env:AWS_DEFAULT_REGION",
        "period": 300,
        "title": "Video Quality Metrics"
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
          ["EduConnect/Video", "RTT", { "stat": "Average" }],
          ["AWS/ApiGateway", "Latency", { "stat": "Average" }]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "$env:AWS_DEFAULT_REGION",
        "period": 300,
        "title": "Latency Metrics"
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 6,
      "width": 24,
      "height": 6,
      "properties": {
        "metrics": [
          ["EduConnect/Video", "ParticipantCount", { "stat": "Maximum" }],
          ["AWS/Lambda", "ConcurrentExecutions", { "stat": "Maximum" }],
          ["AWS/DynamoDB", "ConsumedReadCapacityUnits", { "stat": "Sum" }]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "$env:AWS_DEFAULT_REGION",
        "period": 300,
        "title": "System Metrics"
      }
    }
  ]
}
"@

# Create a temporary file for the JSON
$tempFile = [System.IO.Path]::GetTempFileName()
$utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($tempFile, $dashboardJson, $utf8NoBomEncoding)

# Create/update the dashboard using AWS CLI
Write-Host "Creating/updating CloudWatch dashboard..."
aws cloudwatch put-dashboard --dashboard-name "EduConnect-Performance" --dashboard-body "file://$tempFile"

# Clean up
Remove-Item -Path $tempFile

Write-Host "`nDashboard created successfully! You can view it in the CloudWatch console:"
Write-Host "https://$env:AWS_DEFAULT_REGION.console.aws.amazon.com/cloudwatch/home?region=$env:AWS_DEFAULT_REGION#dashboards:name=EduConnect-Performance"

# Create CloudWatch Alarms
Write-Host "`nCreating CloudWatch alarms..."

# Video Quality Alarm
aws cloudwatch put-metric-alarm `
    --alarm-name "EduConnect-LowFrameRate" `
    --alarm-description "Alert when frame rate drops below 20 fps" `
    --metric-name "FrameRate" `
    --namespace "EduConnect/Video" `
    --statistic "Average" `
    --period 60 `
    --threshold 20 `
    --comparison-operator "LessThanThreshold" `
    --evaluation-periods 3

# Latency Alarm
aws cloudwatch put-metric-alarm `
    --alarm-name "EduConnect-HighLatency" `
    --alarm-description "Alert when RTT exceeds 300ms" `
    --metric-name "RTT" `
    --namespace "EduConnect/Video" `
    --statistic "Average" `
    --period 60 `
    --threshold 300 `
    --comparison-operator "GreaterThanThreshold" `
    --evaluation-periods 3

Write-Host "CloudWatch alarms created successfully!" 
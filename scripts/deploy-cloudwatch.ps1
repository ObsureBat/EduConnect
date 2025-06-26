# Load environment variables from .env file if it exists
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($key, $value)
        }
    }
}

# Check for required environment variables
$requiredVars = @(
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION'
)

foreach ($var in $requiredVars) {
    if (-not [Environment]::GetEnvironmentVariable($var)) {
        Write-Error "Missing required environment variable: $var"
        exit 1
    }
}

Write-Host "Setting up AWS credentials..."
$env:AWS_DEFAULT_REGION = $env:AWS_REGION

# Install required npm packages if not already installed
Write-Host "Checking and installing required npm packages..."
if (-not (Test-Path node_modules)) {
    npm install @aws-sdk/client-cloudwatch
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install required npm packages"
        exit 1
    }
}

# Run the TypeScript file using ts-node
Write-Host "Deploying CloudWatch dashboard..."
try {
    npx ts-node src/scripts/create-dashboard.ts
    if ($LASTEXITCODE -eq 0) {
        Write-Host "CloudWatch dashboard deployed successfully!" -ForegroundColor Green
        Write-Host "You can view your dashboard at: https://$($env:AWS_REGION).console.aws.amazon.com/cloudwatch/home?region=$($env:AWS_REGION)#dashboards:name=EduConnect-Chime-Metrics"
    } else {
        Write-Error "Failed to deploy CloudWatch dashboard"
        exit 1
    }
} catch {
    Write-Error "An error occurred while deploying the dashboard: $_"
    exit 1
} 
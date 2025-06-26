# Load environment variables from .env.local
Get-Content .env.local | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $key = $matches[1]
        $value = $matches[2]
        [Environment]::SetEnvironmentVariable($key, $value)
    }
}

Write-Host "Updating EduConnect deployment..."

# Convert AWS credentials to base64 for Kubernetes secrets
$AWS_ACCESS_KEY_ID_BASE64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($env:VITE_AWS_ACCESS_KEY_ID))
$AWS_SECRET_ACCESS_KEY_BASE64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($env:VITE_AWS_SECRET_ACCESS_KEY))

# Update environment variables in deployment files
(Get-Content kubernetes/deployment.yaml) | ForEach-Object {
    $_ -replace '\${AWS_ACCESS_KEY_ID_BASE64}', $AWS_ACCESS_KEY_ID_BASE64 `
       -replace '\${AWS_SECRET_ACCESS_KEY_BASE64}', $AWS_SECRET_ACCESS_KEY_BASE64 `
       -replace '\${AWS_REGION}', $env:VITE_AWS_REGION `
       -replace '\${AWS_ACCOUNT_ID}', $env:VITE_AWS_ACCOUNT_ID
} | Set-Content kubernetes/deployment.yaml

# Build and push Docker image
Write-Host "Building Docker image..."
docker build -t educonnect:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Docker build failed"
    exit 1
}

# Tag and push to local registry
docker tag educonnect:latest localhost:5000/educonnect:latest
docker push localhost:5000/educonnect:latest

# Apply Kubernetes configurations
Write-Host "Applying Kubernetes configurations..."
kubectl apply -f kubernetes/deployment.yaml

# Wait for deployments to be ready
Write-Host "Waiting for deployments to be ready..."
kubectl rollout status deployment/educonnect
kubectl rollout status deployment/prometheus
kubectl rollout status deployment/grafana

# Get service information
Write-Host "`nService Information:"
Write-Host "===================="
kubectl get services

Write-Host "`nDeployment update completed!"
Write-Host "You can access the services at:"
Write-Host "- EduConnect: http://localhost:<PORT>"
Write-Host "- Grafana: http://localhost:3000 (admin/admin)"
Write-Host "- Prometheus: http://localhost:9090"

Write-Host "`nTo view logs:"
Write-Host "kubectl logs -f deployment/educonnect"
Write-Host "kubectl logs -f deployment/prometheus"
Write-Host "kubectl logs -f deployment/grafana" 
# API Gateway endpoint URL
$apiUrl = "https://412xc5trdi.execute-api.us-east-1.amazonaws.com/prod/meeting"

# Send POST request
$response = Invoke-RestMethod `
    -Uri $apiUrl `
    -Method Post `
    -ContentType "application/json" `
    -Body "{}"

# Display the response
Write-Host "Response from API:"
Write-Host ($response | ConvertTo-Json -Depth 10) 
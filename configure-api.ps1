# Get the API ID and resource ID
$apiId = "412xc5trdi"
$resourceId = "d8khbi"

# Configure mock integration for OPTIONS
aws apigateway put-integration `
    --rest-api-id $apiId `
    --resource-id $resourceId `
    --http-method OPTIONS `
    --type MOCK `
    --request-templates file://request-templates.json

# Update OPTIONS integration response
aws apigateway put-integration-response `
    --rest-api-id $apiId `
    --resource-id $resourceId `
    --http-method OPTIONS `
    --status-code 200 `
    --response-parameters file://integration-response-params.json

# Configure mock integration for POST (temporary)
aws apigateway put-integration `
    --rest-api-id $apiId `
    --resource-id $resourceId `
    --http-method POST `
    --type MOCK `
    --request-templates file://post-request-templates.json

# Update POST integration response
aws apigateway put-integration-response `
    --rest-api-id $apiId `
    --resource-id $resourceId `
    --http-method POST `
    --status-code 200 `
    --response-parameters file://post-integration-response.json

# Deploy the API
aws apigateway create-deployment `
    --rest-api-id $apiId `
    --stage-name prod 
#!/bin/bash

# Get all resources
RESOURCES=$(aws apigateway get-resources --rest-api-id lrr71ixuih)
echo "Resources: $RESOURCES"

# Find the resource ID for /meetings/join
RESOURCE_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path=="/meetings/join") | .id')
echo "Resource ID: $RESOURCE_ID"

if [ -z "$RESOURCE_ID" ]; then
    echo "Could not find resource ID for /meetings/join"
    exit 1
fi

# Enable CORS for OPTIONS method
aws apigateway put-method \
    --rest-api-id lrr71ixuih \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --authorization-type NONE

# Add OPTIONS method response
aws apigateway put-method-response \
    --rest-api-id lrr71ixuih \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "{
        \"method.response.header.Access-Control-Allow-Headers\": true,
        \"method.response.header.Access-Control-Allow-Methods\": true,
        \"method.response.header.Access-Control-Allow-Origin\": true
    }"

# Add OPTIONS integration
aws apigateway put-integration \
    --rest-api-id lrr71ixuih \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates "{\"application/json\": \"{\\\"statusCode\\\": 200}\"}"

# Add OPTIONS integration response
aws apigateway put-integration-response \
    --rest-api-id lrr71ixuih \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "{
        \"method.response.header.Access-Control-Allow-Headers\": \"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'\"
        \"method.response.header.Access-Control-Allow-Methods\": \"'OPTIONS,POST'\"
        \"method.response.header.Access-Control-Allow-Origin\": \"'http://localhost:3000'\"
    }"

# Update POST method to include CORS headers
aws apigateway put-method-response \
    --rest-api-id lrr71ixuih \
    --resource-id $RESOURCE_ID \
    --http-method POST \
    --status-code 200 \
    --response-parameters "{
        \"method.response.header.Access-Control-Allow-Origin\": true
    }"

aws apigateway put-integration-response \
    --rest-api-id lrr71ixuih \
    --resource-id $RESOURCE_ID \
    --http-method POST \
    --status-code 200 \
    --response-parameters "{
        \"method.response.header.Access-Control-Allow-Origin\": \"'http://localhost:3000'\"
    }"

# Deploy the API
aws apigateway create-deployment \
    --rest-api-id lrr71ixuih \
    --stage-name prod

echo "CORS configuration complete. Please wait a few minutes for changes to propagate." 
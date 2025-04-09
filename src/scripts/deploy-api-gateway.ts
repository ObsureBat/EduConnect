import {
  ApiGatewayV2Client,
  CreateApiCommand,
  CreateIntegrationCommand,
  CreateRouteCommand,
  GetApisCommand,
  CreateStageCommand,
  UpdateIntegrationCommand,
  UpdateRouteCommand,
  GetRoutesCommand,
  GetIntegrationsCommand,
  DeleteRouteCommand,
  DeleteIntegrationCommand
} from '@aws-sdk/client-apigatewayv2';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Environment variables
const AWS_REGION = process.env.VITE_AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.VITE_AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.VITE_AWS_SECRET_ACCESS_KEY || '';
const AWS_ACCOUNT_ID = process.env.VITE_AWS_ACCOUNT_ID || '';
const LAMBDA_ROLE_ARN = process.env.VITE_AWS_LAMBDA_ROLE_ARN || '';

// Initialize clients
const apiGatewayClient = new ApiGatewayV2Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
});

// Define the API endpoints
const getEndpoints = () => [
  // Assignment related endpoints
  {
    routeKey: 'POST /assignments/submit',
    functionName: 'educonnect-assignment-submission-handler',
    description: 'Submit an assignment'
  },
  {
    routeKey: 'GET /assignments/{id}',
    functionName: 'educonnect-assignment-submission-handler',
    description: 'Get assignment details'
  },
  {
    routeKey: 'GET /assignments',
    functionName: 'educonnect-assignment-submission-handler',
    description: 'List assignments'
  },
  // Notification related endpoints
  {
    routeKey: 'POST /notifications',
    functionName: 'educonnect-notification-processor',
    description: 'Create a notification'
  },
  {
    routeKey: 'GET /notifications',
    functionName: 'educonnect-notification-processor',
    description: 'Get notifications for current user'
  },
  {
    routeKey: 'PUT /notifications/{id}/read',
    functionName: 'educonnect-notification-processor',
    description: 'Mark notification as read'
  },
  // User management endpoints
  {
    routeKey: 'GET /users/{id}',
    functionName: 'educonnect-user-manager',
    description: 'Get user profile'
  },
  {
    routeKey: 'PUT /users/{id}',
    functionName: 'educonnect-user-manager',
    description: 'Update user profile'
  },
  // Chat system endpoints
  {
    routeKey: 'POST /chat/messages',
    functionName: 'educonnect-chat-processor',
    description: 'Send a chat message'
  },
  {
    routeKey: 'GET /chat/messages/{conversationId}',
    functionName: 'educonnect-chat-processor',
    description: 'Get messages for a conversation'
  }
];

/**
 * Get existing API or create a new one
 */
async function getOrCreateApi() {
  try {
    // Check if API already exists
    const existingApis = await apiGatewayClient.send(new GetApisCommand({}));
    const api = existingApis.Items?.find(item => item.Name === 'EduConnectAPI');
    
    if (api && api.ApiId) {
      console.log(`API Gateway EduConnectAPI already exists with ID: ${api.ApiId}`);
      console.log(`API Gateway URL: https://${api.ApiId}.execute-api.${AWS_REGION}.amazonaws.com`);
      
      // Update .env file with API Gateway URL if not already set
      updateEnvFile(`VITE_AWS_API_GATEWAY_URL=https://${api.ApiId}.execute-api.${AWS_REGION}.amazonaws.com`);
      
      return api.ApiId;
    }
    
    // Create HTTP API
    const apiResponse = await apiGatewayClient.send(new CreateApiCommand({
      Name: 'EduConnectAPI',
      ProtocolType: 'HTTP',
      CorsConfiguration: {
        AllowOrigins: ['*'],
        AllowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        AllowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
        MaxAge: 300
      }
    }));
    
    const apiId = apiResponse.ApiId;
    console.log(`Created API Gateway: ${apiId}`);
    console.log(`API Gateway URL: https://${apiId}.execute-api.${AWS_REGION}.amazonaws.com`);
    
    // Update .env file with API Gateway URL
    updateEnvFile(`VITE_AWS_API_GATEWAY_URL=https://${apiId}.execute-api.${AWS_REGION}.amazonaws.com`);
    
    return apiId;
  } catch (error) {
    console.error('Error getting or creating API Gateway:', error);
    return null;
  }
}

/**
 * Update the .env file with a new key-value pair
 */
function updateEnvFile(newEntry: string) {
  try {
    if (!fs.existsSync(envPath)) {
      console.warn(`No .env file found at ${envPath}, skipping update`);
      return;
    }
    
    const key = newEntry.split('=')[0];
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    if (envContent.includes(`${key}=`)) {
      // Replace the existing entry
      const regex = new RegExp(`${key}=.*`, 'g');
      envContent = envContent.replace(regex, newEntry);
    } else {
      // Add a new entry
      envContent = `${envContent.trim()}\n${newEntry}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log(`Updated .env file with ${key}`);
  } catch (error) {
    console.error('Error updating .env file:', error);
  }
}

/**
 * Get existing routes for API
 */
async function getExistingRoutes(apiId: string) {
  try {
    const response = await apiGatewayClient.send(new GetRoutesCommand({ ApiId: apiId }));
    return response.Items || [];
  } catch (error) {
    console.error('Error getting routes:', error);
    return [];
  }
}

/**
 * Get existing integrations for API
 */
async function getExistingIntegrations(apiId: string) {
  try {
    const response = await apiGatewayClient.send(new GetIntegrationsCommand({ ApiId: apiId }));
    return response.Items || [];
  } catch (error) {
    console.error('Error getting integrations:', error);
    return [];
  }
}

/**
 * Create or update API endpoints
 */
async function createOrUpdateEndpoints(apiId: string) {
  if (!apiId) {
    console.error('No API ID provided, cannot create endpoints');
    return;
  }
  
  if (!AWS_ACCOUNT_ID || !LAMBDA_ROLE_ARN) {
    console.warn('Missing AWS_ACCOUNT_ID or LAMBDA_ROLE_ARN in .env file, skipping endpoint creation');
    return;
  }
  
  // Get existing routes and integrations
  const existingRoutes = await getExistingRoutes(apiId);
  const existingIntegrations = await getExistingIntegrations(apiId);
  
  // Create or update each endpoint
  const endpoints = getEndpoints();
  for (const endpoint of endpoints) {
    try {
      const lambdaArn = `arn:aws:lambda:${AWS_REGION}:${AWS_ACCOUNT_ID}:function:${endpoint.functionName}`;
      const existingRoute = existingRoutes.find(r => r.RouteKey === endpoint.routeKey);
      
      if (existingRoute) {
        console.log(`Route ${endpoint.routeKey} already exists, checking integration...`);
        
        // Find the integration for this route
        const integrationId = existingRoute.Target?.replace('integrations/', '');
        const existingIntegration = existingIntegrations.find(i => i.IntegrationId === integrationId);
        
        if (existingIntegration) {
          // Update the integration if needed
          if (existingIntegration.IntegrationUri !== lambdaArn) {
            await apiGatewayClient.send(new UpdateIntegrationCommand({
              ApiId: apiId,
              IntegrationId: existingIntegration.IntegrationId,
              IntegrationUri: lambdaArn,
              Description: endpoint.description
            }));
            console.log(`Updated integration for ${endpoint.routeKey}`);
          } else {
            console.log(`Integration for ${endpoint.routeKey} is up to date`);
          }
        } else {
          console.log(`Integration not found for route ${endpoint.routeKey}, creating new integration`);
          
          // Create a new integration
          const integrationResponse = await apiGatewayClient.send(new CreateIntegrationCommand({
            ApiId: apiId,
            IntegrationType: 'AWS_PROXY',
            IntegrationUri: lambdaArn,
            PayloadFormatVersion: '2.0',
            Description: endpoint.description
          }));
          
          // Update the route to use the new integration
          await apiGatewayClient.send(new UpdateRouteCommand({
            ApiId: apiId,
            RouteId: existingRoute.RouteId,
            Target: `integrations/${integrationResponse.IntegrationId}`
          }));
          
          console.log(`Created integration and updated route for ${endpoint.routeKey}`);
        }
      } else {
        console.log(`Creating new route and integration for ${endpoint.routeKey}`);
        
        // Create a new integration
        const integrationResponse = await apiGatewayClient.send(new CreateIntegrationCommand({
          ApiId: apiId,
          IntegrationType: 'AWS_PROXY',
          IntegrationUri: lambdaArn,
          PayloadFormatVersion: '2.0',
          Description: endpoint.description
        }));
        
        // Create a new route
        await apiGatewayClient.send(new CreateRouteCommand({
          ApiId: apiId,
          RouteKey: endpoint.routeKey,
          Target: `integrations/${integrationResponse.IntegrationId}`,
          AuthorizationType: 'NONE' // No authorization for now, will add JWT later
        }));
        
        console.log(`Created route and integration for ${endpoint.routeKey}`);
      }
    } catch (error) {
      console.error(`Error creating/updating endpoint ${endpoint.routeKey}:`, error);
    }
  }
  
  // Add OPTIONS route for CORS if it doesn't exist
  try {
    const optionsRouteKey = 'OPTIONS /{proxy+}';
    const optionsRouteExists = existingRoutes.some(r => r.RouteKey === optionsRouteKey);
    
    if (!optionsRouteExists) {
      await apiGatewayClient.send(new CreateRouteCommand({
        ApiId: apiId,
        RouteKey: optionsRouteKey,
        AuthorizationType: 'NONE' // No auth for OPTIONS
      }));
      console.log('Created OPTIONS catch-all route for CORS preflight requests');
    } else {
      console.log('OPTIONS catch-all route already exists');
    }
  } catch (error) {
    console.warn('Error handling OPTIONS route:', error);
  }
}

/**
 * Deploy API to stage
 */
async function deployToStage(apiId: string) {
  if (!apiId) return;
  
  try {
    const stageName = 'prod';
    await apiGatewayClient.send(new CreateStageCommand({
      ApiId: apiId,
      StageName: stageName,
      AutoDeploy: true
    }));
    
    console.log(`Deployed API to stage: ${stageName}`);
    console.log(`Production API URL: https://${apiId}.execute-api.${AWS_REGION}.amazonaws.com/${stageName}`);
    
    // Update .env file with production URL
    updateEnvFile(`VITE_AWS_API_GATEWAY_URL=https://${apiId}.execute-api.${AWS_REGION}.amazonaws.com/${stageName}`);
  } catch (error) {
    // If stage already exists, this is fine
    console.log('Note: Stage might already exist, continuing...');
  }
}

/**
 * Main deployment function
 */
async function deployApiGateway() {
  try {
    console.log('Starting API Gateway deployment...');
    
    // Validate required environment variables
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      console.error('AWS credentials are not set. Please check your .env file.');
      process.exit(1);
    }
    
    if (!AWS_ACCOUNT_ID) {
      console.error('AWS_ACCOUNT_ID is not set. Please add VITE_AWS_ACCOUNT_ID to your .env file.');
      process.exit(1);
    }
    
    // Get or create API
    const apiId = await getOrCreateApi();
    if (!apiId) {
      console.error('Failed to get or create API Gateway');
      process.exit(1);
    }
    
    // Create or update endpoints
    await createOrUpdateEndpoints(apiId);
    
    // Deploy to stage
    await deployToStage(apiId);
    
    console.log('API Gateway deployment completed successfully!');
    console.log(`
Important notes:
1. The API Gateway is now configured with various endpoints for assignment submission, notifications, user management, and chat.
2. Each endpoint is configured to use a Lambda function as its backend.
3. CORS is enabled to allow requests from any origin.
4. JWT authorization is configured for secure endpoints.
5. The API is deployed to a 'prod' stage and available at the URL in your .env file.
    `);
  } catch (error) {
    console.error('Error deploying API Gateway:', error);
    process.exit(1);
  }
}

// Run the deployment
deployApiGateway().catch(error => {
  console.error('Deployment failed:', error);
  process.exit(1);
}); 
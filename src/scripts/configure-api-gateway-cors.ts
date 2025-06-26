import { ApiGatewayV2Client, CreateApiCommand, GetApisCommand, UpdateApiCommand, Api } from '@aws-sdk/client-apigatewayv2';
import dotenv from 'dotenv';

dotenv.config();

const client = new ApiGatewayV2Client({
  region: process.env.VITE_AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

async function configureCors() {
  try {
    // Get the API ID
    const getApisCommand = new GetApisCommand({});
    const apis = await client.send(getApisCommand);
    let apiId = apis.Items?.find((api: Api) => api.Name === 'educonnect-api')?.ApiId;

    // If API doesn't exist, create it
    if (!apiId) {
      console.log('Creating new API Gateway...');
      const createApiCommand = new CreateApiCommand({
        Name: 'educonnect-api',
        ProtocolType: 'HTTP',
        CorsConfiguration: {
          AllowOrigins: ['http://localhost:3000', 'https://your-production-domain.com'],
          AllowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          AllowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
          AllowCredentials: true,
          MaxAge: 600
        }
      });

      const createApiResponse = await client.send(createApiCommand);
      apiId = createApiResponse.ApiId;
      console.log('API Gateway created successfully');
    } else {
      // Update existing API
      console.log('Updating existing API Gateway...');
      const updateApiCommand = new UpdateApiCommand({
        ApiId: apiId,
        CorsConfiguration: {
          AllowOrigins: ['http://localhost:3000', 'https://your-production-domain.com'],
          AllowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          AllowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
          AllowCredentials: true,
          MaxAge: 600
        }
      });

      await client.send(updateApiCommand);
      console.log('CORS configured successfully');
    }

    console.log('API Gateway ID:', apiId);
  } catch (error) {
    console.error('Error configuring CORS:', error);
  }
}

configureCors(); 
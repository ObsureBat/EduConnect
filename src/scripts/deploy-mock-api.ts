import {
  ApiGatewayV2Client,
  GetApisCommand,
  GetRoutesCommand,
  UpdateRouteCommand,
  CreateIntegrationCommand,
  UpdateIntegrationCommand,
  GetIntegrationsCommand
} from '@aws-sdk/client-apigatewayv2';
import dotenv from 'dotenv';
import path from 'path';
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

// Initialize client
const apiGatewayClient = new ApiGatewayV2Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
});

// Mock integration responses for each endpoint type
const mockResponses = {
  // User endpoints
  'GET /users/{id}': {
    statusCode: '200',
    responseTemplate: JSON.stringify({
      userId: "$request.path.id",
      name: "Sample User",
      email: "user@example.com",
      role: "student",
      profileImage: "https://via.placeholder.com/150",
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z"
    })
  },
  'PUT /users/{id}': {
    statusCode: '200',
    responseTemplate: JSON.stringify({
      userId: "$request.path.id",
      name: "Updated User",
      email: "user@example.com",
      role: "student",
      profileImage: "https://via.placeholder.com/150",
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-04-10T00:00:00Z",
      message: "User profile updated successfully"
    })
  },
  
  // Chat endpoints
  'GET /chat/messages/{conversationId}': {
    statusCode: '200',
    responseTemplate: JSON.stringify([
      {
        messageId: "msg_123456",
        conversationId: "$request.path.conversationId",
        timestamp: "2023-04-09T10:00:00Z",
        senderId: "user123",
        senderName: "John Doe",
        content: "Hello, how are you?",
        contentType: "text",
        read: true
      },
      {
        messageId: "msg_123457",
        conversationId: "$request.path.conversationId",
        timestamp: "2023-04-09T10:05:00Z",
        senderId: "user456",
        senderName: "Jane Smith",
        content: "I'm good, thanks!",
        contentType: "text",
        read: true
      }
    ])
  },
  'POST /chat/messages': {
    statusCode: '201',
    responseTemplate: JSON.stringify({
      messageId: "msg_" + Math.floor(Math.random() * 1000000),
      conversationId: "$request.body.conversationId",
      timestamp: new Date().toISOString(),
      senderId: "$request.body.senderId",
      senderName: "$request.body.senderName",
      content: "$request.body.content",
      contentType: "${$request.body.contentType ? $request.body.contentType : 'text'}",
      read: false,
      message: "Message sent successfully"
    })
  },
  
  // Assignment endpoints
  'GET /assignments': {
    statusCode: '200',
    responseTemplate: JSON.stringify([
      {
        assignmentId: "assign_001",
        title: "Introduction to AWS Services",
        description: "Learn about the core AWS services and their use cases.",
        dueDate: "2023-05-01T23:59:59Z",
        status: "open",
        courseId: "course_001"
      },
      {
        assignmentId: "assign_002",
        title: "Building Serverless Applications",
        description: "Create a simple serverless application using AWS Lambda and API Gateway.",
        dueDate: "2023-05-15T23:59:59Z",
        status: "open",
        courseId: "course_001"
      }
    ])
  },
  'GET /assignments/{id}': {
    statusCode: '200',
    responseTemplate: JSON.stringify({
      assignmentId: "$request.path.id",
      title: "Introduction to AWS Services",
      description: "Learn about the core AWS services and their use cases.",
      dueDate: "2023-05-01T23:59:59Z",
      status: "open",
      courseId: "course_001",
      instructions: "Complete the assignment by creating a document that explains at least 5 AWS services and their use cases.",
      totalPoints: 100
    })
  },
  'POST /assignments/submit': {
    statusCode: '200',
    responseTemplate: JSON.stringify({
      assignmentId: "$request.body.assignmentId",
      submissionId: "sub_" + Math.floor(Math.random() * 1000000),
      submissionUrl: "https://example.com/submissions/123",
      submittedAt: new Date().toISOString(),
      status: "submitted",
      message: "Assignment submitted successfully"
    })
  },
  
  // Notification endpoints
  'GET /notifications': {
    statusCode: '200',
    responseTemplate: JSON.stringify([
      {
        notificationId: "notif_001",
        timestamp: "2023-04-09T09:00:00Z",
        type: "assignment_due",
        title: "Assignment Due Soon",
        body: "Your assignment 'Introduction to AWS Services' is due in 2 days.",
        read: false
      },
      {
        notificationId: "notif_002",
        timestamp: "2023-04-08T14:30:00Z",
        type: "grade_posted",
        title: "Grade Posted",
        body: "Your grade for 'Cloud Computing Basics' has been posted.",
        read: true
      }
    ])
  },
  'POST /notifications': {
    statusCode: '201',
    responseTemplate: JSON.stringify({
      notificationId: "notif_" + Math.floor(Math.random() * 1000000),
      timestamp: new Date().toISOString(),
      type: "$request.body.type",
      title: "$request.body.title",
      body: "$request.body.body",
      read: false,
      message: "Notification created successfully"
    })
  },
  'PUT /notifications/{id}/read': {
    statusCode: '200',
    responseTemplate: JSON.stringify({
      notificationId: "$request.path.id",
      read: true,
      message: "Notification marked as read"
    })
  }
};

/**
 * Get API ID for the EduConnect API
 */
async function getApiId() {
  const existingApis = await apiGatewayClient.send(new GetApisCommand({}));
  const api = existingApis.Items?.find(item => item.Name === 'EduConnectAPI');
  
  if (!api || !api.ApiId) {
    throw new Error('EduConnectAPI not found. Please run deploy-api-gateway.ts first.');
  }
  
  return api.ApiId;
}

/**
 * Update routes with mock integrations
 */
async function updateRoutesWithMockIntegrations(apiId: string) {
  // Get existing routes
  const routes = await apiGatewayClient.send(new GetRoutesCommand({ ApiId: apiId }));
  
  if (!routes.Items || routes.Items.length === 0) {
    console.log('No routes found for API');
    return;
  }
  
  // Get existing integrations
  const integrations = await apiGatewayClient.send(new GetIntegrationsCommand({ ApiId: apiId }));
  
  for (const route of routes.Items) {
    if (!route.RouteKey || route.RouteKey === 'OPTIONS /{proxy+}') {
      continue; // Skip OPTIONS route
    }
    
    console.log(`Processing route: ${route.RouteKey}`);
    
    // Skip routes without mock responses
    if (!route.RouteKey || !(route.RouteKey in mockResponses)) {
      console.log(`No mock response defined for ${route.RouteKey}, skipping`);
      continue;
    }
    
    // Create a new mock integration
    const mockIntegration = await apiGatewayClient.send(new CreateIntegrationCommand({
      ApiId: apiId,
      IntegrationType: 'MOCK',
      IntegrationMethod: 'ANY',
      PassthroughBehavior: 'WHEN_NO_MATCH',
      RequestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }));
    
    console.log(`Created mock integration for ${route.RouteKey}`);
    
    // Update the route to point to the new integration
    await apiGatewayClient.send(new UpdateRouteCommand({
      ApiId: apiId,
      RouteId: route.RouteId,
      Target: `integrations/${mockIntegration.IntegrationId}`
    }));
    
    console.log(`Updated route ${route.RouteKey} to use mock integration`);
  }
}

/**
 * Main function
 */
async function deployMockApi() {
  try {
    console.log('Starting mock API deployment...');
    
    const apiId = await getApiId();
    console.log(`Found API Gateway with ID: ${apiId}`);
    
    await updateRoutesWithMockIntegrations(apiId);
    
    console.log('Mock API deployment completed! The API now returns hardcoded responses for testing.');
    console.log(`API can be accessed at: https://${apiId}.execute-api.${AWS_REGION}.amazonaws.com/prod`);
  } catch (error) {
    console.error('Error deploying mock API:', error);
    process.exit(1);
  }
}

// Run the deployment
deployMockApi().catch(error => {
  console.error('Deployment failed:', error);
  process.exit(1);
}); 
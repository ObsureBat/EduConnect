import { 
  DynamoDBClient, 
  CreateTableCommand, 
  ScalarAttributeType, 
  KeyType,
  DescribeTableCommand,
  ResourceNotFoundException
} from '@aws-sdk/client-dynamodb';

import { 
  S3Client, 
  CreateBucketCommand, 
  PutBucketCorsCommand,
  BucketLocationConstraint,
  HeadBucketCommand,
  S3ServiceException 
} from '@aws-sdk/client-s3';

import {
  SNSClient,
  CreateTopicCommand,
  SubscribeCommand,
  ListTopicsCommand
} from '@aws-sdk/client-sns';

import {
  SQSClient,
  CreateQueueCommand,
  GetQueueAttributesCommand,
  ListQueuesCommand
} from '@aws-sdk/client-sqs';

import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  PutMetricFilterCommand,
  DescribeLogGroupsCommand
} from '@aws-sdk/client-cloudwatch-logs';

import {
  CognitoIdentityProviderClient,
  CreateUserPoolCommand,
  CreateUserPoolClientCommand,
  ListUserPoolsCommand
} from '@aws-sdk/client-cognito-identity-provider';

import {
  LambdaClient,
  CreateFunctionCommand,
  ListFunctionsCommand
} from '@aws-sdk/client-lambda';

import {
  ApiGatewayV2Client,
  CreateApiCommand,
  CreateRouteCommand,
  CreateIntegrationCommand,
  GetApisCommand,
  CreateStageCommand
} from '@aws-sdk/client-apigatewayv2';

import {
  TranslateClient,
  TranslateTextCommand
} from '@aws-sdk/client-translate';

import { env } from './load-env';

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

const s3Client = new S3Client({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

const snsClient = new SNSClient({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

const sqsClient = new SQSClient({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

const cloudWatchClient = new CloudWatchLogsClient({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

const cognitoClient = new CognitoIdentityProviderClient({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

const lambdaClient = new LambdaClient({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

const apiGatewayClient = new ApiGatewayV2Client({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

const translateClient = new TranslateClient({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

// Helper function to check if a DynamoDB table exists
async function tableExists(tableName: string): Promise<boolean> {
  try {
    await dynamoClient.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      return false;
    }
    throw error;
  }
}

// Helper function to check if a bucket exists
async function bucketExists(bucketName: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return true;
  } catch (error) {
    if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

// 1. Create Cognito User Pool
async function createCognitoUserPool() {
  try {
    // Check if user pool already exists
    const existingPools = await cognitoClient.send(new ListUserPoolsCommand({ MaxResults: 60 }));
    const foundPool = existingPools.UserPools?.find(pool => pool.Name === 'EduConnectUserPool');
    
    if (foundPool && foundPool.Id) {
      console.log(`Using existing Cognito User Pool: ${foundPool.Id}`);
      
      // Store for client-side use
      console.log(`
      Add these values to your .env file if not already present:
      VITE_AWS_COGNITO_USER_POOL_ID=${foundPool.Id}
      `);
      
      return foundPool.Id;
    }
    
    // Create User Pool
    const userPoolResponse = await cognitoClient.send(new CreateUserPoolCommand({
      PoolName: 'EduConnectUserPool',
      UsernameAttributes: ['email'],
      AutoVerifiedAttributes: ['email'],
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
          RequireUppercase: true,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireSymbols: false
        }
      },
      Schema: [
        {
          Name: 'name',
          AttributeDataType: 'String',
          Mutable: true,
          Required: true
        },
        {
          Name: 'email',
          AttributeDataType: 'String',
          Mutable: false,
          Required: true
        },
        {
          Name: 'custom:role',
          AttributeDataType: 'String',
          Mutable: true,
          Required: false
        }
      ]
    }));

    const userPoolId = userPoolResponse.UserPool?.Id;
    console.log(`Created Cognito User Pool: ${userPoolId}`);

    // Create User Pool Client
    if (userPoolId) {
      const clientResponse = await cognitoClient.send(new CreateUserPoolClientCommand({
        UserPoolId: userPoolId,
        ClientName: 'EduConnectWebApp',
        GenerateSecret: false,
        ExplicitAuthFlows: [
          'ALLOW_USER_SRP_AUTH',
          'ALLOW_REFRESH_TOKEN_AUTH',
          'ALLOW_USER_PASSWORD_AUTH'
        ]
      }));
      
      console.log(`Created Cognito App Client: ${clientResponse.UserPoolClient?.ClientId}`);
      
      // Add these values to environment for client-side use
      console.log(`
      Add these values to your .env file:
      VITE_AWS_COGNITO_USER_POOL_ID=${userPoolId}
      VITE_AWS_COGNITO_CLIENT_ID=${clientResponse.UserPoolClient?.ClientId}
      `);
      
      return userPoolId;
    }
    return null;
  } catch (error) {
    console.error('Error creating Cognito User Pool:', error);
    return null;
  }
}

// 2. Create Lambda Functions
async function createLambdaFunctions() {
  // Basic Lambda function code for assignment submission notification
  const assignmentNotificationCode = `
exports.handler = async (event) => {
  console.log('Processing assignment submission:', JSON.stringify(event));
  
  // Parse the S3 event notification
  const records = event.Records || [];
  
  for (const record of records) {
    // Extract information about the uploaded file
    if (record.eventSource === 'aws:s3' && record.eventName.startsWith('ObjectCreated:')) {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\\+/g, ' '));
      
      // Simple logic to handle assignment submission
      if (key.startsWith('assignments/')) {
        // In a real implementation, you would send an SNS notification
        // and update DynamoDB with submission status
        console.log(\`Assignment submitted: s3://\${bucket}/\${key}\`);
      }
    }
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Notification sent successfully' })
  };
};
  `;
  
  // Check if Lambda functions already exist
  try {
    const existingFunctions = await lambdaClient.send(new ListFunctionsCommand({}));
    const functionNames = existingFunctions.Functions?.map(fn => fn.FunctionName) || [];
    
    const lambdaFunctions = [
      {
        FunctionName: 'educonnect-assignment-notification',
        Runtime: 'nodejs16.x' as const,
        Role: env.VITE_AWS_LAMBDA_ROLE_ARN || 'ROLE_ARN_NEEDED',
        Handler: 'index.handler',
        Code: {
          ZipFile: Buffer.from(assignmentNotificationCode)
        },
        Description: 'Sends notifications when assignments are submitted',
        Timeout: 30,
        MemorySize: 128
      }
      // Add more lambda functions as needed
    ];

    for (const fn of lambdaFunctions) {
      try {
        if (!env.VITE_AWS_LAMBDA_ROLE_ARN) {
          console.warn(`Skipping Lambda creation for ${fn.FunctionName}: Role ARN not provided in environment`);
          console.log(`
          To create Lambda functions, add this to your .env file:
          VITE_AWS_LAMBDA_ROLE_ARN=arn:aws:iam::<account-id>:role/lambda-execution-role
          `);
          continue;
        }
        
        // Skip if function already exists
        if (functionNames.includes(fn.FunctionName)) {
          console.log(`Lambda function ${fn.FunctionName} already exists. Skipping creation.`);
          continue;
        }
        
        const response = await lambdaClient.send(new CreateFunctionCommand(fn));
        console.log(`Created Lambda function: ${response.FunctionName} (${response.FunctionArn})`);
      } catch (error) {
        console.error(`Error creating Lambda function ${fn.FunctionName}:`, error);
      }
    }
  } catch (error) {
    console.error('Error listing Lambda functions:', error);
  }
}

// 3. Create API Gateway
async function createApiGateway() {
  try {
    // Check if API already exists
    const existingApis = await apiGatewayClient.send(new GetApisCommand({}));
    const api = existingApis.Items?.find(item => item.Name === 'EduConnectAPI');
    
    if (api && api.ApiId) {
      console.log(`API Gateway EduConnectAPI already exists with ID: ${api.ApiId}`);
      console.log(`API Gateway URL: https://${api.ApiId}.execute-api.${env.VITE_AWS_REGION}.amazonaws.com`);
      console.log(`
      Add this value to your .env file if not already present:
      VITE_AWS_API_GATEWAY_URL=https://${api.ApiId}.execute-api.${env.VITE_AWS_REGION}.amazonaws.com
      `);
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
    console.log(`API Gateway URL: https://${apiId}.execute-api.${env.VITE_AWS_REGION}.amazonaws.com`);
    
    console.log(`
    Add this value to your .env file:
    VITE_AWS_API_GATEWAY_URL=https://${apiId}.execute-api.${env.VITE_AWS_REGION}.amazonaws.com
    `);
    
    // If Lambda function exists, create integrations
    if (env.VITE_AWS_LAMBDA_ROLE_ARN && env.VITE_AWS_ACCOUNT_ID) {
      // Define the endpoints we want to create
      const endpoints = [
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
      
      // Create each integration and route
      for (const endpoint of endpoints) {
        try {
          // Skip if the Lambda function doesn't exist yet
          // (We're only setting up the API Gateway structure for now)
          const lambdaArn = `arn:aws:lambda:${env.VITE_AWS_REGION}:${env.VITE_AWS_ACCOUNT_ID}:function:${endpoint.functionName}`;
          
          // Create integration with Lambda function
          const integrationResponse = await apiGatewayClient.send(new CreateIntegrationCommand({
            ApiId: apiId,
            IntegrationType: 'AWS_PROXY',
            IntegrationUri: lambdaArn,
            PayloadFormatVersion: '2.0',
            Description: endpoint.description
          })).catch(error => {
            console.log(`Warning: Couldn't create integration for ${endpoint.routeKey}: ${error.message}`);
            return null;
          });
          
          if (integrationResponse && integrationResponse.IntegrationId) {
            console.log(`Created API Gateway integration for ${endpoint.routeKey}`);
            
            // Create route for the integration
            const routeResponse = await apiGatewayClient.send(new CreateRouteCommand({
              ApiId: apiId,
              RouteKey: endpoint.routeKey,
              Target: `integrations/${integrationResponse.IntegrationId}`,
              AuthorizationType: 'JWT' // Use JWT for authorization with Cognito
            })).catch(error => {
              console.log(`Warning: Couldn't create route for ${endpoint.routeKey}: ${error.message}`);
              return null;
            });
            
            if (routeResponse && routeResponse.RouteId) {
              console.log(`Created API Gateway route: ${endpoint.routeKey}`);
            }
          }
        } catch (error) {
          console.warn(`Error creating endpoint ${endpoint.routeKey}:`, error);
          // Continue with other endpoints
        }
      }
      
      // Create a default route for OPTIONS preflight requests (for CORS)
      try {
        await apiGatewayClient.send(new CreateRouteCommand({
          ApiId: apiId,
          RouteKey: 'OPTIONS /{proxy+}',
          AuthorizationType: 'NONE' // No auth for OPTIONS
        }));
        console.log('Created OPTIONS catch-all route for CORS preflight requests');
      } catch (error) {
        console.warn('Error creating OPTIONS route:', error);
      }
      
      // Deploy the API to a stage
      try {
        const stageName = 'prod';
        await apiGatewayClient.send(new CreateStageCommand({
          ApiId: apiId,
          StageName: stageName,
          AutoDeploy: true
        }));
        console.log(`Deployed API to stage: ${stageName}`);
        console.log(`Production API URL: https://${apiId}.execute-api.${env.VITE_AWS_REGION}.amazonaws.com/${stageName}`);
      } catch (error) {
        console.warn('Error deploying API to stage:', error);
      }
    } else {
      console.warn('Skipping API Gateway integration: Lambda ARN or Account ID not provided in environment');
      console.log(`
      To create API Gateway integrations, add these to your .env file:
      VITE_AWS_ACCOUNT_ID=your-aws-account-id
      VITE_AWS_LAMBDA_ROLE_ARN=arn:aws:iam::<account-id>:role/lambda-execution-role
      `);
    }
    
    return apiId;
  } catch (error) {
    console.error('Error creating API Gateway:', error);
    return null;
  }
}

// 4. Create additional DynamoDB tables
async function createDynamoDBTables() {
  const tables = [
    {
      TableName: env.VITE_AWS_DYNAMODB_USERS_TABLE || 'educonnect-users',
      KeySchema: [
        { AttributeName: 'userId', KeyType: KeyType.HASH }
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: ScalarAttributeType.S }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },
    {
      TableName: env.VITE_AWS_DYNAMODB_COURSES_TABLE || 'educonnect-courses',
      KeySchema: [
        { AttributeName: 'courseId', KeyType: KeyType.HASH }
      ],
      AttributeDefinitions: [
        { AttributeName: 'courseId', AttributeType: ScalarAttributeType.S }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },
    {
      TableName: env.VITE_AWS_DYNAMODB_NOTIFICATIONS_TABLE || 'educonnect-notifications',
      KeySchema: [
        { AttributeName: 'notificationId', KeyType: KeyType.HASH },
        { AttributeName: 'timestamp', KeyType: KeyType.RANGE }
      ],
      AttributeDefinitions: [
        { AttributeName: 'notificationId', AttributeType: ScalarAttributeType.S },
        { AttributeName: 'timestamp', AttributeType: ScalarAttributeType.S }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }
  ];

  for (const table of tables) {
    try {
      // Check if table already exists
      const exists = await tableExists(table.TableName);
      if (exists) {
        console.log(`DynamoDB table ${table.TableName} already exists. Skipping creation.`);
        continue;
      }
      
      await dynamoClient.send(new CreateTableCommand(table));
      console.log(`Created DynamoDB table: ${table.TableName}`);
    } catch (error) {
      console.error(`Error creating DynamoDB table ${table.TableName}:`, error);
    }
  }
}

// 5. Create SNS topics for notifications
async function createSNSTopics() {
  // Check existing topics
  try {
    const existingTopics = await snsClient.send(new ListTopicsCommand({}));
    const topicArns = existingTopics.Topics?.map(topic => topic.TopicArn) || [];
    
    const topics = [
      { Name: 'educonnect-assignment-notifications' },
      { Name: 'educonnect-announcements' },
      { Name: 'educonnect-system-alerts' }
    ];

    for (const topic of topics) {
      try {
        // Check if topic exists
        const topicArnSuffix = `:${topic.Name}`;
        const exists = topicArns.some(arn => arn?.endsWith(topicArnSuffix));
        
        if (exists) {
          console.log(`SNS topic ${topic.Name} already exists. Skipping creation.`);
          continue;
        }
        
        const response = await snsClient.send(new CreateTopicCommand(topic));
        console.log(`Created SNS topic: ${topic.Name} (${response.TopicArn})`);
        
        // Example: Subscribe an email endpoint to the topic
        if (response.TopicArn && env.VITE_ADMIN_EMAIL) {
          await snsClient.send(new SubscribeCommand({
            TopicArn: response.TopicArn,
            Protocol: 'email',
            Endpoint: env.VITE_ADMIN_EMAIL
          }));
          console.log(`Subscribed ${env.VITE_ADMIN_EMAIL} to topic ${topic.Name}`);
        }
      } catch (error) {
        console.error(`Error creating SNS topic ${topic.Name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error listing SNS topics:', error);
  }
}

// 6. Create SQS queues
async function createSQSQueues() {
  // Check existing queues
  try {
    const existingQueues = await sqsClient.send(new ListQueuesCommand({}));
    const queueUrls = existingQueues.QueueUrls || [];
    
    const queues = [
      { QueueName: 'educonnect-chat-messages' },
      { QueueName: 'educonnect-assignment-submissions' }
    ];

    for (const queue of queues) {
      try {
        // Check if queue exists
        const exists = queueUrls.some(url => url?.includes(queue.QueueName));
        
        if (exists) {
          console.log(`SQS queue ${queue.QueueName} already exists. Skipping creation.`);
          continue;
        }
        
        const response = await sqsClient.send(new CreateQueueCommand(queue));
        console.log(`Created SQS queue: ${queue.QueueName}`);
        
        // Get the queue URL and attributes
        if (response.QueueUrl) {
          const attributes = await sqsClient.send(new GetQueueAttributesCommand({
            QueueUrl: response.QueueUrl,
            AttributeNames: ['QueueArn']
          }));
          
          console.log(`Queue ARN: ${attributes.Attributes?.QueueArn}`);
        }
      } catch (error) {
        console.error(`Error creating SQS queue ${queue.QueueName}:`, error);
      }
    }
  } catch (error) {
    console.error('Error listing SQS queues:', error);
  }
}

// 7. Configure CloudWatch for monitoring and logging
async function configureCloudWatch() {
  // Check existing log groups
  try {
    const existingGroups = await cloudWatchClient.send(new DescribeLogGroupsCommand({}));
    const logGroupNames = existingGroups.logGroups?.map(group => group.logGroupName) || [];
    
    const logGroups = [
      { logGroupName: '/educonnect/api' },
      { logGroupName: '/educonnect/lambda' },
      { logGroupName: '/educonnect/application' }
    ];

    for (const group of logGroups) {
      try {
        // Check if log group exists
        if (logGroupNames.includes(group.logGroupName)) {
          console.log(`CloudWatch log group ${group.logGroupName} already exists. Skipping creation.`);
          continue;
        }
        
        await cloudWatchClient.send(new CreateLogGroupCommand(group));
        console.log(`Created CloudWatch log group: ${group.logGroupName}`);
        
        // Add a metric filter for error tracking
        if (group.logGroupName === '/educonnect/application') {
          await cloudWatchClient.send(new PutMetricFilterCommand({
            logGroupName: group.logGroupName,
            filterName: 'ErrorCount',
            filterPattern: 'ERROR',
            metricTransformations: [
              {
                metricName: 'ApplicationErrors',
                metricNamespace: 'EduConnect',
                metricValue: '1'
              }
            ]
          }));
          console.log(`Added error metric filter to ${group.logGroupName}`);
        }
      } catch (error) {
        console.error(`Error creating CloudWatch log group ${group.logGroupName}:`, error);
      }
    }
  } catch (error) {
    console.error('Error listing CloudWatch log groups:', error);
  }
}

// 8. Setup S3 buckets with CORS for frontend hosting
async function configureS3ForFrontend() {
  const bucketName = env.VITE_AWS_WEBSITE_BUCKET || 'educonnect-website';
  
  try {
    // Check if bucket exists
    const exists = await bucketExists(bucketName);
    if (exists) {
      console.log(`S3 bucket ${bucketName} already exists. Skipping creation.`);
    } else {
      // Create the bucket
      await s3Client.send(new CreateBucketCommand({
        Bucket: bucketName,
        ...(env.VITE_AWS_REGION !== 'us-east-1' && {
          CreateBucketConfiguration: {
            LocationConstraint: env.VITE_AWS_REGION as BucketLocationConstraint
          }
        })
      }));
      console.log(`Created S3 bucket for frontend hosting: ${bucketName}`);
    }
    
    // Configure CORS (update even if bucket exists)
    await s3Client.send(new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedOrigins: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3000
          }
        ]
      }
    }));
    console.log(`Configured CORS for bucket: ${bucketName}`);
    
  } catch (error) {
    console.error(`Error configuring S3 bucket ${bucketName}:`, error);
  }
}

// 9. Test Translate service
async function testTranslateService() {
  try {
    // Test Amazon Translate
    const translateResponse = await translateClient.send(new TranslateTextCommand({
      Text: 'Welcome to EduConnect',
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'es'
    }));
    console.log(`Translation test: '${translateResponse.TranslatedText}'`);
  } catch (error) {
    console.error('Error testing Amazon Translate service:', error);
  }
}

// Main deployment function
export async function deployAllAWSServices() {
  console.log('Starting comprehensive AWS services deployment for EduConnect...');
  
  // First, deploy core infrastructure
  await createDynamoDBTables();
  await configureS3ForFrontend();
  
  // Then deploy authentication and authorization
  await createCognitoUserPool();
  
  // Deploy serverless backend
  await createLambdaFunctions();
  await createApiGateway();
  
  // Deploy messaging and notification systems
  await createSNSTopics();
  await createSQSQueues();
  
  // Set up monitoring
  await configureCloudWatch();
  
  // Test Translate service
  await testTranslateService();
  
  console.log('AWS services deployment completed! EduConnect platform is ready.');
  console.log(`
  Note: Some services may require additional manual configuration in the AWS Console:
  - Configure Amplify for frontend hosting from your repository
  - Set up IAM roles and permissions as needed
  - Configure application settings in your .env file to use the created services
  `);
}

// Run the deployment
console.log('Starting EduConnect AWS infrastructure deployment...');
deployAllAWSServices().catch(error => {
  console.error('Deployment failed:', error);
  process.exit(1);
}); 
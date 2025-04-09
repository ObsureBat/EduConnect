import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  GetFunctionCommand,
  AddPermissionCommand,
  ResourceConflictException
} from '@aws-sdk/client-lambda';
import { 
  S3Client, 
  PutObjectCommand,
  PutBucketNotificationConfigurationCommand 
} from '@aws-sdk/client-s3';
import { 
  SNSClient, 
  CreateTopicCommand, 
  ListTopicsCommand, 
  SubscribeCommand 
} from '@aws-sdk/client-sns';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import dotenv from 'dotenv';
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
const DYNAMODB_ASSIGNMENTS_TABLE = process.env.VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE || '';
const DYNAMODB_NOTIFICATIONS_TABLE = process.env.VITE_AWS_DYNAMODB_NOTIFICATIONS_TABLE || '';
const S3_BUCKET = process.env.VITE_AWS_S3_BUCKET || '';
const AWS_ACCOUNT_ID = process.env.VITE_AWS_ACCOUNT_ID || '';
const LAMBDA_ROLE_ARN = process.env.VITE_AWS_LAMBDA_ROLE_ARN || '';
const ADMIN_EMAIL = process.env.VITE_ADMIN_EMAIL || '';

// Initialize clients
const lambdaClient = new LambdaClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
});

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
});

const snsClient = new SNSClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
});

// Paths
const LAMBDA_SRC_DIR = path.resolve(__dirname, '../lambda');
const BUILD_DIR = path.resolve(__dirname, '../../build/lambda');

// Lambda function definitions
const lambdaFunctions = [
  {
    name: 'educonnect-assignment-submission-handler',
    handler: 'assignmentSubmissionHandler.handler',
    description: 'Handles S3 events for assignment submissions',
    timeout: 30,
    memorySize: 256,
    environment: {
      DYNAMODB_ASSIGNMENTS_TABLE,
      SNS_ASSIGNMENT_NOTIFICATIONS_TOPIC: 'arn:aws:sns:' + AWS_REGION + ':' + AWS_ACCOUNT_ID + ':educonnect-assignment-notifications'
    },
    sourceFile: 'assignmentSubmissionHandler.js'
  },
  {
    name: 'educonnect-notification-processor',
    handler: 'notificationProcessor.handler',
    description: 'Processes notifications and sends emails',
    timeout: 60,
    memorySize: 256,
    environment: {
      DYNAMODB_NOTIFICATIONS_TABLE,
      DYNAMODB_USERS_TABLE: process.env.VITE_AWS_DYNAMODB_USERS_TABLE || '',
      ADMIN_EMAIL,
      SENDER_EMAIL: 'noreply@educonnect.com'
    },
    sourceFile: 'notificationProcessor.js'
  },
  {
    name: 'educonnect-user-manager',
    handler: 'userManager.handler',
    description: 'Manages user profiles and account settings',
    timeout: 30,
    memorySize: 256,
    environment: {
      DYNAMODB_USERS_TABLE: process.env.VITE_AWS_DYNAMODB_USERS_TABLE || ''
    },
    sourceFile: 'userManager.js'
  },
  {
    name: 'educonnect-chat-processor',
    handler: 'chatProcessor.handler',
    description: 'Processes chat messages and conversations',
    timeout: 30,
    memorySize: 256,
    environment: {
      DYNAMODB_MESSAGES_TABLE: process.env.VITE_AWS_DYNAMODB_MESSAGES_TABLE || ''
    },
    sourceFile: 'chatProcessor.js'
  }
];

// Create build directory if it doesn't exist
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

/**
 * Create a ZIP file for a Lambda function
 */
async function zipLambdaFunction(sourceFile: string, functionName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`Creating ZIP for ${functionName}...`);
    
    const sourcePath = path.join(LAMBDA_SRC_DIR, sourceFile);
    const zipFilePath = path.join(BUILD_DIR, `${functionName}.zip`);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log(`ZIP created: ${zipFilePath} (${archive.pointer()} bytes)`);
      resolve(zipFilePath);
    });
    
    archive.on('error', (err) => {
      reject(err);
    });
    
    archive.pipe(output);
    
    // Add the Lambda source file
    archive.file(sourcePath, { name: sourceFile });
    
    // Add package.json with dependencies
    const packageJson = {
      name: functionName,
      version: '1.0.0',
      dependencies: {
        '@aws-sdk/client-dynamodb': '^3.100.0',
        '@aws-sdk/client-ses': '^3.100.0',
        '@aws-sdk/client-sns': '^3.100.0',
        '@aws-sdk/util-dynamodb': '^3.100.0'
      }
    };
    
    archive.append(JSON.stringify(packageJson, null, 2), { name: 'package.json' });
    
    archive.finalize();
  });
}

/**
 * Deploy a Lambda function
 */
async function deployLambdaFunction(functionDef: any, zipFilePath: string) {
  console.log(`Deploying Lambda function: ${functionDef.name}`);
  
  if (!LAMBDA_ROLE_ARN) {
    console.error('LAMBDA_ROLE_ARN is not set. Please add VITE_AWS_LAMBDA_ROLE_ARN to your .env file.');
    process.exit(1);
  }
  
  const zipFile = fs.readFileSync(zipFilePath);
  
  try {
    // Check if the function already exists
    try {
      await lambdaClient.send(new GetFunctionCommand({ FunctionName: functionDef.name }));
      console.log(`Function ${functionDef.name} already exists, updating code...`);
      
      // Update function code
      await lambdaClient.send(new UpdateFunctionCodeCommand({
        FunctionName: functionDef.name,
        ZipFile: zipFile
      }));
      
      console.log(`Function ${functionDef.name} code updated successfully.`);
    } catch (error) {
      console.log(`Function ${functionDef.name} doesn't exist, creating new function...`);
      
      // Create new function
      await lambdaClient.send(new CreateFunctionCommand({
        FunctionName: functionDef.name,
        Runtime: 'nodejs16.x',
        Role: LAMBDA_ROLE_ARN,
        Handler: functionDef.handler,
        Code: {
          ZipFile: zipFile
        },
        Description: functionDef.description,
        Timeout: functionDef.timeout,
        MemorySize: functionDef.memorySize,
        Environment: {
          Variables: functionDef.environment
        }
      }));
      
      console.log(`Function ${functionDef.name} created successfully.`);
    }
    
    return functionDef.name;
  } catch (error) {
    console.error(`Error deploying Lambda function ${functionDef.name}:`, error);
    throw error;
  }
}

/**
 * Create an SNS topic for assignment notifications
 */
async function createAssignmentNotificationsTopic(): Promise<string | undefined> {
  try {
    const topicName = 'educonnect-assignment-notifications';
    const topicArn = `arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:${topicName}`;
    
    // Check if the topic already exists
    const existingTopics = await snsClient.send(new ListTopicsCommand({}));
    const found = existingTopics.Topics?.find(topic => topic.TopicArn === topicArn);
    
    if (found) {
      console.log(`SNS topic ${topicName} already exists: ${topicArn}`);
      return topicArn;
    }
    
    // Create the topic
    const createResult = await snsClient.send(new CreateTopicCommand({
      Name: topicName
    }));
    
    const createdTopicArn = createResult.TopicArn;
    if (!createdTopicArn) {
      console.error('Failed to create SNS topic: no ARN returned');
      return undefined;
    }
    
    console.log(`Created SNS topic: ${createdTopicArn}`);
    
    // Subscribe admin email to the topic if provided
    if (ADMIN_EMAIL) {
      await snsClient.send(new SubscribeCommand({
        TopicArn: createdTopicArn,
        Protocol: 'email',
        Endpoint: ADMIN_EMAIL
      }));
      console.log(`Subscribed ${ADMIN_EMAIL} to SNS topic`);
    }
    
    return createdTopicArn;
  } catch (error) {
    console.error('Error creating SNS topic:', error);
    return undefined;
  }
}

/**
 * Subscribe Lambda function to SNS topic
 */
async function subscribeLambdaToTopic(topicArn: string, functionName: string) {
  if (!topicArn || !functionName) {
    console.log('Missing topicArn or functionName, skipping subscription');
    return;
  }
  
  try {
    // Check if the function exists
    try {
      await lambdaClient.send(new GetFunctionCommand({ FunctionName: functionName }));
    } catch (error) {
      console.log(`Function ${functionName} doesn't exist yet, skipping SNS subscription`);
      return;
    }
    
    const lambdaArn = `arn:aws:lambda:${AWS_REGION}:${AWS_ACCOUNT_ID}:function:${functionName}`;
    
    // Allow SNS to invoke the Lambda function
    try {
      await lambdaClient.send(new AddPermissionCommand({
        FunctionName: functionName,
        StatementId: `sns-${Date.now()}`,
        Action: 'lambda:InvokeFunction',
        Principal: 'sns.amazonaws.com',
        SourceArn: topicArn
      }));
      console.log(`Added permission for SNS to invoke Lambda ${functionName}`);
    } catch (error) {
      if (error instanceof ResourceConflictException) {
        console.log(`Permission for SNS to invoke Lambda ${functionName} already exists`);
      } else {
        throw error;
      }
    }
    
    // Subscribe the Lambda function to the SNS topic
    await snsClient.send(new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'lambda',
      Endpoint: lambdaArn
    }));
    console.log(`Subscribed Lambda function ${functionName} to SNS topic`);
  } catch (error) {
    console.error(`Error subscribing Lambda ${functionName} to SNS topic:`, error);
  }
}

/**
 * Configure S3 bucket to trigger Lambda function on object created events
 */
async function configureS3EventTrigger(bucketName: string, lambdaArn: string) {
  try {
    console.log(`Configuring S3 event trigger for bucket ${bucketName} to Lambda ${lambdaArn}`);
    
    // Configure bucket notification
    await s3Client.send(new PutBucketNotificationConfigurationCommand({
      Bucket: bucketName,
      NotificationConfiguration: {
        LambdaFunctionConfigurations: [
          {
            LambdaFunctionArn: lambdaArn,
            Events: ['s3:ObjectCreated:*'],
            Filter: {
              Key: {
                FilterRules: [
                  {
                    Name: 'prefix',
                    Value: 'assignments/'
                  }
                ]
              }
            }
          }
        ]
      }
    }));
    
    console.log(`S3 event trigger configured successfully`);
  } catch (error) {
    console.error('Error configuring S3 event trigger:', error);
    throw error;
  }
}

/**
 * Allow S3 to invoke the Lambda function
 */
async function grantS3InvokeLambdaPermission(functionName: string, bucketName: string) {
  try {
    console.log(`Granting S3 permission to invoke Lambda function ${functionName}`);
    
    await lambdaClient.send(new AddPermissionCommand({
      FunctionName: functionName,
      StatementId: `s3-${Date.now()}`,
      Action: 'lambda:InvokeFunction',
      Principal: 's3.amazonaws.com',
      SourceArn: `arn:aws:s3:::${bucketName}`
    }));
    
    console.log(`Permission granted successfully`);
  } catch (error) {
    if (error instanceof ResourceConflictException) {
      console.log('Permission already exists');
    } else {
      console.error('Error granting permission:', error);
      throw error;
    }
  }
}

/**
 * Main deployment function
 */
async function deployLambdaFunctions() {
  try {
    console.log('Starting Lambda function deployment...');
    
    // Validate required environment variables
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      console.error('AWS credentials are not set. Please check your .env file.');
      process.exit(1);
    }
    
    if (!AWS_ACCOUNT_ID) {
      console.error('AWS_ACCOUNT_ID is not set. Please add VITE_AWS_ACCOUNT_ID to your .env file.');
      process.exit(1);
    }
    
    if (!LAMBDA_ROLE_ARN) {
      console.error('LAMBDA_ROLE_ARN is not set. Please add VITE_AWS_LAMBDA_ROLE_ARN to your .env file.');
      process.exit(1);
    }
    
    if (!S3_BUCKET) {
      console.error('S3_BUCKET is not set. Please add VITE_AWS_S3_BUCKET to your .env file.');
      process.exit(1);
    }
    
    // Create SNS topic for assignment notifications
    const snsTopicArn = await createAssignmentNotificationsTopic();
    console.log(`SNS Topic ARN: ${snsTopicArn}`);
    
    // Deploy each Lambda function
    for (const functionDef of lambdaFunctions) {
      const zipFilePath = await zipLambdaFunction(functionDef.sourceFile, functionDef.name);
      await deployLambdaFunction(functionDef, zipFilePath);
    }
    
    // Subscribe notification processor to SNS topic
    if (snsTopicArn) {
      await subscribeLambdaToTopic(snsTopicArn, 'educonnect-notification-processor');
    }
    
    // Grant S3 permission to invoke the assignment submission handler
    await grantS3InvokeLambdaPermission(
      'educonnect-assignment-submission-handler',
      S3_BUCKET
    );
    
    // Configure S3 to trigger Lambda on file uploads
    const assignmentHandlerArn = `arn:aws:lambda:${AWS_REGION}:${AWS_ACCOUNT_ID}:function:educonnect-assignment-submission-handler`;
    await configureS3EventTrigger(S3_BUCKET, assignmentHandlerArn);
    
    console.log('Lambda functions deployed successfully!');
    console.log(`
    Important notes:
    1. The assignment submission handler will trigger on all objects uploaded to the 'assignments/' prefix in the S3 bucket.
    2. The notification processor will receive messages from the SNS topic and store them in DynamoDB.
    3. Email notifications require SES to be properly configured with verified email addresses.
    4. For production, you may need to request production access for SES to send emails to non-verified addresses.
    `);
  } catch (error) {
    console.error('Error deploying Lambda functions:', error);
    process.exit(1);
  }
}

// Run the deployment
deployLambdaFunctions(); 
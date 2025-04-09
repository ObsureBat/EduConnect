import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  GetFunctionCommand
} from '@aws-sdk/client-lambda';
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
const AWS_ACCOUNT_ID = process.env.VITE_AWS_ACCOUNT_ID || '';
const LAMBDA_ROLE_ARN = process.env.VITE_AWS_LAMBDA_ROLE_ARN || '';
const DYNAMODB_ASSIGNMENTS_TABLE = process.env.VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE || '';
const DYNAMODB_MESSAGES_TABLE = process.env.VITE_AWS_DYNAMODB_MESSAGES_TABLE || '';
const DYNAMODB_USERS_TABLE = process.env.VITE_AWS_DYNAMODB_USERS_TABLE || '';
const DYNAMODB_NOTIFICATIONS_TABLE = process.env.VITE_AWS_DYNAMODB_NOTIFICATIONS_TABLE || '';

// Initialize clients
const lambdaClient = new LambdaClient({
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
    name: 'educonnect-user-manager',
    handler: 'userManager.handler',
    description: 'Manages user profiles and account settings',
    timeout: 30,
    memorySize: 256,
    environment: {
      DYNAMODB_USERS_TABLE
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
      DYNAMODB_MESSAGES_TABLE
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
    console.error('LAMBDA_ROLE_ARN is not set. Please check your .env file.');
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
        Runtime: 'nodejs18.x',
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
    
    // Deploy each Lambda function
    for (const functionDef of lambdaFunctions) {
      try {
        const zipFilePath = await zipLambdaFunction(functionDef.sourceFile, functionDef.name);
        await deployLambdaFunction(functionDef, zipFilePath);
      } catch (error) {
        console.error(`Error deploying ${functionDef.name}:`, error);
        console.log('Continuing with next function...');
      }
    }
    
    console.log('Lambda functions deployment completed!');
  } catch (error) {
    console.error('Error deploying Lambda functions:', error);
    process.exit(1);
  }
}

// Run the deployment
deployLambdaFunctions().catch(error => {
  console.error('Deployment failed:', error);
  process.exit(1);
}); 
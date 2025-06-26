import { LambdaClient, CreateFunctionCommand, UpdateFunctionCodeCommand } from '@aws-sdk/client-lambda';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new LambdaClient({
  region: process.env.VITE_AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

async function deployLambda() {
  try {
    // Read the Lambda function code
    const lambdaCode = readFileSync(join(__dirname, '../lambda/meeting-handler.mjs'), 'utf-8');

    // Create or update the Lambda function
    const createFunctionCommand = new CreateFunctionCommand({
      FunctionName: 'educonnect-meeting-handler',
      Runtime: 'nodejs18.x',
      Handler: 'index.handler',
      Role: 'arn:aws:iam::your-account-id:role/lambda-role', // Replace with your Lambda role ARN
      Code: {
        ZipFile: Buffer.from(lambdaCode)
      },
      Environment: {
        Variables: {
          AWS_REGION: process.env.VITE_AWS_REGION || 'us-east-1',
          AWS_ACCESS_KEY_ID: process.env.VITE_AWS_ACCESS_KEY_ID || '',
          AWS_SECRET_ACCESS_KEY: process.env.VITE_AWS_SECRET_ACCESS_KEY || ''
        }
      }
    });

    try {
      await client.send(createFunctionCommand);
      console.log('Lambda function created successfully');
    } catch (error: any) {
      // If function already exists, update it
      if (error.name === 'ResourceConflictException') {
        const updateFunctionCodeCommand = new UpdateFunctionCodeCommand({
          FunctionName: 'educonnect-meeting-handler',
          ZipFile: Buffer.from(lambdaCode)
        });
        await client.send(updateFunctionCodeCommand);
        console.log('Lambda function updated successfully');
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error deploying Lambda function:', error);
  }
}

deployLambda(); 
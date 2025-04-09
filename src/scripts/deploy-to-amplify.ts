import {
  AmplifyClient,
  CreateAppCommand,
  CreateBranchCommand,
  CreateDeploymentCommand,
  GetAppCommand,
} from '@aws-sdk/client-amplify';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const region = process.env.VITE_AWS_REGION;
const appName = process.env.VITE_APP_NAME || 'EduConnect';
const repoUrl = process.env.VITE_GITHUB_REPO_URL || '';
const githubToken = process.env.VITE_GITHUB_ACCESS_TOKEN || '';

if (!region || !repoUrl || !githubToken) {
  console.error('Missing required environment variables:');
  console.error('Make sure VITE_AWS_REGION, VITE_GITHUB_REPO_URL and VITE_GITHUB_ACCESS_TOKEN are set in .env');
  process.exit(1);
}

// Initialize Amplify client
const amplifyClient = new AmplifyClient({
  region,
  credentials: {
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

async function deployToAmplify() {
  try {
    console.log(`Starting AWS Amplify deployment for ${appName}...`);
    
    // Check if the app already exists
    let appId;
    try {
      const getAppResponse = await amplifyClient.send(
        new GetAppCommand({ appId: `${appName}` })
      );
      appId = getAppResponse.app?.appId;
      console.log(`Found existing Amplify app with ID: ${appId}`);
    } catch (error) {
      console.log('App not found, creating a new Amplify app...');
      
      // Create a new Amplify app
      const createAppParams = {
        name: appName,
        repository: repoUrl,
        accessToken: githubToken,
        environmentVariables: {
          // Add your environment variables here
          VITE_AWS_REGION: region,
          NODE_ENV: 'production',
        },
        buildSpec: `version: 1
applications:
  - frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
    appRoot: .`
      };
      
      const createAppResponse = await amplifyClient.send(
        new CreateAppCommand(createAppParams)
      );
      
      appId = createAppResponse.app?.appId;
      console.log(`Created new Amplify app with ID: ${appId}`);
    }
    
    if (!appId) {
      throw new Error('Failed to get or create Amplify app');
    }
    
    // Create a branch (main or master)
    try {
      const createBranchParams = {
        appId,
        branchName: 'main',
        enableAutoBuild: true,
        environmentVariables: {
          VITE_AWS_REGION: region,
          NODE_ENV: 'production',
        },
      };
      
      await amplifyClient.send(
        new CreateBranchCommand(createBranchParams)
      );
      
      console.log('Created/updated main branch configuration');
    } catch (error) {
      console.log('Branch already exists or other error:', error);
    }
    
    console.log(`
    =====================================================================
    AWS Amplify Deployment Information
    =====================================================================
    
    Your application ${appName} has been configured in AWS Amplify.
    App ID: ${appId}
    
    Next steps:
    1. Go to the AWS Amplify Console to view your app:
       https://${region}.console.aws.amazon.com/amplify/home?region=${region}#/${appId}
    
    2. Amplify will automatically deploy when you push to the connected repository
    
    3. If you want to manually trigger a build, you can do so from the AWS Console
    
    4. Make sure your environment variables are properly configured in the Amplify Console
    
    Note: Your AWS IAM user needs sufficient permissions for Amplify services
    =====================================================================
    `);
    
  } catch (error) {
    console.error('Error deploying to AWS Amplify:', error);
  }
}

deployToAmplify().catch(console.error); 
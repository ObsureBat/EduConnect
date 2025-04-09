import { 
  CognitoIdentityProviderClient, 
  DescribeUserPoolClientCommand,
  UpdateUserPoolClientCommand,
  CreateUserPoolDomainCommand,
  DescribeUserPoolDomainCommand
} from '@aws-sdk/client-cognito-identity-provider';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

async function configureCognitoDomain() {
  try {
    const userPoolId = process.env.VITE_AWS_COGNITO_USER_POOL_ID;
    const clientId = process.env.VITE_AWS_COGNITO_CLIENT_ID;
    const domainPrefix = process.env.VITE_AWS_COGNITO_DOMAIN;

    if (!userPoolId || !clientId) {
      console.error('Cognito User Pool ID or Client ID is missing in environment variables');
      return;
    }

    if (!domainPrefix) {
      console.error('Cognito Domain Prefix is missing in environment variables');
      console.log('Please add VITE_AWS_COGNITO_DOMAIN to your .env file');
      return;
    }

    // Check if domain already exists
    try {
      const domainResponse = await cognitoClient.send(new DescribeUserPoolDomainCommand({
        Domain: domainPrefix
      }));

      if (domainResponse.DomainDescription?.Status === 'ACTIVE') {
        console.log(`Cognito domain ${domainPrefix} already exists and is active`);
      } else {
        // Create domain if it doesn't exist or isn't active
        await createCognitoDomain(userPoolId, domainPrefix);
      }
    } catch (error) {
      // Domain doesn't exist, create it
      await createCognitoDomain(userPoolId, domainPrefix);
    }

    // Update client to support OAuth
    await updateClientOAuthSettings(userPoolId, clientId);

    console.log(`
    =======================================================
    Cognito Domain Configuration Complete
    =======================================================
    Domain: ${domainPrefix}.auth.${process.env.VITE_AWS_REGION}.amazoncognito.com
    
    For Google login to work, you need to:
    1. Create a Google OAuth Client ID in Google Cloud Console
    2. Set the redirect URI to: https://${domainPrefix}.auth.${process.env.VITE_AWS_REGION}.amazoncognito.com/oauth2/idpresponse
    3. Add your Google client ID and secret in AWS Cognito Console as an Identity Provider
    
    For Facebook login to work, you need to:
    1. Create a Facebook App in Facebook Developer Portal
    2. Set the redirect URI to: https://${domainPrefix}.auth.${process.env.VITE_AWS_REGION}.amazoncognito.com/oauth2/idpresponse
    3. Add your Facebook app ID and secret in AWS Cognito Console as an Identity Provider
    =======================================================
    `);

  } catch (error) {
    console.error('Error configuring Cognito domain:', error);
  }
}

async function createCognitoDomain(userPoolId: string, domainPrefix: string) {
  try {
    await cognitoClient.send(new CreateUserPoolDomainCommand({
      Domain: domainPrefix,
      UserPoolId: userPoolId
    }));
    console.log(`Created Cognito domain: ${domainPrefix}.auth.${process.env.VITE_AWS_REGION}.amazoncognito.com`);
  } catch (error) {
    console.error('Error creating Cognito domain:', error);
    throw error;
  }
}

async function updateClientOAuthSettings(userPoolId: string, clientId: string) {
  try {
    // Get current client settings
    const describeResponse = await cognitoClient.send(new DescribeUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientId: clientId
    }));

    const currentClient = describeResponse.UserPoolClient;
    if (!currentClient) {
      throw new Error('Could not retrieve user pool client details');
    }

    // Add OAuth settings to client
    const callbackUrl = 'http://localhost:3000';  // Default for local development
    
    await cognitoClient.send(new UpdateUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      AllowedOAuthFlows: ['code', 'implicit'],
      AllowedOAuthScopes: ['email', 'openid', 'profile'],
      AllowedOAuthFlowsUserPoolClient: true,
      SupportedIdentityProviders: ['COGNITO', 'Google', 'Facebook'],
      CallbackURLs: [callbackUrl],
      LogoutURLs: [callbackUrl],
      ExplicitAuthFlows: currentClient.ExplicitAuthFlows
    }));

    console.log('Updated Cognito client with OAuth settings');
  } catch (error) {
    console.error('Error updating Cognito client OAuth settings:', error);
    throw error;
  }
}

// Run the configuration
configureCognitoDomain().catch(console.error); 
import { 
  CognitoIdentityProviderClient, 
  UpdateUserPoolClientCommand,
  DescribeUserPoolClientCommand,
  CreateIdentityProviderCommand,
  ListIdentityProvidersCommand
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

async function setupGoogleLogin() {
  try {
    const userPoolId = process.env.VITE_AWS_COGNITO_USER_POOL_ID;
    const clientId = process.env.VITE_AWS_COGNITO_CLIENT_ID;

    if (!userPoolId || !clientId) {
      console.error('Cognito User Pool ID or Client ID is missing in environment variables');
      return;
    }

    // Check if Google provider already exists
    const providersResponse = await cognitoClient.send(new ListIdentityProvidersCommand({
      UserPoolId: userPoolId
    }));

    const hasGoogleProvider = providersResponse.Providers?.some(
      provider => provider.ProviderName === 'Google'
    );

    if (!hasGoogleProvider) {
      console.log('Google provider not found. You need to create it first in the AWS Console.');
      console.log(`
      =======================================================
      Create Google Identity Provider in AWS Cognito Console
      =======================================================
      1. Go to the AWS Cognito Console: https://console.aws.amazon.com/cognito/
      2. Select your user pool: ${userPoolId}
      3. Go to "Sign-in experience" tab
      4. Under "Federated identity provider sign-in", click "Add identity provider"
      5. Select "Google"
      6. Add your Google client ID and client secret from Google Cloud Console
      7. For "Authorized scopes", enter: profile email openid
      8. Map attributes as needed (common mappings):
         - email -> email
         - name -> name
         - sub -> sub
      9. Click "Add identity provider"
      =======================================================
      `);

      // Ask for Google Client ID and Secret
      console.log('NOTE: You need to create a project in Google Cloud Console and obtain OAuth credentials.');
      console.log('Visit: https://console.cloud.google.com/apis/credentials');
      console.log('');
      console.log('For testing purposes, would you like to try to create a Google provider with placeholder credentials?');
      console.log('These will NOT work for actual authentication but will allow you to proceed with configuration.');
      console.log('Enter "y" to continue with test credentials or "n" to stop and configure manually.');
      
      // For testing, create a placeholder provider
      // In a real scenario, you would prompt for actual credentials from Google Console
      console.log('Creating placeholder Google provider for testing...');
      
      try {
        await cognitoClient.send(new CreateIdentityProviderCommand({
          UserPoolId: userPoolId,
          ProviderName: 'Google',
          ProviderType: 'Google',
          ProviderDetails: {
            client_id: 'TEST_PLACEHOLDER_CLIENT_ID',
            client_secret: 'TEST_PLACEHOLDER_CLIENT_SECRET',
            authorize_scopes: 'profile email openid'
          },
          AttributeMapping: {
            email: 'email',
            name: 'name',
            username: 'sub'
          }
        }));
        
        console.log('Created placeholder Google provider. Replace with real credentials in AWS Console.');
      } catch (error) {
        console.error('Failed to create placeholder Google provider:', error);
        console.log('You must create the Google provider manually in the AWS Console.');
        return;
      }
    } else {
      console.log('Google provider already exists for this user pool.');
    }

    // Get current client settings
    const describeResponse = await cognitoClient.send(new DescribeUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientId: clientId
    }));

    const currentClient = describeResponse.UserPoolClient;
    if (!currentClient) {
      throw new Error('Could not retrieve user pool client details');
    }

    // Get the application URL
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    
    // Ensure we have all the current settings to avoid overwriting them
    const supportedProviders = new Set([
      ...(currentClient.SupportedIdentityProviders || []),
      'COGNITO',
      'Google'
    ]);
    
    const callbackUrls = new Set([
      ...(currentClient.CallbackURLs || []),
      appUrl
    ]);
    
    const logoutUrls = new Set([
      ...(currentClient.LogoutURLs || []),
      appUrl
    ]);
    
    // Update the client to support OAuth and Google login
    await cognitoClient.send(new UpdateUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      AllowedOAuthFlows: ['code', 'implicit'],
      AllowedOAuthScopes: ['email', 'openid', 'profile'],
      AllowedOAuthFlowsUserPoolClient: true,
      SupportedIdentityProviders: Array.from(supportedProviders),
      CallbackURLs: Array.from(callbackUrls),
      LogoutURLs: Array.from(logoutUrls),
      ExplicitAuthFlows: currentClient.ExplicitAuthFlows
    }));

    console.log('Successfully updated Cognito client for Google login.');
    console.log(`
    =======================================================
    Google login configuration:
    =======================================================
    User Pool ID: ${userPoolId}
    Client ID: ${clientId}
    Supported Identity Providers: ${Array.from(supportedProviders).join(', ')}
    Callback URLs: ${Array.from(callbackUrls).join(', ')}
    =======================================================
    
    For Google login to work correctly:
    
    1. Create a project in Google Cloud Console: https://console.cloud.google.com/
    2. Set up OAuth consent screen
    3. Create OAuth credentials
    4. Add these redirect URIs to your Google OAuth credentials:
       - ${appUrl}
       - ${appUrl}/oauth/callback
       - https://${process.env.VITE_AWS_COGNITO_DOMAIN}.auth.${process.env.VITE_AWS_REGION}.amazoncognito.com/oauth2/idpresponse
    5. Update the Google provider in AWS Cognito with your real Google client ID and secret
    =======================================================
    `);

  } catch (error) {
    console.error('Error setting up Google login:', error);
  }
}

// Run the configuration
setupGoogleLogin().catch(console.error); 
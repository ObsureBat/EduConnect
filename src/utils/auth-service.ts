import { 
  CognitoIdentityProviderClient, 
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GetUserCommand,
  GlobalSignOutCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { browserEnv } from '../config/browser-env';
import toast from 'react-hot-toast';

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: browserEnv.VITE_AWS_REGION,
  credentials: {
    accessKeyId: browserEnv.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: browserEnv.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

// User types
export interface User {
  username: string;
  email: string;
  name?: string;
  role?: 'student' | 'teacher' | 'admin';
  userAttributes?: Record<string, string>;
}

// Authentication service
export const AuthService = {
  // Sign up a new user
  async signUp(username: string, password: string, email: string, name: string): Promise<boolean> {
    try {
      const command = new SignUpCommand({
        ClientId: browserEnv.VITE_AWS_COGNITO_CLIENT_ID,
        Username: username,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'name', Value: name }
        ]
      });

      const response = await cognitoClient.send(command);
      console.log('Sign up successful:', response);
      toast.success('Sign up successful! Please check your email for verification code.');
      return true;
    } catch (error) {
      console.error('Sign up error:', error);
      toast.error(error instanceof Error ? error.message : 'Sign up failed');
      return false;
    }
  },

  // Confirm sign up with verification code
  async confirmSignUp(username: string, code: string): Promise<boolean> {
    try {
      const command = new ConfirmSignUpCommand({
        ClientId: browserEnv.VITE_AWS_COGNITO_CLIENT_ID,
        Username: username,
        ConfirmationCode: code
      });

      await cognitoClient.send(command);
      toast.success('Email verified successfully! You can now sign in.');
      return true;
    } catch (error) {
      console.error('Confirm sign up error:', error);
      toast.error(error instanceof Error ? error.message : 'Email verification failed');
      return false;
    }
  },

  // Sign in a user
  async signIn(username: string, password: string): Promise<string | null> {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: browserEnv.VITE_AWS_COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password
        }
      });

      const response = await cognitoClient.send(command);
      const idToken = response.AuthenticationResult?.IdToken;
      const accessToken = response.AuthenticationResult?.AccessToken;
      const refreshToken = response.AuthenticationResult?.RefreshToken;

      if (idToken && accessToken && refreshToken) {
        // Store tokens in localStorage
        localStorage.setItem('idToken', idToken);
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        toast.success('Signed in successfully!');
        return accessToken;
      } else {
        toast.error('Sign in failed: missing authentication tokens');
        return null;
      }
    } catch (error) {
      console.error('Sign in error:', error);
      toast.error(error instanceof Error ? error.message : 'Sign in failed');
      return null;
    }
  },

  // Google Sign In
  async signInWithGoogle(): Promise<void> {
    try {
      // Set to true to use simulated authentication during development
      const useLocalSimulation = true;
      
      if (useLocalSimulation) {
        console.log("Using simulation for Google login");
        // Create a fake token and simulate login
        const fakeToken = "SIMULATED_" + Math.random().toString(36).substring(2);
        localStorage.setItem('idToken', fakeToken);
        localStorage.setItem('accessToken', fakeToken);
        localStorage.setItem('refreshToken', fakeToken);
        
        // Simulate a user profile
        const mockProfile = {
          name: "Ayush Sharma",
          email: "ayushsharmasd02@gmail.com",
          picture: `https://ui-avatars.com/api/?name=Ayush+Sharma&background=0D8ABC&color=fff`
        };
        localStorage.setItem('userProfile', JSON.stringify(mockProfile));
        
        toast.success('Simulated Google login successful!');
        // Reload to trigger auth state update
        setTimeout(() => window.location.reload(), 1000);
        return;
      }
      
      // REAL GOOGLE AUTHENTICATION
      // You need to create a project in Google Cloud Console and get a valid Client ID
      const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID"; // Replace with your actual Client ID
      const redirectUri = window.location.origin + "/oauth/callback";
      
      // Create Google OAuth URL
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` + // Using implicit flow
        `&scope=${encodeURIComponent('email profile')}` +
        `&prompt=select_account`; // Force account selection
      
      console.log("Redirecting to Google:", googleAuthUrl);
      toast.success('Redirecting to Google...');
      
      // Redirect to Google login page
      window.location.href = googleAuthUrl;
    } catch (error) {
      console.error('Google sign in error:', error);
      toast.error('Failed to initiate Google sign in');
    }
  },

  // Facebook Sign In
  async signInWithFacebook(): Promise<void> {
    try {
      // Redirect to Cognito Hosted UI with Facebook provider
      const cognitoDomain = browserEnv.VITE_AWS_COGNITO_DOMAIN;
      const clientId = browserEnv.VITE_AWS_COGNITO_CLIENT_ID;
      const redirectUri = window.location.origin;
      
      if (!cognitoDomain || cognitoDomain.trim() === '') {
        toast.error('Cognito domain is not configured. Please add VITE_AWS_COGNITO_DOMAIN to your .env file');
        console.error('Missing Cognito domain configuration');
        return;
      }
      
      const url = `https://${cognitoDomain}.auth.${browserEnv.VITE_AWS_REGION}.amazoncognito.com/oauth2/authorize?identity_provider=Facebook&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&client_id=${clientId}&scope=email+openid+profile`;
      
      window.location.href = url;
    } catch (error) {
      console.error('Facebook sign in error:', error);
      toast.error('Failed to initiate Facebook sign in');
    }
  },

  // Handle OAuth Callback
  async handleOAuthCallback(): Promise<boolean> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      try {
        // Exchange authorization code for tokens
        const tokenEndpoint = `https://${browserEnv.VITE_AWS_COGNITO_DOMAIN}.auth.${browserEnv.VITE_AWS_REGION}.amazoncognito.com/oauth2/token`;
        const redirectUri = window.location.origin;
        
        const body = new URLSearchParams();
        body.append('grant_type', 'authorization_code');
        body.append('client_id', browserEnv.VITE_AWS_COGNITO_CLIENT_ID || '');
        body.append('code', code);
        body.append('redirect_uri', redirectUri);
        
        const response = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body.toString()
        });
        
        const tokens = await response.json();
        
        if (tokens.id_token && tokens.access_token && tokens.refresh_token) {
          localStorage.setItem('idToken', tokens.id_token);
          localStorage.setItem('accessToken', tokens.access_token);
          localStorage.setItem('refreshToken', tokens.refresh_token);
          
          // Clear the URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
          
          toast.success('Signed in successfully!');
          return true;
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        toast.error('Failed to complete social login');
      }
    }
    
    return false;
  },

  // Forgot password
  async forgotPassword(username: string): Promise<boolean> {
    try {
      const command = new ForgotPasswordCommand({
        ClientId: browserEnv.VITE_AWS_COGNITO_CLIENT_ID,
        Username: username
      });

      await cognitoClient.send(command);
      toast.success('Password reset code sent to your email!');
      return true;
    } catch (error) {
      console.error('Forgot password error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send password reset code');
      return false;
    }
  },

  // Confirm forgot password with verification code
  async confirmForgotPassword(username: string, code: string, newPassword: string): Promise<boolean> {
    try {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: browserEnv.VITE_AWS_COGNITO_CLIENT_ID,
        Username: username,
        ConfirmationCode: code,
        Password: newPassword
      });

      await cognitoClient.send(command);
      toast.success('Password reset successful! You can now sign in with your new password.');
      return true;
    } catch (error) {
      console.error('Confirm forgot password error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reset password');
      return false;
    }
  },

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    try {
      const accessToken = localStorage.getItem('accessToken');
      
      if (!accessToken) {
        return null;
      }

      const command = new GetUserCommand({
        AccessToken: accessToken
      });

      const response = await cognitoClient.send(command);
      
      if (response.UserAttributes) {
        const userAttributes: Record<string, string> = {};
        let email = '';
        let name = '';
        let role = 'student';
        
        for (const attribute of response.UserAttributes) {
          if (attribute.Name && attribute.Value) {
            userAttributes[attribute.Name] = attribute.Value;
            
            if (attribute.Name === 'email') {
              email = attribute.Value;
            } else if (attribute.Name === 'name') {
              name = attribute.Value;
            }
          }
        }
        
        return {
          username: response.Username || '',
          email,
          name,
          role: role as 'student' | 'teacher' | 'admin',
          userAttributes
        };
      }
      
      return null;
    } catch (error) {
      console.error('Get current user error:', error);
      // Don't show toast here as it can be disruptive during session checks
      return null;
    }
  },

  // Sign out user
  async signOut(): Promise<boolean> {
    try {
      const accessToken = localStorage.getItem('accessToken');
      
      if (accessToken) {
        // Call Cognito to sign out globally
        const command = new GlobalSignOutCommand({
          AccessToken: accessToken
        });
        
        await cognitoClient.send(command);
      }
      
      // Clear local storage regardless of API call result
      localStorage.removeItem('idToken');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      
      toast.success('Signed out successfully');
      return true;
    } catch (error) {
      console.error('Sign out error:', error);
      
      // Still clear local storage even if API call fails
      localStorage.removeItem('idToken');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      
      toast.error(error instanceof Error ? error.message : 'Sign out failed');
      return false;
    }
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return localStorage.getItem('accessToken') !== null;
  },

  // Get stored access token
  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }
};

export default AuthService; 
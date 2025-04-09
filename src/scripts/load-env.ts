import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
config({ path: resolve(process.cwd(), '.env') });

// Export environment variables
export const env = {
  // AWS Configuration
  VITE_AWS_REGION: process.env.VITE_AWS_REGION || 'us-east-1',
  VITE_AWS_ACCESS_KEY_ID: process.env.VITE_AWS_ACCESS_KEY_ID,
  VITE_AWS_SECRET_ACCESS_KEY: process.env.VITE_AWS_SECRET_ACCESS_KEY,
  VITE_AWS_ACCOUNT_ID: process.env.VITE_AWS_ACCOUNT_ID,
  
  // S3 Buckets
  VITE_AWS_S3_BUCKET: process.env.VITE_AWS_S3_BUCKET || 'educonnect-files-20240408',
  VITE_AWS_WEBSITE_BUCKET: process.env.VITE_AWS_WEBSITE_BUCKET || 'educonnect-web-20240408',
  
  // DynamoDB Tables
  VITE_AWS_DYNAMODB_GROUPS_TABLE: process.env.VITE_AWS_DYNAMODB_GROUPS_TABLE || 'educonnect-groups',
  VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE: process.env.VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE || 'educonnect-assignments',
  VITE_AWS_DYNAMODB_MESSAGES_TABLE: process.env.VITE_AWS_DYNAMODB_MESSAGES_TABLE || 'educonnect-messages',
  VITE_AWS_DYNAMODB_USERS_TABLE: process.env.VITE_AWS_DYNAMODB_USERS_TABLE || 'educonnect-users',
  VITE_AWS_DYNAMODB_COURSES_TABLE: process.env.VITE_AWS_DYNAMODB_COURSES_TABLE || 'educonnect-courses',
  VITE_AWS_DYNAMODB_NOTIFICATIONS_TABLE: process.env.VITE_AWS_DYNAMODB_NOTIFICATIONS_TABLE || 'educonnect-notifications',
  
  // Lex Chatbot
  VITE_AWS_LEX_BOT_ID: process.env.VITE_AWS_LEX_BOT_ID || '',
  VITE_AWS_LEX_BOT_ALIAS_ID: process.env.VITE_AWS_LEX_BOT_ALIAS_ID || '',
  
  // Rekognition
  VITE_AWS_REKOGNITION_ENABLED: process.env.VITE_AWS_REKOGNITION_ENABLED || 'false',
  VITE_AWS_REKOGNITION_COLLECTION_ID: process.env.VITE_AWS_REKOGNITION_COLLECTION_ID || 'educonnect-faces-temp',
  
  // Cognito
  VITE_AWS_COGNITO_USER_POOL_ID: process.env.VITE_AWS_COGNITO_USER_POOL_ID || '',
  VITE_AWS_COGNITO_CLIENT_ID: process.env.VITE_AWS_COGNITO_CLIENT_ID || '',
  
  // Lambda
  VITE_AWS_LAMBDA_ROLE_ARN: process.env.VITE_AWS_LAMBDA_ROLE_ARN,
  
  // API Gateway
  VITE_AWS_API_GATEWAY_URL: process.env.VITE_AWS_API_GATEWAY_URL,
  
  // SNS/SQS
  VITE_ADMIN_EMAIL: process.env.VITE_ADMIN_EMAIL,
  
  // Application Settings
  VITE_APP_NAME: process.env.VITE_APP_NAME || 'EduConnect',
  VITE_DEFAULT_LANGUAGE: process.env.VITE_DEFAULT_LANGUAGE || 'en'
}; 
interface BrowserEnv {
  VITE_AWS_REGION: string;
  VITE_AWS_ACCESS_KEY_ID: string;
  VITE_AWS_SECRET_ACCESS_KEY: string;
  
  // S3 Buckets
  VITE_AWS_S3_BUCKET: any;
  VITE_AWS_WEBSITE_BUCKET: any;
  
  // DynamoDB Tables
  VITE_AWS_DYNAMODB_GROUPS_TABLE: any;
  VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE: any;
  VITE_AWS_DYNAMODB_MESSAGES_TABLE: any;
  VITE_AWS_DYNAMODB_USERS_TABLE?: any;
  VITE_AWS_DYNAMODB_COURSES_TABLE?: any;
  VITE_AWS_DYNAMODB_NOTIFICATIONS_TABLE?: any;
  
  // Lex Chatbot
  VITE_AWS_LEX_BOT_ID: string;
  VITE_AWS_LEX_BOT_ALIAS_ID: string;
  
  // Rekognition
  VITE_AWS_REKOGNITION_ENABLED?: string;
  VITE_AWS_REKOGNITION_COLLECTION_ID?: string;
  
  // Cognito
  VITE_AWS_COGNITO_USER_POOL_ID?: string;
  VITE_AWS_COGNITO_CLIENT_ID?: string;
  VITE_AWS_COGNITO_DOMAIN?: string;
  
  // Lambda
  VITE_AWS_LAMBDA_ROLE_ARN?: string;
  
  // API Gateway
  VITE_AWS_API_GATEWAY_URL?: string;
  
  // SNS/SQS
  VITE_ADMIN_EMAIL?: string;
  
  // Application Settings
  VITE_APP_NAME?: string;
  VITE_DEFAULT_LANGUAGE?: string;
}

export const browserEnv: BrowserEnv = {
  VITE_AWS_REGION: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  VITE_AWS_ACCESS_KEY_ID: import.meta.env.VITE_AWS_ACCESS_KEY_ID || '',
  VITE_AWS_SECRET_ACCESS_KEY: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '',
  
  // S3 Buckets
  VITE_AWS_S3_BUCKET: import.meta.env.VITE_AWS_S3_BUCKET,
  VITE_AWS_WEBSITE_BUCKET: import.meta.env.VITE_AWS_WEBSITE_BUCKET,
  
  // DynamoDB Tables
  VITE_AWS_DYNAMODB_GROUPS_TABLE: import.meta.env.VITE_AWS_DYNAMODB_GROUPS_TABLE,
  VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE: import.meta.env.VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE,
  VITE_AWS_DYNAMODB_MESSAGES_TABLE: import.meta.env.VITE_AWS_DYNAMODB_MESSAGES_TABLE,
  VITE_AWS_DYNAMODB_USERS_TABLE: import.meta.env.VITE_AWS_DYNAMODB_USERS_TABLE,
  VITE_AWS_DYNAMODB_COURSES_TABLE: import.meta.env.VITE_AWS_DYNAMODB_COURSES_TABLE,
  VITE_AWS_DYNAMODB_NOTIFICATIONS_TABLE: import.meta.env.VITE_AWS_DYNAMODB_NOTIFICATIONS_TABLE,
  
  // Lex Chatbot
  VITE_AWS_LEX_BOT_ID: import.meta.env.VITE_AWS_LEX_BOT_ID || '',
  VITE_AWS_LEX_BOT_ALIAS_ID: import.meta.env.VITE_AWS_LEX_BOT_ALIAS_ID || '',
  
  // Rekognition
  VITE_AWS_REKOGNITION_ENABLED: import.meta.env.VITE_AWS_REKOGNITION_ENABLED || 'false',
  VITE_AWS_REKOGNITION_COLLECTION_ID: import.meta.env.VITE_AWS_REKOGNITION_COLLECTION_ID || 'educonnect-faces-temp',
  
  // Cognito
  VITE_AWS_COGNITO_USER_POOL_ID: import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID || '',
  VITE_AWS_COGNITO_CLIENT_ID: import.meta.env.VITE_AWS_COGNITO_CLIENT_ID || '',
  VITE_AWS_COGNITO_DOMAIN: import.meta.env.VITE_AWS_COGNITO_DOMAIN || '',
  
  // Lambda
  VITE_AWS_LAMBDA_ROLE_ARN: import.meta.env.VITE_AWS_LAMBDA_ROLE_ARN,
  
  // API Gateway
  VITE_AWS_API_GATEWAY_URL: import.meta.env.VITE_AWS_API_GATEWAY_URL,
  
  // SNS/SQS
  VITE_ADMIN_EMAIL: import.meta.env.VITE_ADMIN_EMAIL,
  
  // Application Settings
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME || 'EduConnect',
  VITE_DEFAULT_LANGUAGE: import.meta.env.VITE_DEFAULT_LANGUAGE || 'en'
};
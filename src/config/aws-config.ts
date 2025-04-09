import { browserEnv } from './browser-env';

export const awsConfig = {
  region: browserEnv.VITE_AWS_REGION,
  credentials: {
    accessKeyId: browserEnv.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: browserEnv.VITE_AWS_SECRET_ACCESS_KEY || ''
  },
  
  s3: {
    bucketName: browserEnv.VITE_AWS_S3_BUCKET,
    websiteBucket: browserEnv.VITE_AWS_WEBSITE_BUCKET,
  },
  
  dynamodb: {
    groupsTable: browserEnv.VITE_AWS_DYNAMODB_GROUPS_TABLE,
    assignmentsTable: browserEnv.VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE,
    messagesTable: browserEnv.VITE_AWS_DYNAMODB_MESSAGES_TABLE,
  },
  
  agora: {
    appId: 'eb4791ced20b4c60a8abb3662bd2aff8',
    channel: 'default-channel',
    token: null,
    uid: Math.floor(Math.random() * 10000),
  },
  
  notifications: {
    topic: 'educonnect-notifications',
    queue: 'educonnect-notification-queue'
  },
  
  cloudwatch: {
    namespace: 'EduConnect',
    logGroup: '/educonnect/application',
    logStream: 'main'
  },
  
  environment: process.env.NODE_ENV || 'development'
};
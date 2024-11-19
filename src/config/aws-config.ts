export const awsConfig = {
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY
  },
  
  s3: {
    bucketName: import.meta.env.VITE_AWS_S3_BUCKET || 'educonnect-file-storage',
    websiteBucket: import.meta.env.VITE_AWS_WEBSITE_BUCKET || 'educonnect-website',
  },
  
  dynamodb: {
    groupsTable: import.meta.env.VITE_AWS_DYNAMODB_GROUPS_TABLE || 'educonnect-groups',
    assignmentsTable: import.meta.env.VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE || 'educonnect-assignments',
    messagesTable: import.meta.env.VITE_AWS_DYNAMODB_MESSAGES_TABLE || 'educonnect-messages',
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
  
  environment: import.meta.env.MODE || 'development'
};
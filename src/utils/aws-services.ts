import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { awsConfig } from '../config/aws-config';

export const getDynamoDBClient = () => {
  return new DynamoDBClient({
    region: awsConfig.region,
    credentials: {
      accessKeyId: awsConfig.credentials.accessKeyId,
      secretAccessKey: awsConfig.credentials.secretAccessKey
    }
  });
};

export const getS3Client = () => {
  return new S3Client({
    region: awsConfig.region,
    credentials: {
      accessKeyId: awsConfig.credentials.accessKeyId,
      secretAccessKey: awsConfig.credentials.secretAccessKey
    }
  });
};

export const uploadFileToS3 = async (file: File, key: string) => {
  const s3Client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: awsConfig.s3.bucketName,
    Key: key,
    Body: file,
  });
  
  return s3Client.send(command);
};

// Create DynamoDB Tables
export const createDynamoDBTables = async () => {
  const dynamoClient = getDynamoDBClient();

  // Messages Table
  const messagesTableParams = {
    TableName: awsConfig.dynamodb.messagesTable,
    KeySchema: [
      { AttributeName: 'messageId', KeyType: 'HASH' as const },
      { AttributeName: 'timestamp', KeyType: 'RANGE' as const }
    ],
    AttributeDefinitions: [
      { AttributeName: 'messageId', AttributeType: 'S' as const },
      { AttributeName: 'timestamp', AttributeType: 'S' as const },
      { AttributeName: 'read', AttributeType: 'S' as const }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    },
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UnreadMessagesIndex',
        KeySchema: [
          { AttributeName: 'read', KeyType: 'HASH' as const }
        ],
        Projection: { ProjectionType: 'ALL' as const },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ]
  };
  try {
    await dynamoClient.send(new CreateTableCommand(messagesTableParams));
    console.log('Messages table created successfully');
  } catch (error) {
    console.error('Error creating messages table:', error);
  }
};
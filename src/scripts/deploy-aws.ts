import { DynamoDBClient, CreateTableCommand, DescribeTableCommand, ScalarAttributeType, KeyType } from '@aws-sdk/client-dynamodb';
import { S3Client, CreateBucketCommand, PutBucketPolicyCommand, PutBucketWebsiteCommand, BucketLocationConstraint } from '@aws-sdk/client-s3';
import { SNSClient, CreateTopicCommand } from '@aws-sdk/client-sns';
import { SQSClient, CreateQueueCommand } from '@aws-sdk/client-sqs';
import { CloudWatchLogsClient, CreateLogGroupCommand } from '@aws-sdk/client-cloudwatch-logs';
import { RekognitionClient, DescribeCollectionCommand, CreateCollectionCommand, ListFacesCommand } from '@aws-sdk/client-rekognition';
import { env } from './load-env';

// Initialize AWS clients with proper typing
const dynamoClient = new DynamoDBClient({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

const s3Client = new S3Client({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

const snsClient = new SNSClient({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

const sqsClient = new SQSClient({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

const cloudWatchClient = new CloudWatchLogsClient({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

// Initialize Rekognition client
const rekognitionClient = new RekognitionClient({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

// Create DynamoDB tables
async function createDynamoDBTables() {
  const tables = [
    {
      TableName: env.VITE_AWS_DYNAMODB_GROUPS_TABLE,
      KeySchema: [
        { AttributeName: 'groupId', KeyType: KeyType.HASH },
        { AttributeName: 'timestamp', KeyType: KeyType.RANGE }
      ],
      AttributeDefinitions: [
        { AttributeName: 'groupId', AttributeType: ScalarAttributeType.S },
        { AttributeName: 'timestamp', AttributeType: ScalarAttributeType.S }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },
    {
      TableName: env.VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE,
      KeySchema: [
        { AttributeName: 'assignmentId', KeyType: KeyType.HASH },
        { AttributeName: 'timestamp', KeyType: KeyType.RANGE }
      ],
      AttributeDefinitions: [
        { AttributeName: 'assignmentId', AttributeType: ScalarAttributeType.S },
        { AttributeName: 'timestamp', AttributeType: ScalarAttributeType.S }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },
    {
      TableName: env.VITE_AWS_DYNAMODB_MESSAGES_TABLE,
      KeySchema: [
        { AttributeName: 'messageId', KeyType: KeyType.HASH },
        { AttributeName: 'timestamp', KeyType: KeyType.RANGE }
      ],
      AttributeDefinitions: [
        { AttributeName: 'messageId', AttributeType: ScalarAttributeType.S },
        { AttributeName: 'timestamp', AttributeType: ScalarAttributeType.S }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }
  ];

  for (const table of tables) {
    try {
      await dynamoClient.send(new CreateTableCommand(table));
      console.log(`Created DynamoDB table: ${table.TableName}`);
    } catch (error) {
      console.error(`Error creating DynamoDB table ${table.TableName}:`, error);
    }
  }
}

// Create S3 buckets
async function createS3Buckets() {
  const buckets = [
    {
      Bucket: env.VITE_AWS_S3_BUCKET,
      ...(env.VITE_AWS_REGION !== 'us-east-1' && {
        CreateBucketConfiguration: {
          LocationConstraint: env.VITE_AWS_REGION as BucketLocationConstraint
        }
      })
    },
    {
      Bucket: env.VITE_AWS_WEBSITE_BUCKET,
      ...(env.VITE_AWS_REGION !== 'us-east-1' && {
        CreateBucketConfiguration: {
          LocationConstraint: env.VITE_AWS_REGION as BucketLocationConstraint
        }
      })
    }
  ];

  for (const bucket of buckets) {
    try {
      await s3Client.send(new CreateBucketCommand(bucket));
      console.log(`Created S3 bucket: ${bucket.Bucket}`);
    } catch (error) {
      console.error(`Error creating S3 bucket ${bucket.Bucket}:`, error);
    }
  }
}

// Create SNS topic
async function createSNSTopic() {
  try {
    await snsClient.send(new CreateTopicCommand({
      Name: 'educonnect-notifications'
    }));
    console.log('Created SNS topic: educonnect-notifications');
  } catch (error) {
    console.error('Error creating SNS topic:', error);
  }
}

// Create SQS queue
async function createSQSQueue() {
  try {
    await sqsClient.send(new CreateQueueCommand({
      QueueName: 'educonnect-notification-queue'
    }));
    console.log('Created SQS queue: educonnect-notification-queue');
  } catch (error) {
    console.error('Error creating SQS queue:', error);
  }
}

// Create CloudWatch log group
async function createCloudWatchLogGroup() {
  try {
    await cloudWatchClient.send(new CreateLogGroupCommand({
      logGroupName: '/educonnect/application'
    }));
    console.log('Created CloudWatch log group: /educonnect/application');
  } catch (error) {
    console.error('Error creating CloudWatch log group:', error);
  }
}

// Verify Rekognition permissions
async function verifyRekognitionPermissions() {
  try {
    console.log('Verifying AWS Rekognition permissions...');
    
    // Attempt to create a collection (will succeed if permissions are valid)
    const collectionId = 'educonnect-faces-temp';
    
    try {
      // First check if the collection exists
      await rekognitionClient.send(new DescribeCollectionCommand({ 
        CollectionId: collectionId 
      }));
      console.log(`Rekognition collection exists: ${collectionId}`);
    } catch (error) {
      // If the collection doesn't exist, create it
      if ((error as any).name === 'ResourceNotFoundException') {
        await rekognitionClient.send(new CreateCollectionCommand({
          CollectionId: collectionId
        }));
        console.log(`Created Rekognition collection: ${collectionId}`);
      } else {
        throw error;
      }
    }
    
    // Test listing faces in the collection to verify read permissions
    await rekognitionClient.send(new ListFacesCommand({
      CollectionId: collectionId,
      MaxResults: 1
    }));
    
    console.log('AWS Rekognition permissions successfully verified!');
  } catch (error) {
    console.error('Error verifying AWS Rekognition permissions:', error);
    throw new Error('Rekognition setup failed. Please ensure you have the necessary IAM permissions.');
  }
}

// Main deployment function
export async function deployAWSServices() {
  console.log('Starting AWS services deployment...');
  
  await createS3Buckets();
  await createDynamoDBTables();
  await createSNSTopic();
  await createSQSQueue();
  await createCloudWatchLogGroup();
  await verifyRekognitionPermissions();
  
  console.log('AWS services deployment completed!');
}

// Verify services
export async function verifyAWSServices() {
  console.log('Verifying AWS services...');
  
  // Verify DynamoDB tables
  const tables = [
    env.VITE_AWS_DYNAMODB_GROUPS_TABLE,
    env.VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE,
    env.VITE_AWS_DYNAMODB_MESSAGES_TABLE
  ];

  for (const tableName of tables) {
    try {
      await dynamoClient.send(new DescribeTableCommand({ TableName: tableName }));
      console.log(`Verified DynamoDB table: ${tableName}`);
    } catch (error) {
      console.error(`Error verifying DynamoDB table ${tableName}:`, error);
    }
  }
  
  console.log('AWS services verification completed!');
}

// Run deployment
deployAWSServices().catch(console.error); 
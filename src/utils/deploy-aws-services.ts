import { DynamoDBClient, CreateTableCommand, DescribeTableCommand, ScalarAttributeType, KeyType } from '@aws-sdk/client-dynamodb';
import { S3Client, CreateBucketCommand, PutBucketPolicyCommand, PutBucketWebsiteCommand, BucketLocationConstraint } from '@aws-sdk/client-s3';
import { SNSClient, CreateTopicCommand } from '@aws-sdk/client-sns';
import { SQSClient, CreateQueueCommand } from '@aws-sdk/client-sqs';
import { CloudWatchLogsClient, CreateLogGroupCommand } from '@aws-sdk/client-cloudwatch-logs';
import { awsConfig } from '../config/aws-config';

// Initialize AWS clients with proper typing
const dynamoClient = new DynamoDBClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.credentials.accessKeyId || '',
    secretAccessKey: awsConfig.credentials.secretAccessKey || ''
  }
});

const s3Client = new S3Client({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.credentials.accessKeyId || '',
    secretAccessKey: awsConfig.credentials.secretAccessKey || ''
  }
});

const snsClient = new SNSClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.credentials.accessKeyId || '',
    secretAccessKey: awsConfig.credentials.secretAccessKey || ''
  }
});

const sqsClient = new SQSClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.credentials.accessKeyId || '',
    secretAccessKey: awsConfig.credentials.secretAccessKey || ''
  }
});

const cloudWatchClient = new CloudWatchLogsClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.credentials.accessKeyId || '',
    secretAccessKey: awsConfig.credentials.secretAccessKey || ''
  }
});

// Create S3 buckets
async function createS3Buckets() {
  try {
    // Create main storage bucket
    const createBucketCommand = new CreateBucketCommand({
      Bucket: awsConfig.s3.bucketName,
      ...(awsConfig.region !== 'us-east-1' && {
        CreateBucketConfiguration: {
          LocationConstraint: awsConfig.region as BucketLocationConstraint
        }
      })
    });
    await s3Client.send(createBucketCommand);
    console.log(`Created S3 bucket: ${awsConfig.s3.bucketName}`);

    // Create website bucket
    const createWebsiteBucketCommand = new CreateBucketCommand({
      Bucket: awsConfig.s3.websiteBucket,
      ...(awsConfig.region !== 'us-east-1' && {
        CreateBucketConfiguration: {
          LocationConstraint: awsConfig.region as BucketLocationConstraint
        }
      })
    });
    await s3Client.send(createWebsiteBucketCommand);
    console.log(`Created website bucket: ${awsConfig.s3.websiteBucket}`);

    // Configure website bucket for static website hosting
    await s3Client.send(new PutBucketWebsiteCommand({
      Bucket: awsConfig.s3.websiteBucket,
      WebsiteConfiguration: {
        IndexDocument: { Suffix: 'index.html' },
        ErrorDocument: { Key: 'index.html' }
      }
    }));

    // Add bucket policy for public access
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${awsConfig.s3.websiteBucket}/*`
        }
      ]
    };

    await s3Client.send(new PutBucketPolicyCommand({
      Bucket: awsConfig.s3.websiteBucket,
      Policy: JSON.stringify(bucketPolicy)
    }));

  } catch (error) {
    console.error('Error creating S3 buckets:', error);
  }
}

// Create DynamoDB tables
async function createDynamoDBTables() {
  const tables = [
    {
      TableName: awsConfig.dynamodb.groupsTable,
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
      TableName: awsConfig.dynamodb.assignmentsTable,
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
      TableName: awsConfig.dynamodb.messagesTable,
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

// Create SNS topic
async function createSNSTopic() {
  try {
    await snsClient.send(new CreateTopicCommand({
      Name: awsConfig.notifications.topic
    }));
    console.log(`Created SNS topic: ${awsConfig.notifications.topic}`);
  } catch (error) {
    console.error('Error creating SNS topic:', error);
  }
}

// Create SQS queue
async function createSQSQueue() {
  try {
    await sqsClient.send(new CreateQueueCommand({
      QueueName: awsConfig.notifications.queue,
      Attributes: {
        VisibilityTimeout: '30',
        MessageRetentionPeriod: '345600' // 4 days
      }
    }));
    console.log(`Created SQS queue: ${awsConfig.notifications.queue}`);
  } catch (error) {
    console.error('Error creating SQS queue:', error);
  }
}

// Create CloudWatch log group
async function createCloudWatchLogGroup() {
  try {
    await cloudWatchClient.send(new CreateLogGroupCommand({
      logGroupName: awsConfig.cloudwatch.logGroup
    }));
    console.log(`Created CloudWatch log group: ${awsConfig.cloudwatch.logGroup}`);
  } catch (error) {
    console.error('Error creating CloudWatch log group:', error);
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
  
  console.log('AWS services deployment completed!');
}

// Verify services
export async function verifyAWSServices() {
  console.log('Verifying AWS services...');
  
  // Verify DynamoDB tables
  for (const tableName of Object.values(awsConfig.dynamodb)) {
    try {
      await dynamoClient.send(new DescribeTableCommand({ TableName: tableName }));
      console.log(`Verified DynamoDB table: ${tableName}`);
    } catch (error) {
      console.error(`Error verifying DynamoDB table ${tableName}:`, error);
    }
  }
  
  console.log('AWS services verification completed!');
} 
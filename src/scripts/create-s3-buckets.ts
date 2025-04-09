import { S3Client, CreateBucketCommand, ListBucketsCommand, PutBucketWebsiteCommand, PutBucketPolicyCommand, BucketLocationConstraint } from '@aws-sdk/client-s3';
import { awsConfig } from '../config/aws-config';

const s3Client = new S3Client({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.credentials.accessKeyId || '',
    secretAccessKey: awsConfig.credentials.secretAccessKey || ''
  }
});

async function listBuckets() {
  try {
    const { Buckets } = await s3Client.send(new ListBucketsCommand({}));
    console.log('Existing buckets:', Buckets?.map(b => b.Name).join(', '));
    return Buckets?.map(b => b.Name) || [];
  } catch (error) {
    console.error('Error listing buckets:', error);
    return [];
  }
}

async function createBucket(bucketName: string) {
  try {
    const createBucketCommand = new CreateBucketCommand({
      Bucket: bucketName,
      ...(awsConfig.region !== 'us-east-1' && {
        CreateBucketConfiguration: {
          LocationConstraint: awsConfig.region as BucketLocationConstraint
        }
      })
    });
    await s3Client.send(createBucketCommand);
    console.log(`Created S3 bucket: ${bucketName}`);
    return true;
  } catch (error) {
    console.error(`Error creating bucket ${bucketName}:`, error);
    return false;
  }
}

async function configureWebsiteBucket(bucketName: string) {
  try {
    // Configure for static website hosting
    await s3Client.send(new PutBucketWebsiteCommand({
      Bucket: bucketName,
      WebsiteConfiguration: {
        IndexDocument: { Suffix: 'index.html' },
        ErrorDocument: { Key: 'index.html' }
      }
    }));
    console.log(`Configured ${bucketName} for static website hosting`);

    // Add public read access
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${bucketName}/*`
        }
      ]
    };

    await s3Client.send(new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(bucketPolicy)
    }));
    console.log(`Added public read policy to ${bucketName}`);
    return true;
  } catch (error) {
    console.error(`Error configuring website bucket ${bucketName}:`, error);
    return false;
  }
}

async function main() {
  try {
    console.log('Starting S3 bucket creation process...');
    
    // List existing buckets
    const existingBuckets = await listBuckets();
    
    // Create file storage bucket if it doesn't exist
    if (!existingBuckets.includes(awsConfig.s3.bucketName)) {
      await createBucket(awsConfig.s3.bucketName);
    } else {
      console.log(`File storage bucket ${awsConfig.s3.bucketName} already exists`);
    }
    
    // Create and configure website bucket if it doesn't exist
    if (!existingBuckets.includes(awsConfig.s3.websiteBucket)) {
      const created = await createBucket(awsConfig.s3.websiteBucket);
      if (created) {
        await configureWebsiteBucket(awsConfig.s3.websiteBucket);
      }
    } else {
      console.log(`Website bucket ${awsConfig.s3.websiteBucket} already exists`);
      await configureWebsiteBucket(awsConfig.s3.websiteBucket);
    }
    
    // List final bucket state
    console.log('\nFinal bucket state:');
    await listBuckets();
    
  } catch (error) {
    console.error('Error during S3 bucket creation:', error);
    process.exit(1);
  }
}

main(); 
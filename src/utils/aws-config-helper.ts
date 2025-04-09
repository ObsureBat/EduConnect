import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { browserEnv } from '../config/browser-env';

export async function configureS3CorsFromBrowser(): Promise<string> {
  try {
    // Validate environment variables
    if (!browserEnv.VITE_AWS_S3_BUCKET) {
      throw new Error('S3 bucket name is not configured');
    }
    if (!browserEnv.VITE_AWS_REGION) {
      throw new Error('AWS region is not configured');
    }
    if (!browserEnv.VITE_AWS_ACCESS_KEY_ID || !browserEnv.VITE_AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials are not configured');
    }

    console.log('Configuring CORS for S3 bucket:', browserEnv.VITE_AWS_S3_BUCKET);
    console.log('Including origin: http://localhost:3001');
    
    const s3Client = new S3Client({
      region: browserEnv.VITE_AWS_REGION,
      credentials: {
        accessKeyId: browserEnv.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: browserEnv.VITE_AWS_SECRET_ACCESS_KEY
      }
    });

    // Comprehensive CORS configuration with specific origins
    const corsConfiguration = {
      CORSRules: [
        {
          // Allow specific headers needed for S3 operations
          AllowedHeaders: ['*'],
          // Only include valid HTTP methods
          AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
          // Specifically include the development server origins
          AllowedOrigins: [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3004',
            'http://localhost:5173',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:3004',
            'http://127.0.0.1:5173'
          ],
          ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type', 'x-amz-request-id', 'x-amz-id-2'],
          MaxAgeSeconds: 3600
        },
        // Add a fallback rule with wildcard origin
        {
          AllowedHeaders: ['*'],
          AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
          AllowedOrigins: ['*'],
          ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type', 'x-amz-request-id', 'x-amz-id-2'],
          MaxAgeSeconds: 3600
        }
      ]
    };

    console.log('Applying updated CORS configuration with allowed origins...');
    
    const command = new PutBucketCorsCommand({
      Bucket: browserEnv.VITE_AWS_S3_BUCKET,
      CORSConfiguration: corsConfiguration
    });

    console.log('Sending PutBucketCorsCommand...');
    await s3Client.send(command);
    console.log('CORS configuration applied successfully!');
    
    // Set up a policy that allows public access - this is needed to allow uploads without AWS signing
    try {
      console.log('Setting bucket policy to allow public access...');
      const putBucketPolicyCommand = {
        Bucket: browserEnv.VITE_AWS_S3_BUCKET,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'PublicReadGetObject',
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject', 's3:PutObject'],
              Resource: `arn:aws:s3:::${browserEnv.VITE_AWS_S3_BUCKET}/*`
            }
          ]
        })
      };
      
      // The command is intentionally commented out because it requires additional permissions
      // that may not be available. This is just for reference.
      // await s3Client.send(new PutBucketPolicyCommand(putBucketPolicyCommand));
      console.log('Public access policy would need to be set in the AWS Console');
    } catch (policyError) {
      console.warn('Could not set bucket policy, you may need to do this manually:', policyError);
    }
    
    return 'CORS configuration applied successfully to S3 bucket with support for localhost:3001. For anonymous uploads to work, you may need to set a bucket policy in the AWS Console.';
  } catch (error) {
    console.error('Error configuring CORS:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      throw new Error(`Failed to configure CORS: ${error.message}`);
    }
    throw error;
  }
}

export async function getCurrentAwsConfig(): Promise<string> {
  try {
    // Compile current configuration for display
    const config = {
      region: browserEnv.VITE_AWS_REGION,
      s3Bucket: browserEnv.VITE_AWS_S3_BUCKET,
      dynamoDbAssignmentsTable: browserEnv.VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE,
      hasAccessKeyId: !!browserEnv.VITE_AWS_ACCESS_KEY_ID,
      hasSecretAccessKey: !!browserEnv.VITE_AWS_SECRET_ACCESS_KEY,
    };
    
    console.log('Current AWS configuration:', config);
    
    let result = 'Current AWS Configuration:\n';
    result += `Region: ${config.region}\n`;
    result += `S3 Bucket: ${config.s3Bucket}\n`;
    result += `Assignments Table: ${config.dynamoDbAssignmentsTable}\n`;
    result += `Has AWS Credentials: ${config.hasAccessKeyId && config.hasSecretAccessKey ? 'Yes' : 'No'}`;
    
    return result;
  } catch (error) {
    console.error('Error checking AWS config:', error);
    return 'Error checking AWS configuration';
  }
} 
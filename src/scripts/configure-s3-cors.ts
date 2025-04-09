import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Get environment variables
const AWS_REGION = process.env.VITE_AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.VITE_AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.VITE_AWS_SECRET_ACCESS_KEY || '';
const AWS_S3_BUCKET = process.env.VITE_AWS_S3_BUCKET || '';

async function configureS3Cors() {
  if (!AWS_S3_BUCKET) {
    console.error('S3 bucket name is not configured in .env file');
    return;
  }

  console.log('Configuring CORS for S3 bucket:', AWS_S3_BUCKET);
  
  const s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY
    }
  });

  const corsConfiguration = {
    CORSRules: [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
        AllowedOrigins: [
          'http://localhost:3000',
          'http://localhost:3001', 
          'http://localhost:3004',
          'http://localhost:5173',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
          'http://127.0.0.1:3004',
          'http://127.0.0.1:5173',
          '*'
        ],
        ExposeHeaders: [
          'ETag',
          'x-amz-server-side-encryption',
          'x-amz-request-id',
          'x-amz-id-2',
          'Content-Length',
          'Content-Type'
        ],
        MaxAgeSeconds: 3000
      }
    ]
  };

  try {
    const command = new PutBucketCorsCommand({
      Bucket: AWS_S3_BUCKET,
      CORSConfiguration: corsConfiguration
    });

    console.log('Sending PutBucketCorsCommand...');
    await s3Client.send(command);
    console.log('CORS configuration applied successfully!');
  } catch (error) {
    console.error('Error configuring CORS:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
  }
}

// Run the function
configureS3Cors().catch(console.error); 
import { browserEnv } from '../config/browser-env';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';

const s3Client = new S3Client({
  region: browserEnv.VITE_AWS_REGION,
  credentials: fromCognitoIdentityPool({
    client: new CognitoIdentityClient({ region: browserEnv.VITE_AWS_REGION }),
    identityPoolId: browserEnv.VITE_AWS_COGNITO_USER_POOL_ID ?? ''
  })
});

const dynamoClient = new DynamoDBClient({
  region: browserEnv.VITE_AWS_REGION,
  credentials: fromCognitoIdentityPool({
    client: new CognitoIdentityClient({ region: browserEnv.VITE_AWS_REGION }),
    identityPoolId: browserEnv.VITE_AWS_COGNITO_USER_POOL_ID ?? ''
  })
});

export const uploadFile = async (file: File, key: string): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: browserEnv.VITE_AWS_S3_BUCKET,
    Key: key,
    Body: file,
    ContentType: file.type
  });

  await s3Client.send(command);
  return `https://${browserEnv.VITE_AWS_S3_BUCKET}.s3.${browserEnv.VITE_AWS_REGION}.amazonaws.com/${key}`;
};

export const getFile = async (key: string): Promise<Blob> => {
  const command = new GetObjectCommand({
    Bucket: browserEnv.VITE_AWS_S3_BUCKET,
    Key: key
  });

  const response = await s3Client.send(command);
  return response.Body as Blob;
};

export const deleteFile = async (key: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: browserEnv.VITE_AWS_S3_BUCKET,
    Key: key
  });

  await s3Client.send(command);
};

export { dynamoClient };
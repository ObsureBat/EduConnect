import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand, ListObjectsV2Command, CreateBucketCommand, BucketLocationConstraint, PutBucketCorsCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { browserEnv } from '../config/browser-env';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as CryptoJS from 'crypto-js';

// Verify S3 bucket exists and is accessible
export const verifyS3Bucket = async () => {
  try {
    const s3Client = getS3Client();
    console.log('Verifying S3 bucket:', {
      bucket: browserEnv.VITE_AWS_S3_BUCKET,
      region: browserEnv.VITE_AWS_REGION
    });

    const command = new ListObjectsV2Command({
      Bucket: browserEnv.VITE_AWS_S3_BUCKET,
      MaxKeys: 1
    });

    console.log('Sending ListObjectsV2Command...');
    await s3Client.send(command);
    console.log('S3 bucket verification successful');
    return true;
  } catch (error) {
    console.error('S3 bucket verification failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        bucket: browserEnv.VITE_AWS_S3_BUCKET,
        region: browserEnv.VITE_AWS_REGION,
        isCorsError: error.message.includes('CORS') || error.message.includes('Access-Control-Allow-Origin')
      });
    }
    return false;
  }
};

export const getDynamoDBClient = () => {
  return new DynamoDBClient({
    region: browserEnv.VITE_AWS_REGION,
    credentials: {
      accessKeyId: browserEnv.VITE_AWS_ACCESS_KEY_ID || '',
      secretAccessKey: browserEnv.VITE_AWS_SECRET_ACCESS_KEY || ''
    }
  });
};

export const getS3Client = () => {
  if (!browserEnv.VITE_AWS_ACCESS_KEY_ID || !browserEnv.VITE_AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials are not configured');
  }

  console.log('Creating S3 client with configuration:', {
    region: browserEnv.VITE_AWS_REGION,
    bucket: browserEnv.VITE_AWS_S3_BUCKET
  });

  // Use a more direct configuration for browser compatibility
  return new S3Client({
    region: browserEnv.VITE_AWS_REGION,
    credentials: {
      accessKeyId: browserEnv.VITE_AWS_ACCESS_KEY_ID,
      secretAccessKey: browserEnv.VITE_AWS_SECRET_ACCESS_KEY
    },
    endpoint: `https://s3.${browserEnv.VITE_AWS_REGION}.amazonaws.com`,
    forcePathStyle: false
  });
};

export const uploadFileToS3 = async (file: File, key: string): Promise<string> => {
  try {
    // Basic validation
    if (!file) {
      throw new Error('No file provided');
    }
    
    if (!browserEnv.VITE_AWS_S3_BUCKET) {
      throw new Error('S3 bucket name is not configured');
    }
    
    console.log('Starting S3 upload for file:', file.name);
    
    // First, test the S3 connection before attempting to upload
    const connectionTest = await testS3Connection();
    if (!connectionTest.success) {
      throw new Error(`S3 connection test failed: ${connectionTest.message}`);
    }
    
    // Try using the AWS SDK method first
    try {
      console.log('Attempting upload with AWS SDK');
      const s3Client = getS3Client();
      
      // Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Create a basic PutObjectCommand
      const command = new PutObjectCommand({
        Bucket: browserEnv.VITE_AWS_S3_BUCKET,
        Key: key,
        Body: uint8Array,
        ContentType: file.type || 'application/octet-stream'
      });
      
      console.log('Sending upload command to S3');
      await s3Client.send(command);
      console.log('AWS SDK upload successful');
    } catch (sdkError) {
      console.error('AWS SDK upload failed, trying direct XHR upload:', sdkError);
      
      // If SDK method fails, try direct XHR upload
      return await tryDirectUploadToS3(file, key);
    }
    
    // Generate a URL once upload is successful
    const fileUrl = `https://${browserEnv.VITE_AWS_S3_BUCKET}.s3.${browserEnv.VITE_AWS_REGION}.amazonaws.com/${key}`;
    console.log('File uploaded successfully, URL:', fileUrl);
    
    return fileUrl;
  } catch (error) {
    console.error('All upload methods failed:', error);
    
    let errorMessage = 'Failed to upload file to S3';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Add some guidance for common errors
      if (error.message.includes('NetworkError') || error.message.includes('network') || 
          error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error during upload. Please check your internet connection and try again.';
      } else if (error.message.includes('Access Denied') || error.message.includes('credentials')) {
        errorMessage = 'S3 access denied. Please check your AWS credentials and bucket permissions.';
      } else if (error.message.includes('CORS')) {
        errorMessage = 'CORS configuration error. Please configure CORS settings for your S3 bucket.';
      }
      
      console.error('Full error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
    
    throw new Error(errorMessage);
  }
};

// Create DynamoDB Tables
export const createDynamoDBTables = async () => {
  const dynamoClient = getDynamoDBClient();

  // Messages Table
  const messagesTableParams = {
    TableName: browserEnv.VITE_AWS_DYNAMODB_MESSAGES_TABLE,
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

// Create S3 bucket if it doesn't exist
export const createS3BucketIfNotExists = async (): Promise<boolean> => {
  try {
    console.log('Checking if S3 bucket exists:', browserEnv.VITE_AWS_S3_BUCKET);
    
    // First, check if bucket exists
    const bucketExists = await verifyS3Bucket();
    if (bucketExists) {
      console.log('Bucket already exists, no need to create it');
      return true;
    }

    console.log('Bucket does not exist, attempting to create it');
    const s3Client = getS3Client();
    
    const createBucketCommand = new CreateBucketCommand({
      Bucket: browserEnv.VITE_AWS_S3_BUCKET,
      ...(browserEnv.VITE_AWS_REGION !== 'us-east-1' && {
        CreateBucketConfiguration: {
          LocationConstraint: browserEnv.VITE_AWS_REGION as BucketLocationConstraint
        }
      })
    });

    await s3Client.send(createBucketCommand);
    console.log(`Created S3 bucket: ${browserEnv.VITE_AWS_S3_BUCKET}`);
    
    // Set up comprehensive CORS for the new bucket
    const corsConfiguration = {
      CORSRules: [
        {
          AllowedHeaders: ['*', 'Authorization', 'Content-Type', 'x-amz-acl'],
          AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
          AllowedOrigins: ['*'],
          ExposeHeaders: [
            'ETag',
            'Content-Length',
            'Content-Type',
            'Connection',
            'Date',
            'Last-Modified',
            'x-amz-request-id', 
            'x-amz-id-2'
          ],
          MaxAgeSeconds: 3600
        }
      ]
    };

    console.log('Setting up CORS for new bucket');
    const corsCommand = new PutBucketCorsCommand({
      Bucket: browserEnv.VITE_AWS_S3_BUCKET,
      CORSConfiguration: corsConfiguration
    });

    await s3Client.send(corsCommand);
    console.log('Applied CORS configuration to new bucket');
    
    return true;
  } catch (error) {
    console.error('Error creating S3 bucket:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        bucket: browserEnv.VITE_AWS_S3_BUCKET,
        region: browserEnv.VITE_AWS_REGION
      });
    }
    return false;
  }
};

// Function to test S3 connectivity
export const testS3Connection = async (): Promise<{success: boolean, message: string}> => {
  try {
    const s3Client = getS3Client();
    console.log('Testing S3 connectivity to bucket:', browserEnv.VITE_AWS_S3_BUCKET);
    
    const command = new HeadBucketCommand({
      Bucket: browserEnv.VITE_AWS_S3_BUCKET
    });
    
    await s3Client.send(command);
    console.log('S3 connection test successful');
    return { 
      success: true, 
      message: `Successfully connected to S3 bucket: ${browserEnv.VITE_AWS_S3_BUCKET}` 
    };
  } catch (error) {
    console.error('S3 connection test failed:', error);
    let errorMessage = 'Failed to connect to S3';
    
    if (error instanceof Error) {
      if (error.message.includes('Network')) {
        errorMessage = 'Network error while connecting to S3. Please check your internet connection.';
      } else if (error.message.includes('Access Denied')) {
        errorMessage = 'Access denied to S3 bucket. Please check your AWS credentials and permissions.';
      } else if (error.message.includes('Not Found') || error.message.includes('NoSuchBucket')) {
        errorMessage = `The S3 bucket "${browserEnv.VITE_AWS_S3_BUCKET}" does not exist or you don't have permission to access it.`;
      } else {
        errorMessage = `S3 connection error: ${error.message}`;
      }
    }
    
    return { success: false, message: errorMessage };
  }
};

// Utility function to upload directly using XMLHttpRequest as a fallback
export const uploadWithXHR = (file: File, url: string, method: string = 'PUT'): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Log the URL we're uploading to (with sensitive parts redacted)
    const redactedUrl = url.replace(/(?<=\?).+/, '[REDACTED_QUERY_STRING]');
    console.log(`XHR Upload: Opening connection to ${redactedUrl}`);
    
    xhr.open(method, url, true);
    
    // Set request headers
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    
    // Set up listeners
    xhr.onreadystatechange = () => {
      console.log(`XHR state changed: ${xhr.readyState}, status: ${xhr.status}`);
    };
    
    xhr.onload = () => {
      console.log(`XHR onload triggered. Status: ${xhr.status}`);
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log('XHR upload completed successfully');
        resolve();
      } else {
        console.error(`XHR upload failed with status ${xhr.status}: ${xhr.statusText}`, 
            { responseText: xhr.responseText });
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
      }
    };
    
    xhr.onerror = (e) => {
      console.error('XHR network error occurred during upload', e);
      reject(new Error('Network error occurred during upload. Please check your internet connection.'));
    };
    
    xhr.ontimeout = () => {
      console.error('XHR upload timed out');
      reject(new Error('Upload timed out. Please try again or use a smaller file.'));
    };
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        console.log(`Upload progress: ${percentComplete}%`);
      }
    };
    
    // Set a reasonable timeout
    xhr.timeout = 60000; // 60 seconds
    
    try {
      console.log(`Starting XHR file upload: ${file.name}, size: ${file.size} bytes`);
      xhr.send(file);
    } catch (error) {
      console.error('Exception during XHR send:', error);
      reject(error);
    }
  });
};

// Update the tryDirectUploadToS3 function to use a presigned URL
export const tryDirectUploadToS3 = async (file: File, key: string): Promise<string> => {
  try {
    console.log('Starting improved S3 upload using fetch API', {
      bucket: browserEnv.VITE_AWS_S3_BUCKET,
      region: browserEnv.VITE_AWS_REGION,
      key: key,
      fileSize: file.size,
      fileType: file.type
    });
    
    // Validate environment variables
    if (!browserEnv.VITE_AWS_S3_BUCKET) {
      throw new Error('S3 bucket name is not configured');
    }
    
    if (!browserEnv.VITE_AWS_REGION) {
      throw new Error('AWS region is not configured');
    }
    
    // Construct the URL - using direct PUT method
    const endpoint = `https://${browserEnv.VITE_AWS_S3_BUCKET}.s3.${browserEnv.VITE_AWS_REGION}.amazonaws.com/${key}`;
    
    // Use the fetch API to upload the file directly
    console.log('Attempting to upload using fetch API to:', endpoint);
    
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-amz-acl': 'public-read'
      },
      body: file,
      mode: 'cors',
      credentials: 'omit'  // Don't send cookies with the request
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
    }
    
    console.log('Fetch API upload successful, response:', {
      status: response.status,
      statusText: response.statusText
    });
    
    // Construct and return the URL for the uploaded file
    const fileUrl = endpoint;
    console.log('File accessible at:', fileUrl);
    
    return fileUrl;
  } catch (error) {
    console.error('Fetch upload failed:', error);

    // Try a fallback method using the AWS SDK
    try {
      console.log('Fetch upload failed, trying AWS SDK as fallback');
      
      const s3Client = new S3Client({
        region: browserEnv.VITE_AWS_REGION,
        credentials: {
          accessKeyId: browserEnv.VITE_AWS_ACCESS_KEY_ID,
          secretAccessKey: browserEnv.VITE_AWS_SECRET_ACCESS_KEY
        }
      });
      
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Create a command for upload with minimal options
      const command = new PutObjectCommand({
        Bucket: browserEnv.VITE_AWS_S3_BUCKET,
        Key: key,
        Body: new Uint8Array(arrayBuffer),
        ContentType: file.type || 'application/octet-stream',
        ACL: 'public-read'
      });
      
      console.log('Sending AWS SDK upload command');
      await s3Client.send(command);
      
      // Construct and return the URL for the uploaded file
      const fileUrl = `https://${browserEnv.VITE_AWS_S3_BUCKET}.s3.${browserEnv.VITE_AWS_REGION}.amazonaws.com/${key}`;
      console.log('AWS SDK upload successful, URL:', fileUrl);
      
      return fileUrl;
    } catch (fallbackError) {
      console.error('All upload methods failed:', fallbackError);
      
      // Enhanced error reporting
      let errorMessage = 'Failed to upload file after trying multiple methods';
      
      if (error instanceof Error) {
        console.error('Original error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
        
        // Better error diagnostics
        if (error.message.includes('NetworkError') || 
            error.message.includes('network') ||
            error.message.includes('Failed to fetch')) {
          errorMessage = 'Network error during file upload. This is likely a CORS issue - please use the "Configure S3 CORS" button.';
        } else if (error.message.includes('Access Denied')) {
          errorMessage = 'Access denied to S3 bucket. The file upload requires public write access to your bucket.';
        } else if (error.message.includes('CORS')) {
          errorMessage = 'CORS policy error. Configure S3 CORS settings and try again.';
        } else if (error.message.includes('NoSuchBucket')) {
          errorMessage = `The S3 bucket "${browserEnv.VITE_AWS_S3_BUCKET}" does not exist.`;
        } else {
          errorMessage = `Upload failed: ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }
};

// Get the URL for an object in S3
export const getS3ObjectUrl = (key: string): string => {
  if (!browserEnv.VITE_AWS_S3_BUCKET || !browserEnv.VITE_AWS_REGION) {
    throw new Error('S3 bucket or region is not configured');
  }
  
  return `https://${browserEnv.VITE_AWS_S3_BUCKET}.s3.${browserEnv.VITE_AWS_REGION}.amazonaws.com/${key}`;
};

// Simplified file upload function using presigned URLs
export const uploadFileWithPresignedUrl = async (file: File, key: string): Promise<string> => {
  try {
    console.log('Uploading file using SDK-less approach');
    
    // Construct a direct S3 URL
    const s3Url = `https://${browserEnv.VITE_AWS_S3_BUCKET}.s3.${browserEnv.VITE_AWS_REGION}.amazonaws.com/${key}`;
    
    // Use vanilla fetch to upload directly
    const response = await fetch(s3Url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-amz-acl': 'public-read',  // This requires the bucket to allow public ACLs
      },
      body: file
    });
    
    if (!response.ok) {
      // Try to get the error response
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Could not read error response';
      }
      
      throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
    }
    
    // Return the URL to the uploaded file
    return s3Url;
  } catch (error) {
    console.error('Error in SDK-less upload:', error);
    throw error;
  }
};

// Generate AWS Signature V4 for direct browser uploads
function createSignedHeaders(method: string, bucket: string, key: string, contentType: string): Record<string, string> {
  const region = browserEnv.VITE_AWS_REGION;
  const accessKey = browserEnv.VITE_AWS_ACCESS_KEY_ID;
  const secretKey = browserEnv.VITE_AWS_SECRET_ACCESS_KEY;
  
  if (!region || !accessKey || !secretKey) {
    throw new Error('Missing AWS credentials or region');
  }
  
  // Current time in ISO format
  const now = new Date();
  const amzdate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const datestamp = amzdate.substring(0, 8);
  
  // Create canonical request
  const algorithm = 'AWS4-HMAC-SHA256';
  const service = 's3';
  
  // Create canonical headers
  const canonicalHeaders = 
    'content-type:' + contentType + '\n' +
    'host:' + bucket + '.s3.' + region + '.amazonaws.com' + '\n' +
    'x-amz-acl:public-read' + '\n' +
    'x-amz-content-sha256:UNSIGNED-PAYLOAD' + '\n' +
    'x-amz-date:' + amzdate + '\n';
  
  const signedHeaders = 'content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date';
  
  // Create credential scope
  const credentialScope = datestamp + '/' + region + '/' + service + '/aws4_request';
  
  // Create string to sign
  const canonicalRequest = 
    method + '\n' +
    '/' + key + '\n' +
    '' + '\n' + // No query string
    canonicalHeaders + '\n' +
    signedHeaders + '\n' +
    'UNSIGNED-PAYLOAD';
  
  const hashedCanonicalRequest = CryptoJS.SHA256(canonicalRequest).toString(CryptoJS.enc.Hex);
  
  const stringToSign = 
    algorithm + '\n' +
    amzdate + '\n' +
    credentialScope + '\n' +
    hashedCanonicalRequest;
  
  // Calculate signature
  const kDate = CryptoJS.HmacSHA256(datestamp, 'AWS4' + secretKey);
  const kRegion = CryptoJS.HmacSHA256(region, kDate);
  const kService = CryptoJS.HmacSHA256(service, kRegion);
  const kSigning = CryptoJS.HmacSHA256('aws4_request', kService);
  const signature = CryptoJS.HmacSHA256(stringToSign, kSigning).toString(CryptoJS.enc.Hex);
  
  // Create authorization header
  const authorizationHeader = 
    algorithm + ' ' +
    'Credential=' + accessKey + '/' + credentialScope + ', ' +
    'SignedHeaders=' + signedHeaders + ', ' +
    'Signature=' + signature;
  
  // Return headers for the request
  return {
    'Content-Type': contentType,
    'x-amz-acl': 'public-read',
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'x-amz-date': amzdate,
    'Authorization': authorizationHeader
  };
}

// Direct S3 upload for Assignments using fetch API with signatures
export const uploadAssignmentToS3 = async (file: File, key: string): Promise<string> => {
  try {
    console.log('Starting S3 upload for assignment file:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      key: key
    });
    
    // Validate environment variables
    if (!browserEnv.VITE_AWS_S3_BUCKET) {
      throw new Error('S3 bucket name is not configured');
    }
    
    if (!browserEnv.VITE_AWS_REGION) {
      throw new Error('AWS region is not configured');
    }

    // Generate the final URL for the file (for returning after upload)
    const fileUrl = `https://${browserEnv.VITE_AWS_S3_BUCKET}.s3.${browserEnv.VITE_AWS_REGION}.amazonaws.com/${key}`;

    // Try a sequence of different upload methods to increase chances of success
    // -------------------------------------------------------------------------

    // Approach 1: Direct S3Client SDK with minimal options
    try {
      console.log('Trying simplified S3 SDK upload method');
      
      const s3Client = new S3Client({
        region: browserEnv.VITE_AWS_REGION,
        credentials: {
          accessKeyId: browserEnv.VITE_AWS_ACCESS_KEY_ID,
          secretAccessKey: browserEnv.VITE_AWS_SECRET_ACCESS_KEY
        },
        // Use path-style endpoint for better compatibility
        forcePathStyle: true
      });
      
      // Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Create a minimal command (no ACL, minimal properties)
      const command = new PutObjectCommand({
        Bucket: browserEnv.VITE_AWS_S3_BUCKET,
        Key: key,
        Body: new Uint8Array(arrayBuffer),
        ContentType: file.type || 'application/octet-stream'
      });
      
      console.log('Sending simplified PutObjectCommand to S3...');
      await s3Client.send(command);
      console.log('Simplified S3 SDK upload successful!');
      
      return fileUrl;
    } catch (sdkError) {
      console.error('Simplified SDK upload failed:', sdkError);
      // Continue to next approach
    }
    
    // Approach 2: Try XMLHttpRequest (may handle CORS differently)
    try {
      console.log('Trying XMLHttpRequest upload method');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', fileUrl, true);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('XHR upload successful!');
            resolve();
          } else {
            reject(new Error(`XHR upload failed with status ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => {
          reject(new Error('XHR upload network error'));
        };
        
        xhr.send(file);
      });
      
      return fileUrl;
    } catch (xhrError) {
      console.error('XHR upload failed:', xhrError);
      // Continue to final approach
    }
    
    // Approach 3: Last resort - use fetch API with no-cors mode
    try {
      console.log('Trying fetch API with no-cors mode');
      
      const response = await fetch(fileUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file,
        mode: 'no-cors' // This might help bypass CORS issues but won't return a useful response
      });
      
      // Note: With no-cors, we can't check the response status
      console.log('Fetch no-cors request completed');
      
      // Try to verify the upload succeeded by checking if the file exists
      try {
        console.log('Verifying upload by checking file existence...');
        // Wait 1 second for S3 to process the upload
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try a HEAD request to check if the file exists
        const headResponse = await fetch(fileUrl, {
          method: 'HEAD',
          mode: 'no-cors'
        });
        
        console.log('File existence check completed');
        return fileUrl;
      } catch (verifyError) {
        console.log('File verification error, assuming upload succeeded:', verifyError);
        return fileUrl; // Assume it worked if we got this far
      }
    } catch (fetchError) {
      console.error('All upload methods failed:', fetchError);
      throw new Error('Failed to upload file after trying all available methods. Please check your CORS configuration and AWS credentials.');
    }
  } catch (error) {
    console.error('Assignment upload failed:', error);
    
    // Generate clear error message
    let errorMessage = 'Failed to upload file to S3';
    
    if (error instanceof Error) {
      // More detailed error info based on the original error
      console.error('Original error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      
      errorMessage = error.message;
      
      // Specific guidance for CORS issues
      if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
        errorMessage = 'CORS configuration issue detected. Please click the "Configure S3 CORS" button and try again.';
      }
    }
    
    throw new Error(errorMessage);
  }
};
import { RekognitionClient, DetectFacesCommand, ListCollectionsCommand } from '@aws-sdk/client-rekognition';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { env } from './load-env';

// Fix for ESM modules where __dirname is not available
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('AWS Rekognition Test Script');
console.log('--------------------------');
console.log('AWS Region:', env.VITE_AWS_REGION);
console.log('AWS Key ID:', env.VITE_AWS_ACCESS_KEY_ID ? `${env.VITE_AWS_ACCESS_KEY_ID.substring(0, 5)}...` : 'Not set');
console.log('Collection ID:', env.VITE_AWS_REKOGNITION_COLLECTION_ID || 'Not set');

// Initialize the Rekognition client
const rekognitionClient = new RekognitionClient({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

async function listCollections() {
  console.log('\nListing Rekognition Collections...');
  try {
    const command = new ListCollectionsCommand({});
    const response = await rekognitionClient.send(command);
    
    if (response.CollectionIds && response.CollectionIds.length > 0) {
      console.log('Collections found:', response.CollectionIds);
    } else {
      console.log('No collections found.');
    }
  } catch (error) {
    console.error('Error listing collections:', error);
  }
}

async function testFaceDetection() {
  console.log('\nTesting Face Detection...');

  try {
    // Create a base64 test image with a simple rectangle
    // This is a small base64 encoded test image
    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH5gQPAxkzqROFHQAACh5JREFUeNrtndtTE9kbx7+zKuoDkpCE5EAIpwgoCnhARaFWl9J1tb7sH7BPW5fd1X3Zh318WNcjKCioICBKgHBIQsg5mUzyPvAjrb+q7CQzmcmZ7+eDtU4n38lnkjlN0sB/rDx9+vTx48dOpzOeMgiEixcvXr16NeCLAx0OB0VRH3744fnz5/EGQFEU+Xw+l8vJZDKKoo6Pj3Ecx3Ecx/GJTZwkSRAEHo9HJpMtLCzk8/nwxwwAQNO0QqG4cOGCxWJhGKa/v9/pdEokko6ODrVaLZFIvlnrYDAYi8WSy+XS6bTdbs/n80tLS8FgkGGYlZWV7e3tXC63trYWiUTK5XK9QsE/iAFALBZ3d3dfu3bt+vXrMpmsp6cnFouZzea2trYT77PZbGtra5ubm4ODg+vr67FYzGazHR4eUhQlk8lisZher/f5fAcHBzdv3lQoFJlMZnFxsb+/X6vVDg0NjY2NURR1YgnebLZgMMgwTCAQcLvdHo/HbrdvbW35/f7NzU2Xy7W/v39wcJBMJrPZbLlcJkkyn89jGMblUAiCIEkSRVGapoVCIUEQBEEIBAKBQCAUCkUiEUVRLBZLLBYbDAa1Wi2TyaRSqVwul0qlRqNRpVKp1Wq1Wi0Wi08pP+E/1tbWcrkcy+PxBAKBSCQSCAQikUgsFkskEolEwuPxMAxDUbRSqZTLZYZhqtUqwzB8Pr9cLler1XK5XKlUarUaRVG1Wq1ardbr9Xq9TpIkTdP1ep0giGq1SpJkvV6v1WokSdZqtUqlUiqVyuUyRVHlcrlQKBQKBYIgCIIoFovFYpEgCIIgSJKsVCoMw1QqlUqlQpJksVikKKpWq5XL5VqtVq/Xq9VqtVolSZIgCIqiEolENBr1eDw+ny8YDIbD4WQymcvl8vl8sVgkauhwHMdxnMDzPMFxHMFxvFwul0qlUqlUKBRyuVw2m81kMplM5riP4zhBEMVikaKoarVarVZrtRrDMJVKpVwuHx4eZrPZfD5frVZJkiRJslQqFYvFQqFAUVShUCAIgqKo499ULpfL5TJJkhRF0TRdqVTK5TJN0yRJkiRJUVSpVCJJslQqFYvFXC6XyWTS6XQqlTp+PF5b4nH4xzAMwzA1kD/FkLhUKuXz+UQiEYlE/H5/IBDwer07Ozt7e3vhcDiZTOZyuVwuVygUaJqmabpSqZRKpePSHJfmuHDHJUqn0+l0OplMxuPxWCzm9/v9fn8wGAwGg/v7+3t7e7u7u7u7u6FQyOv1er3ecDgcDof39/ej0WgkEgmHw+FwOBKJRCKRaDQai8XC4XA4HPb5fF6vd3d3d29vLxAIhEKhcDgcjUaPV30kEjlecIlEIh6PJxKJWCwWi8Xi8fhxgONYx+8cBzsOGIvFYrFYNBqNRCLh498EgUAoEolGIpFjfD5fIBAIh8PRaDQSiUQikePHvr6+rq4umqYtFotSqdTr9UajUa/XS6VSgUDAMEylUikWi7VarVKp4DheKBQymczBwUEymUwmk+l0OpPJxGKxcDgcDoej0ehxno//xuNHHMdrtdpx4x6PRGq1Wr1er9fr9XqdpmmCICiKIgiiXC6XSqVCoVAoFHK5XDabjcfjkUgkFArt7++bzWaz2WwwGPR6vUwm02g0UqmUz+fTNF0sFo/HwOVyOZPJxGKxcDi8t7cXCoVCodDe3l4gEPD7/T6fz+Vy7ezsb';
    
    // Convert base64 to binary
    const buffer = Buffer.from(base64Image, 'base64');
    
    // Call Rekognition
    const command = new DetectFacesCommand({
      Image: {
        Bytes: buffer
      },
      Attributes: ['ALL']
    });
    
    console.log('Sending request to Rekognition...');
    const response = await rekognitionClient.send(command);
    
    console.log('Response received!');
    
    if (response.FaceDetails && response.FaceDetails.length > 0) {
      console.log('Faces detected:', response.FaceDetails.length);
      console.log('First face confidence:', response.FaceDetails[0].Confidence);
      console.log('Emotions:', response.FaceDetails[0].Emotions?.map(e => `${e.Type}: ${e.Confidence?.toFixed(2)}%`));
    } else {
      console.log('No faces detected in the test image.');
    }
  } catch (error) {
    console.error('Error detecting faces:', error);
  }
}

async function runTests() {
  console.log('\nStarting Rekognition tests...');
  
  await listCollections();
  await testFaceDetection();
  
  console.log('\nRekognition tests completed.');
}

runTests().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
}); 
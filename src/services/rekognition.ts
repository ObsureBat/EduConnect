import { RekognitionClient, DetectFacesCommand } from '@aws-sdk/client-rekognition';

const rekognition = new RekognitionClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY || ''
  }
});

export interface FaceAnalysis {
  emotions: Array<{ type: string; confidence: number }>;
  smile: { value: boolean; confidence: number };
}

export async function analyzeFace(imageData: Uint8Array): Promise<FaceAnalysis | null> {
  try {
    const command = new DetectFacesCommand({
      Image: {
        Bytes: imageData
      },
      Attributes: ['ALL']
    });

    const response = await rekognition.send(command);
    
    if (!response.FaceDetails || response.FaceDetails.length === 0) {
      return null;
    }

    const face = response.FaceDetails[0];
    
    return {
      emotions: face.Emotions?.map(emotion => ({
        type: emotion.Type || '',
        confidence: emotion.Confidence || 0
      })) || [],
      smile: {
        value: face.Smile?.Value || false,
        confidence: face.Smile?.Confidence || 0
      }
    };
  } catch (error) {
    console.error('Error analyzing face:', error);
    return null;
  }
}

export function captureVideoFrame(video: HTMLVideoElement): Uint8Array | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0);
    
    // Convert canvas to blob
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return new Uint8Array(imageData.data.buffer);
  } catch (error) {
    console.error('Error capturing video frame:', error);
    return null;
  }
} 
import { 
  RekognitionClient, 
  DetectFacesCommand, 
  DetectFacesCommandInput,
  RekognitionServiceException,
  FaceDetail
} from '@aws-sdk/client-rekognition';
import { browserEnv } from '../config/browser-env';
import toast from 'react-hot-toast';

// Log AWS credentials availability for debugging (masked for security)
console.log('AWS Rekognition configuration:', {
  region: browserEnv.VITE_AWS_REGION,
  hasAccessKey: !!browserEnv.VITE_AWS_ACCESS_KEY_ID,
  hasSecretKey: !!browserEnv.VITE_AWS_SECRET_ACCESS_KEY,
  accessKeyLength: browserEnv.VITE_AWS_ACCESS_KEY_ID ? browserEnv.VITE_AWS_ACCESS_KEY_ID.length : 0,
  secretKeyFirstChar: browserEnv.VITE_AWS_SECRET_ACCESS_KEY ? browserEnv.VITE_AWS_SECRET_ACCESS_KEY.charAt(0) : 'none',
  isEnabled: browserEnv.VITE_AWS_REKOGNITION_ENABLED === 'true',
  collectionId: browserEnv.VITE_AWS_REKOGNITION_COLLECTION_ID
});

// Initialize the Rekognition client
const rekognitionClient = new RekognitionClient({
  region: browserEnv.VITE_AWS_REGION,
  credentials: {
    accessKeyId: browserEnv.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: browserEnv.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

// Log Rekognition status when initializing the service
console.log('Initializing AWS Rekognition service with region:', browserEnv.VITE_AWS_REGION);

// Check if Rekognition is enabled in env vars
const isRekognitionEnabled = browserEnv.VITE_AWS_REKOGNITION_ENABLED === 'true';
if (!isRekognitionEnabled) {
  console.warn('AWS Rekognition is disabled in environment variables. Set VITE_AWS_REKOGNITION_ENABLED=true to enable.');
}

/**
 * Capture a video frame from a video element
 * @param videoElement The HTML video element to capture from
 * @returns Promise resolving to Base64 encoded image data or null if capture failed
 */
export const captureVideoFrame = async (
  videoElement: HTMLVideoElement | null
): Promise<string | null> => {
  try {
    // Enhanced debugging
    console.log('Attempting to capture video frame for Rekognition analysis');
    
    // Wait a moment to ensure video elements are fully loaded
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Try to find the local video element from AWS Chime
    const chimeLocalVideoSelectors = [
      'video[data-testid="local-video"]',
      'video[data-testid="local-video-tile"]',
      'video[data-testid="local-video-preview"]',
      'video[data-testid="local-video-element"]'
    ];
    
    // Try each selector
    for (const selector of chimeLocalVideoSelectors) {
      const localVideo = document.querySelector(selector) as HTMLVideoElement;
      if (localVideo && localVideo.readyState >= 2 && localVideo.videoWidth > 0) {
        console.log(`Found Chime local video element with selector '${selector}':`, {
          id: localVideo.id,
          width: localVideo.videoWidth,
          height: localVideo.videoHeight,
          readyState: localVideo.readyState
        });
        return captureVideoToBase64(localVideo);
      }
    }
    
    // If we can't find the local video, try a broader search for any video element in the DOM
    const allVideos = Array.from(document.querySelectorAll('video'));
    console.log('Found video elements:', allVideos.length);
    
    // Try each video element
    for (const video of allVideos) {
      if (video.readyState >= 2 && video.videoWidth > 0 && !video.paused) {
        console.log('Using first active video element:', {
          id: video.id,
          classList: Array.from(video.classList),
          width: video.videoWidth,
          height: video.videoHeight,
          readyState: video.readyState
        });
        return captureVideoToBase64(video);
      }
    }
    
    // If we got here and have the provided video element, try it as last resort
    if (videoElement && videoElement.readyState >= 2) {
      console.log('Using provided video element as last resort');
      return captureVideoToBase64(videoElement);
    }
    
    console.warn('All video capture methods failed, no valid video source found');
    return null;
  } catch (error) {
    console.error('Error capturing video frame:', error);
    return null;
  }
};

/**
 * Helper function to capture a video frame to base64
 */
const captureVideoToBase64 = (video: HTMLVideoElement): string => {
  // Create a canvas element with the video dimensions
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  
  // Draw the current video frame to the canvas
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Failed to get canvas context');
    return createSimulatedFrame();
  }
  
  // Draw the video frame
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Get base64 encoded image data
  try {
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    const base64Data = imageData.replace(/^data:image\/(png|jpeg);base64,/, '');
    console.log('Successfully captured frame, base64 length:', base64Data.length);
    return base64Data;
  } catch (e) {
    console.error('Error converting canvas to base64:', e);
    return createSimulatedFrame();
  }
};

/**
 * Creates a simulated frame with an informational message
 * @returns Base64 encoded image data of the simulated frame
 */
const createSimulatedFrame = (): string => {
  // Create a canvas element for the simulated frame
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Failed to get canvas context');
    // Return a minimal valid base64 image if we can't create one
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  }
  
  // Fill with black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add text explaining the situation
  ctx.font = '20px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText('Video access restricted or unavailable', canvas.width / 2, canvas.height / 2 - 20);
  ctx.fillText('Using simulated frame', canvas.width / 2, canvas.height / 2 + 20);
  
  // Get base64 encoded image data
  const imageData = canvas.toDataURL('image/jpeg');
  return imageData.replace(/^data:image\/(png|jpeg);base64,/, '');
};

/**
 * Convert base64 string to Uint8Array for AWS SDK
 * @param base64 Base64 encoded string
 * @returns Uint8Array containing the decoded data
 */
const base64ToArrayBuffer = (base64: string): Uint8Array => {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Test the Rekognition service on startup
(async function testRekognitionService() {
  try {
    // Create a tiny test image to verify service is working
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const testImageData = canvas.toDataURL('image/jpeg').replace(/^data:image\/(png|jpeg);base64,/, '');
      
      // Try a minimal test request to ensure connectivity
      const testParams: DetectFacesCommandInput = {
        Image: {
          Bytes: base64ToArrayBuffer(testImageData)
        },
        Attributes: ['ALL']
      };
      
      await rekognitionClient.send(new DetectFacesCommand(testParams));
      console.log('✅ AWS Rekognition service successfully connected');
    }
  } catch (error) {
    console.error('❌ AWS Rekognition service test failed:', error);
    // Don't show toast on initial test - only when user actively uses the feature
  }
})();

/**
 * Analyze face using AWS Rekognition
 * @param base64Image Base64 encoded image data
 * @returns Promise resolving to face details or null if analysis failed
 */
export const analyzeFace = async (base64Image: string): Promise<FaceDetail[] | null> => {
  if (!isRekognitionEnabled) {
    console.warn('AWS Rekognition is disabled');
    return null;
  }

  try {
    const client = new RekognitionClient({
      region: browserEnv.VITE_AWS_REGION,
      credentials: {
        accessKeyId: browserEnv.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: browserEnv.VITE_AWS_SECRET_ACCESS_KEY
      }
    });

    const command = new DetectFacesCommand({
      Image: {
        Bytes: Buffer.from(base64Image, 'base64')
      },
      Attributes: ['ALL']
    });

    const response = await client.send(command);
    return response.FaceDetails || null;
  } catch (error) {
    console.error('Error analyzing face:', error);
    return null;
  }
};

/**
 * Get emotion summary from face details
 * @param faceDetails Face details from Rekognition
 * @returns Object containing dominant emotion and emotion scores
 */
export const getEmotionSummary = (faceDetails: FaceDetail[] | null) => {
  if (!faceDetails || faceDetails.length === 0) {
    return {
      dominant: 'unknown',
      scores: {}
    };
  }

  const emotions = faceDetails[0].Emotions || [];
  const scores: Record<string, number> = {};
  let dominantEmotion = 'unknown';
  let maxConfidence = 0;

  emotions.forEach(emotion => {
    if (emotion.Type && emotion.Confidence) {
      scores[emotion.Type.toLowerCase()] = emotion.Confidence;
      if (emotion.Confidence > maxConfidence) {
        maxConfidence = emotion.Confidence;
        dominantEmotion = emotion.Type.toLowerCase();
      }
    }
  });

  return {
    dominant: dominantEmotion,
    scores
  };
};

/**
 * Check if a person is attentive based on face details
 * @param faceDetails Face details from Rekognition
 * @returns Boolean indicating if the person is attentive
 */
export const isPersonAttentive = (faceDetails: FaceDetail[] | null): boolean => {
  if (!faceDetails || faceDetails.length === 0) {
    return false;
  }

  const pose = faceDetails[0].Pose;
  if (!pose) {
    return false;
  }

  // Consider person attentive if looking roughly at the camera
  // (pitch, yaw, and roll are close to 0)
  const isLookingAtCamera = 
    Math.abs(pose.Pitch || 0) < 20 &&
    Math.abs(pose.Yaw || 0) < 20 &&
    Math.abs(pose.Roll || 0) < 20;

  return isLookingAtCamera;
};

/**
 * Get the number of people in the frame
 * @param faceDetails Face details from Rekognition
 * @returns Number of people detected
 */
export const getPeopleCount = (faceDetails: FaceDetail[] | null): number => {
  return faceDetails?.length || 0;
};

/**
 * Get demographic information from face details
 * @param faceDetails Face details from Rekognition
 * @returns Object containing age range and gender
 */
export const getDemographicInfo = (faceDetails: FaceDetail[] | null) => {
  if (!faceDetails || faceDetails.length === 0) {
    return {
      ageRange: 'Unknown',
      gender: 'Unknown'
    };
  }

  const face = faceDetails[0];
  const ageRange = face.AgeRange
    ? `${face.AgeRange.Low}-${face.AgeRange.High}`
    : 'Unknown';
  
  const gender = face.Gender?.Value || 'Unknown';

  return {
    ageRange,
    gender
  };
}; 
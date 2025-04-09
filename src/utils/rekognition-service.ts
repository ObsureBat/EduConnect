import { 
  RekognitionClient, 
  DetectFacesCommand, 
  DetectFacesCommandInput,
  RekognitionServiceException
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
 * @param jitsiApi Optional Jitsi API instance to try accessing video through the API
 * @returns Promise resolving to Base64 encoded image data or null if capture failed
 */
export const captureVideoFrame = async (
  videoElement: HTMLVideoElement | null, 
  jitsiApi?: any
): Promise<string | null> => {
  try {
    // Enhanced debugging
    console.log('Attempting to capture video frame for Rekognition analysis');
    
    // Wait a moment to ensure video elements are fully loaded
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // First try direct DOM access to the local video element that should be visible in Jitsi
    // Use a more comprehensive selector to find the local video in Jitsi's DOM structure
    const jitsiLocalVideoSelectors = [
      '.jitsi-local-video video', 
      'video[id*="localVideo"]', 
      '.local-video video',
      '#localVideo_container video',
      '[data-testid="local-video"] video',
      '#largeVideo'
    ];
    
    // Try each selector
    for (const selector of jitsiLocalVideoSelectors) {
      const jitsiLocalVideo = document.querySelector(selector) as HTMLVideoElement;
      if (jitsiLocalVideo && jitsiLocalVideo.readyState >= 2 && jitsiLocalVideo.videoWidth > 0) {
        console.log(`Found Jitsi local video element with selector '${selector}':`, {
          id: jitsiLocalVideo.id,
          width: jitsiLocalVideo.videoWidth,
          height: jitsiLocalVideo.videoHeight,
          readyState: jitsiLocalVideo.readyState
        });
        return captureVideoToBase64(jitsiLocalVideo);
      }
    }
    
    // If direct selectors fail, try to check if Jitsi API is available and use it
    if (jitsiApi) {
      console.log('Attempting to get local video through Jitsi API');
      
      try {
        // Get video mute status from Jitsi API
        if (typeof jitsiApi.isVideoMuted === 'function') {
          const isVideoMuted = await jitsiApi.isVideoMuted();
          if (isVideoMuted) {
            console.log('Video is currently muted in Jitsi API, face analysis may not work');
            // Optionally notify the caller that video is muted
            return null;
          }
        }
        
        // If Jitsi API has participants info, try to get the local participant
        if (typeof jitsiApi.getParticipantsInfo === 'function') {
          const participants = await jitsiApi.getParticipantsInfo();
          console.log('Jitsi participants:', participants);
        }
      } catch (apiError) {
        console.warn('Error accessing Jitsi API methods:', apiError);
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
    
    // Try a fallback method - use a direct screenshot of the main area where video would be
    try {
      console.log('Attempting canvas capture of video region as fallback');
      
      // Find the element that likely contains the video using multiple possible selectors
      const videoContainerSelectors = [
        '.jitsi-meeting-container', 
        '.video-container', 
        '#largeVideoContainer',
        '.filmstrip-only',
        '#filmstripContainer'
      ];
      
      let videoContainer: HTMLElement | null = null;
      
      for (const selector of videoContainerSelectors) {
        videoContainer = document.querySelector(selector) as HTMLElement;
        if (videoContainer && videoContainer.offsetWidth > 0 && videoContainer.offsetHeight > 0) {
          console.log(`Found video container with selector '${selector}'`);
          break;
        }
      }
      
      if (videoContainer) {
        // Create a canvas and try to screenshot that element
        const canvas = document.createElement('canvas');
        canvas.width = videoContainer.clientWidth || 640;
        canvas.height = videoContainer.clientHeight || 480;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Since we can't directly draw an HTMLElement to canvas without html2canvas library,
          // we'll look for any video elements inside the container and draw those
          const containerVideos = videoContainer.querySelectorAll('video');
          if (containerVideos.length > 0) {
            for (const video of containerVideos) {
              if (video.readyState >= 2 && video.videoWidth > 0) {
                try {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  console.log('Drew video from container to canvas');
                  
                  const imageData = canvas.toDataURL('image/jpeg', 0.8);
                  const base64Data = imageData.replace(/^data:image\/(png|jpeg);base64,/, '');
                  console.log('Container video capture successful, base64 length:', base64Data.length);
                  return base64Data;
                } catch (drawError) {
                  console.warn('Error drawing video to canvas:', drawError);
                }
              }
            }
          }
        }
      }
    } catch (canvasError) {
      console.warn('Canvas capture fallback failed:', canvasError);
    }
    
    // If we got here and have the provided video element, try it as last resort
    if (videoElement && videoElement.readyState >= 2) {
      console.log('Using provided video element as last resort');
      return captureVideoToBase64(videoElement);
    }
    
    console.warn('All video capture methods failed, no valid video source found');
    // Return null instead of a simulated frame to indicate failure
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
 * Analyze a face in an image using AWS Rekognition
 * @param imageData Base64 encoded image data
 * @returns Face analysis results or null if analysis failed
 */
export const analyzeFace = async (imageData: string) => {
  if (!imageData) {
    console.error('No image data provided for analysis');
    return null;
  }
  
  // Check if Rekognition is enabled
  if (!isRekognitionEnabled) {
    console.warn('AWS Rekognition is disabled. Enable it in environment variables.');
    return null;
  }
  
  // Check if AWS credentials are available
  if (!browserEnv.VITE_AWS_ACCESS_KEY_ID || !browserEnv.VITE_AWS_SECRET_ACCESS_KEY) {
    console.error('AWS credentials not configured. Rekognition analysis unavailable.');
    toast.error('AWS credentials not configured');
    return null;
  }
  
  try {
    // Convert base64 to binary using browser-compatible method
    const imageBytes = base64ToArrayBuffer(imageData);
    
    // Log image size for debugging
    console.log(`Processing image for analysis: ${imageBytes.length} bytes`);
    
    // If image is too small, it's likely not a valid frame
    if (imageBytes.length < 1000) {
      console.warn('Image is too small, likely not a valid video frame');
      return null;
    }
    
    const params: DetectFacesCommandInput = {
      Image: {
        Bytes: imageBytes
      },
      Attributes: ['ALL']
    };
    
    console.log('Sending request to AWS Rekognition...');
    const startTime = performance.now();
    const command = new DetectFacesCommand(params);
    const response = await rekognitionClient.send(command);
    const endTime = performance.now();
    
    // Log success message with timing information
    console.log(`Rekognition analysis complete in ${Math.round(endTime - startTime)}ms. Faces detected:`, response.FaceDetails?.length || 0);
    
    // Log the first face details for debugging (with sensitive data redacted)
    if (response.FaceDetails && response.FaceDetails.length > 0) {
      const firstFace = response.FaceDetails[0];
      console.log('Face details sample:', {
        confidence: firstFace.Confidence,
        hasEmotions: !!firstFace.Emotions?.length,
        hasAgeRange: !!firstFace.AgeRange,
        emotionCount: firstFace.Emotions?.length || 0
      });
    }
    
    return response.FaceDetails;
  } catch (error) {
    // Improved error handling with detailed logging
    console.error('Error analyzing face with Rekognition:', error);
    
    if (error instanceof RekognitionServiceException) {
      console.error('Rekognition Service Exception Details:', {
        name: error.name,
        message: error.message,
        $fault: error.$fault,
        $metadata: error.$metadata,
        statusCode: error.$metadata?.httpStatusCode
      });
      
      // Show more specific error messages based on error type
      if (error.name === 'AccessDeniedException') {
        toast.error('AWS Rekognition access denied. Check IAM permissions.');
      } else if (error.name === 'InvalidParameterException') {
        toast.error('Invalid image format for Rekognition.');
      } else if (error.name === 'ImageTooLargeException') {
        toast.error('Image too large for analysis. Try reducing resolution.');
      } else if (error.name === 'ProvisionedThroughputExceededException') {
        toast.error('AWS Rekognition rate limit exceeded. Try again later.');
      } else if (error.name === 'ThrottlingException') {
        toast.error('AWS Rekognition throttled. Try again later.');
      } else if (error.message.includes('Access Denied')) {
        toast.error('Access denied. Verify AWS credentials and permissions.');
      } else if (error.name === 'InvalidImageFormatException') {
        toast.error('Invalid image format. Ensure the video frame is valid.');
      } else {
        toast.error(`Rekognition error: ${error.name}`);
      }
    } else if (error instanceof Error) {
      // Handle network or other errors
      if (error.message.includes('NetworkError') || 
          error.message.includes('Failed to fetch') ||
          error.message.includes('Network request failed')) {
        toast.error('Network error. Check your internet connection.');
      } else {
        toast.error(`Error: ${error.message}`);
      }
    } else {
      toast.error('Unknown error analyzing face');
    }
    
    return null;
  }
};

/**
 * Get a summary of emotions from face details
 * @param faceDetails The face details from Rekognition
 * @returns An object with the dominant emotion and emotion scores
 */
export const getEmotionSummary = (faceDetails: any) => {
  if (!faceDetails || !faceDetails[0] || !faceDetails[0].Emotions) {
    return { dominant: 'unknown', scores: {} };
  }
  
  const emotions = faceDetails[0].Emotions;
  let dominant = 'neutral';
  let highestScore = 0;
  
  const scores: Record<string, number> = {};
  
  emotions.forEach((emotion: any) => {
    const emotionName = emotion.Type.toLowerCase();
    const score = emotion.Confidence;
    
    scores[emotionName] = score;
    
    if (score > highestScore) {
      highestScore = score;
      dominant = emotionName;
    }
  });
  
  return {
    dominant,
    scores
  };
};

/**
 * Check if a person is attentive based on head pose and eye direction
 * @param faceDetails The face details from Rekognition
 * @returns Boolean indicating if the person appears attentive
 */
export const isPersonAttentive = (faceDetails: any): boolean => {
  if (!faceDetails || !faceDetails[0]) {
    return false;
  }
  
  const face = faceDetails[0];
  
  // Check if eyes are open
  const leftEyeOpen = face.EyesOpen?.Value === true && face.EyesOpen?.Confidence > 90;
  const rightEyeOpen = face.EyesOpen?.Value === true && face.EyesOpen?.Confidence > 90;
  
  // Check if head pose is roughly forward-facing
  // Allow for some natural movement (within ±20 degrees)
  const headPose = face.Pose;
  const isHeadForward = 
    Math.abs(headPose?.Pitch || 0) < 20 && 
    Math.abs(headPose?.Roll || 0) < 20 && 
    Math.abs(headPose?.Yaw || 0) < 20;
  
  // Person is considered attentive if their eyes are open and they're facing forward
  return (leftEyeOpen || rightEyeOpen) && isHeadForward;
};

/**
 * Get a count of people in the frame
 * @param faceDetails The face details from Rekognition
 * @returns Number of detected faces
 */
export const getPeopleCount = (faceDetails: any): number => {
  if (!faceDetails) return 0;
  return faceDetails.length;
};

/**
 * Extract demographic information from face analysis
 * @param faceDetails The face details from Rekognition
 * @returns Object with age range and gender information
 */
export const getDemographicInfo = (faceDetails: any) => {
  if (!faceDetails || !faceDetails[0]) {
    return { ageRange: 'unknown', gender: 'unknown' };
  }
  
  const face = faceDetails[0];
  
  const ageRange = face.AgeRange 
    ? `${face.AgeRange.Low}-${face.AgeRange.High}` 
    : 'unknown';
    
  const gender = face.Gender?.Value?.toLowerCase() || 'unknown';
  
  return {
    ageRange,
    gender
  };
}; 
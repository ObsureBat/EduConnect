import React, { useEffect, useState, useRef } from 'react';
import {
  MeetingProvider,
  useAudioVideo,
  useRemoteVideoTileState,
  useMeetingStatus,
  MeetingStatus
} from 'amazon-chime-sdk-component-library-react';
import { Video, VideoOff, Mic, MicOff, Phone, Share2, Settings, Users, MoreVertical, MessageSquare } from 'lucide-react';
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration
} from 'amazon-chime-sdk-js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';

// Polyfill global for Chime SDK
if (typeof global === 'undefined') {
  (window as any).global = window;
}

// Types
interface VideoCallProps {
  meetingId: string;
  userName: string;
  onEndCall: () => void;
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onError?: (error: Error) => void;
}

interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
}

// Main VideoCall Component
const VideoCall = ({ 
  meetingId, 
  userName, 
  onEndCall, 
  isMuted, 
  isVideoOff, 
  onToggleMute, 
  onToggleVideo, 
  onError 
}: VideoCallProps) => {
  return (
    <MeetingProvider>
      <VideoCallContent 
        meetingId={meetingId}
        userName={userName}
        onEndCall={onEndCall}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        onToggleMute={onToggleMute}
        onToggleVideo={onToggleVideo}
        onError={onError}
      />
    </MeetingProvider>
  );
};

// Video Call Content Component
const VideoCallContent: React.FC<VideoCallProps> = ({
  meetingId,
  userName,
  onEndCall,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onError
}) => {
  const [meetingSession, setMeetingSession] = useState<DefaultMeetingSession | null>(null);
  const [isAudioAvailable, setIsAudioAvailable] = useState(false);
  const [isVideoAvailable, setIsVideoAvailable] = useState(false);
  const [participants, setParticipants] = useState(1);
  const [showChat, setShowChat] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [meetingTime, setMeetingTime] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioVideo = useAudioVideo();
  const { tiles } = useRemoteVideoTileState();
  const meetingStatus = useMeetingStatus();

  // Add debug state
  const [videoError, setVideoError] = useState<string | null>(null);
  const [performanceMonitor, setPerformanceMonitor] = useState<PerformanceMonitor | null>(null);

  // Timer for meeting duration
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (meetingSession) {
      timer = setInterval(() => {
        setMeetingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [meetingSession]);

  // Format meeting time as HH:MM:SS
  const formatMeetingTime = () => {
    const hours = Math.floor(meetingTime / 3600);
    const minutes = Math.floor((meetingTime % 3600) / 60);
    const seconds = meetingTime % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Enhanced video initialization with better error handling
  const initializeVideo = async (session: DefaultMeetingSession) => {
    try {
      console.log('Starting video initialization...');
      
      // Check if video is already initialized
      if (isVideoAvailable) {
        console.log('Video is already initialized');
        return;
      }

      // List available video devices
      const videoDevices = await session.audioVideo.listVideoInputDevices();
      console.log('Available video devices:', videoDevices);

      if (videoDevices.length === 0) {
        throw new Error('No video devices found');
      }

      // Select the first video device
      const selectedDevice = videoDevices[0];
      console.log('Selected video device:', selectedDevice);

      // Start video input
      console.log('Starting video input...');
      await session.audioVideo.startVideoInput(selectedDevice.deviceId);
      console.log('Video input started successfully');

      // Start local video tile
      console.log('Starting local video tile...');
      session.audioVideo.startLocalVideoTile();

      // Get local tile and bind video element
      const localTile = session.audioVideo.getLocalVideoTile();
      console.log('Local tile:', localTile);

      if (!localTile) {
        throw new Error('Failed to create local video tile');
      }

      const tileId = localTile.state().tileId;
      console.log('Tile ID:', tileId);

      if (!tileId) {
        throw new Error('Invalid tile ID');
      }

      if (!videoRef.current) {
        throw new Error('Video element reference not found');
      }

      // Bind video element
      console.log('Binding video element...');
      session.audioVideo.bindVideoElement(tileId, videoRef.current);
      console.log('Video element bound successfully');

      // Update state
      setIsVideoAvailable(true);
      setVideoError(null);
      console.log('Video initialization completed successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Video initialization failed:', errorMessage);
      setVideoError(errorMessage);
      setIsVideoAvailable(false);
      if (onError) onError(error as Error);
    }
  };

  // Add video element load handler
  const handleVideoLoad = () => {
    console.log('Video element loaded');
  };

  // Add video element error handler
  const handleVideoError = (error: any) => {
    console.error('Video element error:', error);
    setVideoError('Video playback error occurred');
  };

  // Screen sharing functionality
  const toggleScreenShare = async () => {
    if (!meetingSession) return;
    
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        await meetingSession.audioVideo.startContentShare(screenStream);
        setIsScreenSharing(true);
      } else {
        await meetingSession.audioVideo.stopContentShare();
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error('Screen sharing error:', error);
      if (onError) onError(error as Error);
    }
  };

  // Chat functionality
  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      sender: userName,
      content: newMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  useEffect(() => {
    const setupMeeting = async () => {
      try {
        console.log('Setting up meeting session...');
        const logger = new ConsoleLogger('ChimeLogger', LogLevel.INFO);
        const deviceController = new DefaultDeviceController(logger);
        
        // Request camera permission first
        try {
          console.log('Requesting camera permission...');
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: true
          });
          stream.getTracks().forEach(track => track.stop()); // Stop the stream after permission check
          console.log('Camera permission granted');
        } catch (error) {
          console.error('Camera permission denied:', error);
          throw new Error('Camera permission denied');
        }

        const API_ENDPOINT = 'https://412xc5trdi.execute-api.us-east-1.amazonaws.com/prod/meeting';
        
        // Create or join a meeting
        console.log('Setting up meeting...');
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ 
            meetingId,
            userName,
            region: 'us-east-1'
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to setup meeting');
        }

        const data = await response.json();
        console.log('Meeting configuration received:', data);

        if (!data.Meeting || !data.Attendee) {
          throw new Error('Invalid meeting configuration received');
        }

        // Validate required meeting properties
        const meeting = data.Meeting;
        if (!meeting.MediaPlacement || !meeting.MeetingId || !meeting.MediaRegion) {
          throw new Error('Meeting configuration is missing required properties');
        }

        // Validate required attendee properties
        const attendee = data.Attendee;
        if (!attendee.AttendeeId || !attendee.JoinToken) {
          throw new Error('Attendee configuration is missing required properties');
        }

        console.log('Creating meeting session configuration...');
        const configuration = new MeetingSessionConfiguration(meeting, attendee);
        
        // Set WebSocket URL if needed
        if (meeting.MediaPlacement.SignalingUrl && configuration.urls) {
          configuration.urls.signalingURL = meeting.MediaPlacement.SignalingUrl;
        }

        console.log('Creating meeting session...');
        const session = new DefaultMeetingSession(configuration, logger, deviceController);
        
        setMeetingSession(session);
        
        // Set up event listeners
        session.audioVideo.realtimeSubscribeToAttendeeIdPresence((attendeeId, present) => {
          console.log('Attendee presence changed:', { attendeeId, present });
          if (present) {
            setParticipants(prev => prev + 1);
          } else {
            setParticipants(prev => Math.max(1, prev - 1));
          }
        });

        // Start the session
        console.log('Starting audio-video session...');
        await session.audioVideo.start();
        console.log('Audio-video session started');

        // Initialize video with specific constraints
        await initializeVideo(session);

        // Initialize audio
        console.log('Initializing audio...');
        const audioDevices = await session.audioVideo.listAudioInputDevices();
        if (audioDevices.length > 0) {
          await session.audioVideo.startAudioInput(audioDevices[0].deviceId);
          setIsAudioAvailable(true);
          console.log('Audio initialized successfully');
        } else {
          console.warn('No audio devices found');
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Meeting setup failed:', errorMessage);
        if (onError) onError(error as Error);
      }
    };

    if (meetingId && userName) {
      setupMeeting();
    }

    return () => {
      if (meetingSession) {
        console.log('Cleaning up meeting session...');
        meetingSession.audioVideo.stop();
      }
    };
  }, [meetingId, userName]);

  // Initialize performance monitoring
  useEffect(() => {
    if (meetingSession) {
      // Get the peer connection from the active session
      const peerConnection = (meetingSession.audioVideo as any).configuration?.peer;
      
      if (peerConnection) {
        const monitor = new PerformanceMonitor(
          peerConnection,
          meetingId
        );
        setPerformanceMonitor(monitor);

        // Collect metrics every 5 seconds
        const interval = setInterval(() => {
          monitor.collectMetrics(participants);
        }, 5000);

        return () => {
          clearInterval(interval);
        };
      } else {
        console.error('Failed to get peer connection from meeting session');
      }
    }
  }, [meetingSession, meetingId, participants]);

  const getMeetingStatusDisplay = (status: MeetingStatus) => {
    switch (status) {
      case MeetingStatus.Succeeded:
        return { text: 'Live', color: 'bg-green-500' };
      case MeetingStatus.Failed:
        return { text: 'Failed', color: 'bg-red-500' };
      case MeetingStatus.Loading:
        return { text: 'Connecting', color: 'bg-yellow-500' };
      default:
        return { text: 'Disconnected', color: 'bg-gray-500' };
    }
  };

  const statusDisplay = getMeetingStatusDisplay(meetingStatus);

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a]">
      {/* Header */}
      <header className="bg-[#2a2a2a] px-4 py-3 flex items-center justify-between border-b border-[#3a3a3a]">
        <div className="flex items-center space-x-4">
          <div className="font-semibold text-white text-xl flex items-center">
            <span className="mr-2">𝓐</span>
            <span>EduConnect</span>
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-full text-sm flex items-center transition-colors">
            <Share2 size={16} className="mr-2" />
            Share Link
          </button>
          <div className="text-sm bg-[#3a3a3a] px-3 py-1 rounded-full text-gray-300">
            Meeting ID: {meetingId.substring(0, 8)}
          </div>
          <div className="text-sm text-gray-400">
            {formatMeetingTime()}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm font-medium flex items-center text-gray-300">
            <Users size={16} className="mr-1" />
            <span>{participants} participants</span>
          </div>
          <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
            {userName.substring(0, 1).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Video area */}
        <div className="flex-1 bg-[#1a1a1a] relative flex items-center justify-center">
          <div className="relative w-full h-full max-w-4xl mx-auto">
            {videoError && (
              <div className="absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg text-sm">
                {videoError}
              </div>
            )}
            
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedData={handleVideoLoad}
              onError={handleVideoError}
              className={`w-full h-full object-cover rounded-lg ${isVideoOff ? 'hidden' : ''}`}
              style={{
                transform: 'rotateY(180deg)',
                maxHeight: 'calc(100vh - 180px)',
                backgroundColor: '#2a2a2a'
              }}
            />
            
            {/* Video placeholder when video is off */}
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#2a2a2a] rounded-lg">
                <div className="h-20 w-20 bg-[#3a3a3a] rounded-full flex items-center justify-center">
                  <Users size={40} className="text-gray-400" />
                </div>
              </div>
            )}
            
            {/* Participant info overlay */}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-80 backdrop-blur-sm px-3 py-2 rounded-lg text-white text-sm flex items-center">
              <div className="h-6 w-6 bg-blue-600 rounded-full flex items-center justify-center mr-2 text-xs">
                {userName.substring(0, 1).toUpperCase()}
              </div>
              <span>{userName} {isMuted && '(Muted)'}</span>
            </div>
          </div>

          {/* Meeting status indicator */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-80 backdrop-blur-sm px-3 py-1 rounded-full text-white text-sm">
            <span className="flex items-center">
              <span className={`h-2 w-2 ${statusDisplay.color} rounded-full mr-2`}></span>
              {statusDisplay.text}
            </span>
          </div>

          {/* Controls */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center bg-black bg-opacity-80 backdrop-blur-sm rounded-full p-2 space-x-3">
            <button 
              onClick={onToggleVideo}
              disabled={!isVideoAvailable}
              className={`p-3.5 rounded-full flex items-center justify-center ${
                isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-[#3a3a3a] hover:bg-[#4a4a4a]'
              } transition-colors`}
            >
              {isVideoOff ? <VideoOff size={20} className="text-white" /> : <Video size={20} className="text-white" />}
            </button>
            
            <button 
              onClick={onToggleMute}
              disabled={!isAudioAvailable}
              className={`p-3.5 rounded-full flex items-center justify-center ${
                isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-[#3a3a3a] hover:bg-[#4a4a4a]'
              } transition-colors`}
            >
              {isMuted ? <MicOff size={20} className="text-white" /> : <Mic size={20} className="text-white" />}
            </button>
            
            <button 
              onClick={toggleScreenShare}
              className={`p-3.5 rounded-full flex items-center justify-center ${
                isScreenSharing ? 'bg-blue-500 hover:bg-blue-600' : 'bg-[#3a3a3a] hover:bg-[#4a4a4a]'
              } transition-colors`}
            >
              <Share2 size={20} className="text-white" />
            </button>
            
            <button 
              className="p-3.5 rounded-full bg-[#3a3a3a] hover:bg-[#4a4a4a] flex items-center justify-center transition-colors"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageSquare size={20} className="text-white" />
            </button>
            
            <button 
              className="p-3.5 rounded-full bg-[#3a3a3a] hover:bg-[#4a4a4a] flex items-center justify-center transition-colors"
            >
              <Settings size={20} className="text-white" />
            </button>
            
            <button 
              onClick={onEndCall}
              className="p-3.5 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors"
            >
              <Phone size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Chat panel */}
        {showChat && (
          <div className="w-80 bg-[#2a2a2a] border-l border-[#3a3a3a] flex flex-col">
            <div className="p-3 border-b border-[#3a3a3a] flex items-center justify-between">
              <h3 className="font-medium text-white">Meeting Chat</h3>
              <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-gray-300">
                <MoreVertical size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">
                  No messages yet
                </div>
              ) : (
                messages.map(message => (
                  <div key={message.id} className="mb-4">
                    <div className="flex items-center mb-1">
                      <div className="h-6 w-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs mr-2">
                        {message.sender.substring(0, 1).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-300">{message.sender}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="ml-8 text-sm text-gray-300">
                      {message.content}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-[#3a3a3a]">
              <div className="flex items-center">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="w-full rounded-full bg-[#3a3a3a] border-none px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCall;
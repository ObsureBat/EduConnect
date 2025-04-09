import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Phone, Video, Mic, MicOff, VideoOff, X, Activity, Users, AlertTriangle } from 'lucide-react';
import { PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { getDynamoDBClient } from '../utils/aws-services';
import { browserEnv } from '../config/browser-env';
import toast from 'react-hot-toast';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { 
  captureVideoFrame, 
  analyzeFace, 
  getEmotionSummary, 
  isPersonAttentive,
  getPeopleCount,
  getDemographicInfo 
} from '../utils/rekognition-service';
import { FaceDetail } from '@aws-sdk/client-rekognition';

// Define interface to wrap Rekognition response for type safety
interface FaceAnalysisResult {
  faceDetails: FaceDetail[] | null;
  error?: string;
}

interface Message {
  messageId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
}

interface ChatUser {
  userId: string;
  name: string;
  avatar?: string;
  online: boolean;
}

// Interface for face analysis results
interface FaceAnalysis {
  emotion: {
    dominant: string;
    scores: Record<string, number>;
  };
  isAttentive: boolean;
  peopleCount: number;
  demographics: {
    ageRange: string;
    gender: string;
  };
}

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // References for Rekognition integration
  const jitsiApiRef = useRef<any>(null);
  
  // Face analysis state
  const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysis | null>(null);
  const [isAnalysisEnabled, setIsAnalysisEnabled] = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [faceAnalysisInterval, setFaceAnalysisInterval] = useState<number | null>(null);
  
  // Mock user for demo purposes - in a real app, this would come from authentication
  const currentUser: ChatUser = {
    userId: 'user_1',
    name: 'Current User',
    online: true
  };

  // Mock users for demo purposes
  const mockUsers: ChatUser[] = [
    {
      userId: 'user_2',
      name: 'John Doe',
      online: true
    },
    {
      userId: 'user_3',
      name: 'Jane Smith',
      online: false
    },
    {
      userId: 'user_4',
      name: 'Bob Johnson',
      online: true
    }
  ];

  useEffect(() => {
    // In a real app, you would fetch users from your backend
    setUsers(mockUsers);
    
    // Set up polling for new messages
    const interval = setInterval(fetchMessages, 5000);
    return () => {
      clearInterval(interval);
      stopFaceAnalysis();
    };
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      if (!selectedUser) return;
      
      const dynamoClient = getDynamoDBClient();
      
      // First query - messages sent by current user to selected user
      const sentCommand = new QueryCommand({
        TableName: browserEnv.VITE_AWS_DYNAMODB_MESSAGES_TABLE,
        KeyConditionExpression: 'senderId = :senderId AND receiverId = :receiverId',
        ExpressionAttributeValues: marshall({
          ':senderId': currentUser.userId,
          ':receiverId': selectedUser.userId
        })
      });
      
      // Second query - messages received by current user from selected user
      const receivedCommand = new QueryCommand({
        TableName: browserEnv.VITE_AWS_DYNAMODB_MESSAGES_TABLE,
        KeyConditionExpression: 'senderId = :senderId AND receiverId = :receiverId',
        ExpressionAttributeValues: marshall({
          ':senderId': selectedUser.userId,
          ':receiverId': currentUser.userId
        })
      });
      
      try {
        const [sentMessages, receivedMessages] = await Promise.all([
          dynamoClient.send(sentCommand),
          dynamoClient.send(receivedCommand)
        ]);
        
        const sent = sentMessages.Items ? sentMessages.Items.map(item => unmarshall(item)) : [];
        const received = receivedMessages.Items ? receivedMessages.Items.map(item => unmarshall(item)) : [];
        
        // Combine and sort by timestamp
        const allMessages = [...sent, ...received].sort((a, b) => {
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });
        
        setMessages(allMessages as Message[]);
      } catch (queryError) {
        console.error('DynamoDB query error:', queryError);
        
        // Show a more user-friendly message
        toast.error('Could not load messages. Using mock data instead.');
        
        // Fallback to mock messages for demo purposes
        setMessages([
          {
            messageId: 'mock_1',
            senderId: currentUser.userId,
            receiverId: selectedUser.userId,
            content: 'Hello! This is a demo message.',
            timestamp: new Date(Date.now() - 60000).toISOString(),
            read: true
          },
          {
            messageId: 'mock_2',
            senderId: selectedUser.userId,
            receiverId: currentUser.userId,
            content: 'Hey there! This is a demo reply.',
            timestamp: new Date().toISOString(),
            read: false
          }
        ]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to fetch messages');
    }
  };

  const handleSelectUser = (user: ChatUser) => {
    setSelectedUser(user);
    fetchMessages();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedUser) return;
    
    try {
      const dynamoClient = getDynamoDBClient();
      const messageId = `msg_${Date.now()}`;
      const timestamp = new Date().toISOString();
      
      const message: Message = {
        messageId,
        senderId: currentUser.userId,
        receiverId: selectedUser.userId,
        content: newMessage,
        timestamp,
        read: false
      };
      
      const command = new PutItemCommand({
        TableName: browserEnv.VITE_AWS_DYNAMODB_MESSAGES_TABLE,
        Item: marshall(message)
      });
      
      await dynamoClient.send(command);
      
      setMessages(prev => [...prev, message]);
      setNewMessage('');
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const startCall = (isVideo: boolean) => {
    if (!selectedUser) return;
    
    setIsVideoCall(isVideo);
    setIsCallActive(true);
    setIsMuted(false);
    setIsVideoOff(false);
    
    // Reset face analysis state when starting a call
    setFaceAnalysis(null);
    setIsAnalysisEnabled(false);
  };

  const endCall = () => {
    setIsCallActive(false);
    stopFaceAnalysis();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    
    // Mute/unmute in Jitsi API if available
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleAudio');
    }
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
    
    // Toggle video in Jitsi API if available
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleVideo');
    }
  };
  
  // Toggle face analysis
  const toggleFaceAnalysis = () => {
    if (isAnalysisEnabled) {
      stopFaceAnalysis();
      setIsAnalysisEnabled(false);
      toast.success('Face analysis disabled');
    } else {
      // Check if AWS service is properly configured
      if (!browserEnv.VITE_AWS_ACCESS_KEY_ID || !browserEnv.VITE_AWS_SECRET_ACCESS_KEY || 
          browserEnv.VITE_AWS_REKOGNITION_ENABLED !== 'true') {
        toast.error('AWS Rekognition is not properly configured');
        return;
      }
      
      // Check if video is off - warn user that video needs to be on
      if (isVideoOff) {
        toast.error('Please turn on your video for face analysis');
        return;
      }
      
      setIsAnalysisEnabled(true);
      
      // First check if the Jitsi meeting is properly loaded
      if (!jitsiApiRef.current) {
        toast.error('Please wait for the call to initialize fully before enabling face analysis');
        setTimeout(() => {
          if (jitsiApiRef.current) {
            startFaceAnalysis();
            toast.success('Face analysis enabled');
          } else {
            setIsAnalysisEnabled(false);
            toast.error('Could not initialize face analysis - meeting not ready');
          }
        }, 2000);
      } else {
        startFaceAnalysis();
        toast.success('Face analysis enabled');
      }
    }
  };
  
  // Start face analysis process
  const startFaceAnalysis = () => {
    if (!jitsiApiRef.current) {
      toast.error('Cannot start face analysis: Video call not initialized');
      setIsAnalysisEnabled(false);
      return;
    }

    if (!isAnalysisEnabled) return;
    
    console.log('Starting face analysis');
    let consecutiveErrors = 0;
    let consecutiveNoFaces = 0;
    
    // Set interval to analyze faces every 3 seconds
    const intervalId = window.setInterval(async () => {
      if (!isAnalysisEnabled || !jitsiApiRef.current) {
        clearInterval(intervalId);
        return;
      }
      
      try {
        // Get video element from Jitsi
        const videoElement = document.querySelector('#largeVideo') as HTMLVideoElement;
        
        // Capture video frame
        const base64Image = await captureVideoFrame(videoElement, jitsiApiRef.current);
        
        if (!base64Image) {
          consecutiveErrors++;
          console.warn(`Failed to capture video frame (attempt ${consecutiveErrors})`);
          
          if (consecutiveErrors >= 3) {
            toast.error('Unable to capture video. Please check your camera and permissions.');
            setIsAnalysisEnabled(false);
            clearInterval(intervalId);
          }
          return;
        }
        
        // Reset error counter since we got a frame
        consecutiveErrors = 0;
        
        // Analyze face with AWS Rekognition
        const rawResult = await analyzeFace(base64Image);
        
        // Create a properly typed result object - handle null/undefined
        const faceAnalysisResult: FaceAnalysisResult = {
          faceDetails: rawResult || null
        };
        
        if (!faceAnalysisResult.faceDetails || faceAnalysisResult.faceDetails.length === 0) {
          consecutiveNoFaces++;
          console.log(`No faces detected (attempt ${consecutiveNoFaces})`);
          
          // Only clear results and show message after multiple consecutive no-face detections
          if (consecutiveNoFaces >= 2) {
            setFaceAnalysis({
              emotion: {
                dominant: 'No face detected',
                scores: {}
              },
              isAttentive: false,
              peopleCount: 0,
              demographics: {
                ageRange: 'Unknown',
                gender: 'Unknown'
              }
            });
            
            if (consecutiveNoFaces === 2) {
              toast('No face detected. Please ensure your face is visible.');
            }
            
            // Don't disable face analysis automatically, just keep trying
            if (consecutiveNoFaces > 10) {
              toast('Face detection has been struggling. Disabling analysis.');
              setIsAnalysisEnabled(false);
              clearInterval(intervalId);
            }
          }
          
          return;
        }
        
        // Reset no-face counter since we detected a face
        consecutiveNoFaces = 0;
        
        // Get emotion, attention, and demographic info
        const emotion = getEmotionSummary(faceAnalysisResult.faceDetails);
        const isAttentive = isPersonAttentive(faceAnalysisResult.faceDetails);
        const peopleCount = getPeopleCount(faceAnalysisResult.faceDetails);
        const demographics = getDemographicInfo(faceAnalysisResult.faceDetails);
        
        // Update state with analysis results
        setFaceAnalysis({
          emotion,
          isAttentive,
          peopleCount,
          demographics
        });
        
      } catch (error) {
        console.error('Error during face analysis:', error);
        consecutiveErrors++;
        
        if (consecutiveErrors >= 3) {
          toast.error('Face analysis failed. Please try again later.');
          setIsAnalysisEnabled(false);
          clearInterval(intervalId);
          
          // Keep the last valid results visible rather than clearing them
        }
      }
    }, 3000); // Analyze every 3 seconds
    
    // Save interval ID for cleanup
    setFaceAnalysisInterval(intervalId);
  };
  
  // Stop face analysis process
  const stopFaceAnalysis = useCallback(() => {
    console.log('Stopping face analysis');
    if (faceAnalysisInterval) {
      clearInterval(faceAnalysisInterval);
      setFaceAnalysisInterval(null);
    }
    setFaceAnalysis(null);
    setConsecutiveErrors(0);
  }, [faceAnalysisInterval]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Helper function to get emotion emoji
  const getEmotionEmoji = (emotion: string) => {
    const emotionEmojis: Record<string, string> = {
      'happy': '😊',
      'sad': '😢',
      'angry': '😠',
      'confused': '😕',
      'disgusted': '🤢',
      'surprised': '😲',
      'calm': '😌',
      'fear': '😨',
      'neutral': '😐',
      'unknown': '❓'
    };
    
    return emotionEmojis[emotion] || '❓';
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Users sidebar */}
      <div className="w-1/4 bg-white border-r border-gray-200 p-4 overflow-y-auto shadow-sm">
        <h2 className="text-xl font-semibold mb-6 text-gray-800">Contacts</h2>
        
        <div className="space-y-2">
          {users.map(user => (
            <div 
              key={user.userId}
              className={`
                p-3 rounded-lg flex items-center cursor-pointer transition-colors duration-200
                ${selectedUser?.userId === user.userId ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-gray-50'}
              `}
              onClick={() => handleSelectUser(user)}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-medium shadow-sm mr-3">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-800">{user.name}</div>
                <div className="text-xs text-gray-500 flex items-center mt-1">
                  <span className={`w-2 h-2 rounded-full mr-2 ${user.online ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                  {user.online ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat content */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            {/* Chat header */}
            <div className="bg-white p-4 border-b border-gray-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-lg font-medium shadow-sm mr-4">
                  {selectedUser.name.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-gray-800">{selectedUser.name}</div>
                  <div className="text-sm text-gray-500 flex items-center mt-1">
                    <span className={`w-2 h-2 rounded-full mr-2 ${selectedUser.online ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    {selectedUser.online ? 'Online' : 'Offline'}
                  </div>
                </div>
            </div>

              <div className="flex space-x-3">
              <button 
                  className="p-3 rounded-full hover:bg-gray-100 transition-colors duration-200"
                  onClick={() => startCall(false)}
                  disabled={isCallActive}
              >
                  <Phone className="h-5 w-5 text-indigo-600" />
              </button>
              <button 
                  className="p-3 rounded-full hover:bg-gray-100 transition-colors duration-200"
                  onClick={() => startCall(true)}
                  disabled={isCallActive}
              >
                  <Video className="h-5 w-5 text-indigo-600" />
              </button>
              </div>
            </div>
            
            {/* Messages area */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <Send className="h-8 w-8 text-gray-400" />
                  </div>
                  <div className="text-md">No messages yet</div>
                  <div className="text-sm mt-2">Send a message to start the conversation</div>
                </div>
              ) : (
                <div className="space-y-4 max-w-3xl mx-auto">
                  {messages.map((message) => (
                    <div 
                      key={message.messageId}
                      className={`flex ${message.senderId === currentUser.userId ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`
                          max-w-xs sm:max-w-md md:max-w-lg rounded-2xl p-4 
                          ${message.senderId === currentUser.userId 
                            ? 'bg-indigo-600 text-white rounded-tr-none shadow-md' 
                            : 'bg-white text-gray-800 rounded-tl-none shadow-sm border border-gray-200'}
                        `}
                      >
                        <div>{message.content}</div>
                        <div 
                          className={`
                            text-xs mt-1 
                            ${message.senderId === currentUser.userId ? 'text-indigo-100' : 'text-gray-500'}
                          `}
                        >
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef}></div>
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="bg-white p-4 border-t border-gray-200 shadow-sm">
              <form onSubmit={handleSendMessage} className="flex items-center max-w-3xl mx-auto">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 p-3 border border-gray-300 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              <button 
                  type="submit"
                  className="p-3 bg-indigo-600 text-white rounded-r-xl hover:bg-indigo-700 transition-colors duration-200"
              >
                  <Send className="h-5 w-5" />
              </button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Send className="h-10 w-10 text-gray-400" />
            </div>
            <div className="text-xl font-medium">Select a contact</div>
            <div className="text-sm mt-2">Choose someone to start chatting with</div>
          </div>
        )}
      </div>

      {/* Call overlay */}
      {isCallActive && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl overflow-hidden w-4/5 h-4/5 flex flex-col shadow-2xl">
            <div className="p-4 bg-gray-50 flex justify-between items-center border-b border-gray-200">
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-lg font-medium shadow-sm mr-4">
                  {selectedUser?.name.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-gray-800">{selectedUser?.name}</div>
                  <div className="text-sm text-gray-500">
                    {isVideoCall ? 'Video Call' : 'Audio Call'}
                  </div>
            </div>
        </div>
              <div className="flex items-center space-x-4">
                {/* Face analysis toggle button */}
                {isVideoCall && (
                  <button
                    onClick={toggleFaceAnalysis}
                    className={`
                      p-2 rounded-full transition-colors duration-200 flex items-center
                      ${isAnalysisEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}
                    `}
                    title={isAnalysisEnabled ? "Disable face analysis" : "Enable face analysis"}
                  >
                    <Activity className="h-5 w-5" />
                    <span className="ml-2 text-sm">{isAnalysisEnabled ? "Analyzing" : "Analyze"}</span>
                  </button>
                )}
          <button 
                  onClick={endCall}
                  className="p-3 rounded-full hover:bg-gray-200 transition-colors duration-200"
          >
                  <X className="h-5 w-5 text-red-600" />
          </button>
        </div>
      </div>

            <div className="flex-1 relative">
              {isVideoCall ? (
                <div className="h-full w-full">
                  <JitsiMeeting
                    domain="meet.jit.si"
                    roomName={`${currentUser.userId}_${selectedUser?.userId}_${Date.now()}`}
                    configOverwrite={{
                      startWithAudioMuted: isMuted,
                      startWithVideoMuted: isVideoOff,
                      disableModeratorIndicator: true,
                      enableClosePage: false,
                      prejoinPageEnabled: false,
                      disableDeepLinking: true,
                      // Enable additional permissions needed for face analysis
                      userInfo: {
                        displayName: currentUser.name
                      },
                      p2p: {
                        enabled: true
                      },
                      analytics: {
                        disabled: true
                      },
                      // Request camera permissions immediately
                      startScreenSharing: false,
                      enableWelcomePage: false,
                      disableSimulcast: false,
                      enableNoisyMicDetection: true,
                      // Define which buttons should appear in the toolbar
                      toolbarButtons: [
                        'microphone', 'camera', 'closedcaptions', 'desktop', 
                        'fullscreen', 'fodeviceselection', 'hangup', 'profile', 
                        'chat', 'recording', 'livestreaming', 'etherpad', 
                        'sharedvideo', 'settings', 'raisehand', 'videoquality', 
                        'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts', 
                        'tileview', 'videobackgroundblur', 'download', 'help', 
                        'mute-everyone', 'security'
                      ]
                    }}
                    interfaceConfigOverwrite={{
                      TOOLBAR_BUTTONS: [
                        'microphone', 'camera', 'closedcaptions', 'desktop', 
                        'fullscreen', 'fodeviceselection', 'hangup', 'profile', 
                        'chat', 'recording', 'livestreaming', 'etherpad', 
                        'sharedvideo', 'settings', 'raisehand', 'videoquality', 
                        'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts', 
                        'tileview', 'videobackgroundblur', 'download', 'help', 
                        'mute-everyone', 'security'
                      ],
                      SETTINGS_SECTIONS: ['devices', 'language', 'moderator', 'profile', 'calendar'],
                      SHOW_JITSI_WATERMARK: false,
                      SHOW_WATERMARK_FOR_GUESTS: false,
                      DEFAULT_BACKGROUND: '#3c3c3c',
                      DEFAULT_LOCAL_DISPLAY_NAME: 'Me',
                      DEFAULT_REMOTE_DISPLAY_NAME: 'User',
                      PROVIDER_NAME: 'EduConnect'
                    }}
                    getIFrameRef={(iframeRef) => { 
                        iframeRef.style.height = '100%'; 
                        iframeRef.style.width = '100%';
                        
                        // Set attributes for camera and microphone access
                        if (iframeRef.setAttribute) {
                          iframeRef.setAttribute('allow', 'camera; microphone; display-capture; autoplay; clipboard-write; encrypted-media');
                        }
                    }}
                    onApiReady={(api) => {
                      jitsiApiRef.current = api;
                      
                      // Try to get access to local tracks through the API
                      api.addEventListener('videoConferenceJoined', () => {
                        try {
                          // Check if we can access the video
                          console.log('Video conference joined, attempting to access tracks');
                          
                          // Check if the iframe has loaded successfully
                          const iframe = document.querySelector('iframe[allow*="camera"]');
                          if (iframe) {
                            console.log('Jitsi iframe detected, face analysis should work');
                          }
                          
                          // Automatically enable face analysis if in video mode
                          if (isVideoCall && !isAnalysisEnabled && !isVideoOff) {
                            setTimeout(() => {
                              setIsAnalysisEnabled(true);
                              startFaceAnalysis();
                            }, 2000);
                          }
                        } catch (error) {
                          console.error('Error in video conference joined handler:', error);
                        }
                      });
                    }}
                  />
                  
                  {/* Face analysis overlay */}
                  {isAnalysisEnabled && faceAnalysis && (
                    <div className="absolute top-4 right-4 bg-black bg-opacity-70 rounded-lg p-4 text-white shadow-lg max-w-xs">
                      <h3 className="text-sm font-semibold mb-2 flex items-center">
                        <Activity className="h-4 w-4 mr-2" />
                        Face Analysis
                      </h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span>Emotion:</span>
                          <span className="font-medium">
                            {getEmotionEmoji(faceAnalysis.emotion.dominant)} {faceAnalysis.emotion.dominant}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Attention:</span>
                          <span className={`font-medium ${faceAnalysis.isAttentive ? 'text-green-400' : 'text-yellow-400'}`}>
                            {faceAnalysis.isAttentive ? 'Attentive' : 'Distracted'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>People:</span>
                          <span className="font-medium flex items-center">
                            <Users className="h-3 w-3 mr-1" />
                            {faceAnalysis.peopleCount}
                          </span>
            </div>
                        <div className="flex justify-between">
                          <span>Age Range:</span>
                          <span className="font-medium">
                            {faceAnalysis.demographics.ageRange}
                          </span>
            </div>
          </div>
        </div>
      )}

                  {/* Analysis enabled but no face detected */}
                  {isAnalysisEnabled && !faceAnalysis && (
                    <div className="absolute top-4 right-4 bg-yellow-600 bg-opacity-80 rounded-lg p-3 text-white shadow-lg text-xs flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      No face detected
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <div className="text-center text-white">
                    <div className="w-40 h-40 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 text-5xl font-medium shadow-lg">
                      {selectedUser?.name.charAt(0)}
                    </div>
                    <div className="text-2xl font-medium">{selectedUser?.name}</div>
                    <div className="text-gray-400 mt-2">Audio Call</div>
                  </div>
        </div>
      )}

              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-4">
                <button 
                  onClick={toggleMute}
                  className={`p-5 rounded-full ${isMuted ? 'bg-red-500' : 'bg-gray-700'} text-white shadow-lg hover:opacity-90 transition-opacity duration-200`}
                >
                  {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </button>
                {isVideoCall && (
                  <button 
                    onClick={toggleVideo}
                    className={`p-5 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-gray-700'} text-white shadow-lg hover:opacity-90 transition-opacity duration-200`}
                  >
                    {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                  </button>
            )}
            <button 
                  onClick={endCall}
                  className="p-5 rounded-full bg-red-500 text-white shadow-lg hover:opacity-90 transition-opacity duration-200"
            >
              <X className="h-6 w-6" />
            </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Phone, Video, Mic, MicOff, VideoOff, X, Activity, Users, AlertTriangle, Share2 } from 'lucide-react';
import { PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { getDynamoDBClient } from '../utils/aws-services';
import { browserEnv } from '../config/browser-env';
import toast from 'react-hot-toast';
import VideoCall from '../components/VideoCall';
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
  online: boolean;
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
  
  // Face analysis state
  const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysis | null>(null);
  const [isAnalysisEnabled, setIsAnalysisEnabled] = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [faceAnalysisInterval, setFaceAnalysisInterval] = useState<number | null>(null);

  // Add meeting ID state
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);

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
    if (!selectedUser) return;
    
    try {
      const dynamoClient = getDynamoDBClient();
      const command = new QueryCommand({
        TableName: browserEnv.VITE_AWS_DYNAMODB_MESSAGES_TABLE,
        KeyConditionExpression: 'receiverId = :receiverId',
        ExpressionAttributeValues: marshall({
          ':receiverId': currentUser.userId
        })
      });
      
      const response = await dynamoClient.send(command);
      if (response.Items) {
        const fetchedMessages = response.Items.map(item => unmarshall(item) as Message);
        setMessages(fetchedMessages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
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
    if (!selectedUser) {
      toast.error('Please select a user to call');
      return;
    }

    const newMeetingId = `${currentUser.userId}_${selectedUser.userId}_${Date.now()}`;
    console.log('Starting new call with ID:', newMeetingId);
    
    setIsCallActive(true);
    setIsVideoCall(isVideo);
    setCurrentMeetingId(newMeetingId);
    toast.success(isVideo ? 'Starting video call...' : 'Starting audio call...');
  };

  const endCall = () => {
    console.log('Ending call:', currentMeetingId);
    setIsCallActive(false);
    setIsVideoCall(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setCurrentMeetingId(null);
    stopFaceAnalysis();
    toast.success('Call ended');
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
  };

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
      startFaceAnalysis();
      toast.success('Face analysis enabled');
    }
  };

  const startFaceAnalysis = () => {
    if (!isAnalysisEnabled) return;
    
    console.log('Starting face analysis');
    let consecutiveErrors = 0;
    let consecutiveNoFaces = 0;
    
    // Set interval to analyze faces every 3 seconds
    const intervalId = window.setInterval(async () => {
      if (!isAnalysisEnabled) {
        clearInterval(intervalId);
        return;
      }
      
      try {
        // Get video element from the local video component
        const videoElement = document.querySelector('video') as HTMLVideoElement;
        
        // Capture video frame
        const base64Image = await captureVideoFrame(videoElement);
        
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
        }
      }
    }, 3000); // Analyze every 3 seconds
    
    // Save interval ID for cleanup
    setFaceAnalysisInterval(intervalId);
  };

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

  // Add function to join existing call
  const joinExistingCall = (meetingId: string) => {
    if (!meetingId) {
      toast.error('Invalid meeting ID');
      return;
    }

    setIsCallActive(true);
    setIsVideoCall(true);
    setCurrentMeetingId(meetingId);
    toast.success('Joining video call...');
  };

  // Add function to handle shared meeting links
  useEffect(() => {
    const handleMeetingLink = () => {
      // Check URL for meeting ID parameter
      const urlParams = new URLSearchParams(window.location.search);
      const meetingId = urlParams.get('meetingId');
      
      if (meetingId && !isCallActive) {
        console.log('Found meeting ID in URL:', meetingId);
        
        // If we have a meeting ID but no selected user, select the first available user
        if (!selectedUser && users.length > 0) {
          console.log('Selecting first available user:', users[0]);
          setSelectedUser(users[0]);
        }
        
        joinExistingCall(meetingId);
        
        // Remove the meetingId from the URL without refreshing the page
        const newUrl = window.location.pathname;
        window.history.pushState({}, '', newUrl);
      }
    };

    handleMeetingLink();
  }, [selectedUser, users, isCallActive]);

  const handleShare = async () => {
    if (!currentMeetingId) {
      toast.error('No active meeting to share');
      return;
    }
    
    // Create meeting URL with ID
    const meetingUrl = `${window.location.protocol}//${window.location.host}/chat?meetingId=${encodeURIComponent(currentMeetingId)}`;
    console.log('Sharing meeting URL:', meetingUrl);
    
    try {
      await navigator.clipboard.writeText(meetingUrl);
      toast.success('Meeting link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy meeting link:', err);
      toast.error('Failed to copy meeting link');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">Chats</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {users.map(user => (
            <div
              key={user.userId}
              className={`p-4 flex items-center cursor-pointer hover:bg-gray-50 ${
                selectedUser?.userId === user.userId ? 'bg-indigo-50' : ''
              }`}
              onClick={() => setSelectedUser(user)}
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-lg font-medium shadow-sm mr-4">
                {user.name.charAt(0)}
              </div>
              <div>
                <div className="font-medium text-gray-800">{user.name}</div>
                <div className="text-sm text-gray-500 flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${user.online ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                  {user.online ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(message => (
                <div
                  key={message.messageId}
                  className={`flex ${message.senderId === currentUser.userId ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.senderId === currentUser.userId
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-800'
                    }`}
                  >
                    <div className="text-sm">{message.content}</div>
                    <div className="text-xs mt-1 opacity-70">
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
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
                <>
                  <VideoCall
                    meetingId={currentMeetingId!}
                    userName={currentUser.name}
                    onEndCall={endCall}
                    isMuted={isMuted}
                    isVideoOff={isVideoOff}
                    onToggleMute={toggleMute}
                    onToggleVideo={toggleVideo}
                  />
                  {currentMeetingId && (
                    <button
                      onClick={handleShare}
                      className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
                    >
                      <Share2 className="h-5 w-5" />
                      <span>Share Link</span>
                    </button>
                  )}
                </>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
import React, { useState, useRef } from 'react';
import { 
  Camera, Mic, MicOff, VideoOff, 
  MessageCircle, PlusCircle, 
  Users, ScreenShare, 
  Clipboard, X 
} from 'lucide-react';

interface Meeting {
  id: string;
  name: string;
  host: string;
  participants: string[];
  startTime: Date;
  duration: number;
}

const AdvancedMeetingPlatform: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isCreateMeetingModal, setIsCreateMeetingModal] = useState(false);
  const [newMeetingDetails, setNewMeetingDetails] = useState({
    name: '',
    duration: 60,
    startTime: new Date()
  });

  const [isJoined, setIsJoined] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [messages, setMessages] = useState<{ user: string, text: string }[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);

  const createMeeting = () => {
    const newMeeting: Meeting = {
      id: `meet_${Date.now()}`,
      name: newMeetingDetails.name,
      host: 'Current User',
      participants: [],
      startTime: newMeetingDetails.startTime,
      duration: newMeetingDetails.duration
    };

    setMeetings(prev => [...prev, newMeeting]);
    setSelectedMeeting(newMeeting);
    setIsCreateMeetingModal(false);
  };

  const joinMeeting = async (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setIsJoined(true);
    } catch (error) {
      console.error('Error joining meeting', error);
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true
      });
      
      if (screenShareRef.current) {
        screenShareRef.current.srcObject = screenStream;
      }
      setIsScreenSharing(true);
    } catch (error) {
      console.error('Screen share error', error);
    }
  };

  const copyMeetingLink = () => {
    if (selectedMeeting) {
      navigator.clipboard.writeText(`Meeting ID: ${selectedMeeting.id}`);
      alert('Meeting link copied!');
    }
  };

  const sendMessage = () => {
    if (!chatMessage.trim()) return;

    setMessages(prev => [...prev, { 
      user: 'You', 
      text: chatMessage 
    }]);
    setChatMessage('');
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`
        ${isCreateMeetingModal ? 'hidden' : 'block'}
        w-full lg:w-1/5 bg-white border-r
        ${isJoined ? 'hidden lg:block' : 'block'}
      `}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Meetings</h2>
          <button 
            onClick={() => setIsCreateMeetingModal(true)}
            className="text-blue-500 hover:bg-blue-50 p-2 rounded"
          >
            <PlusCircle />
          </button>
        </div>

        {/* Meeting List */}
        <div className="space-y-2">
          {meetings.map(meeting => (
            <div 
              key={meeting.id} 
              className="border p-3 rounded hover:bg-blue-50 cursor-pointer flex justify-between items-center"
              onClick={() => joinMeeting(meeting)}
            >
              <div>
                <h3 className="font-semibold">{meeting.name}</h3>
                <p className="text-sm text-gray-500">
                  {meeting.startTime.toLocaleString()}
                </p>
              </div>
              <Users size={20} className="text-gray-500" />
            </div>
          ))}
        </div>
      </div>

      {/* Main Video Section */}
      <div className={`
        flex-1 lg:w-3/5 flex flex-col
        ${isJoined ? 'block' : 'hidden lg:block'}
      `}>
        {isJoined ? (
          <div className="flex-grow bg-gray-900 relative">
            {/* Local & Screen Share Videos */}
            <div className="grid grid-cols-2 h-full">
              <video 
                ref={localVideoRef}
                autoPlay 
                muted 
                className="h-full object-cover"
              />
              {isScreenSharing && (
                <video 
                  ref={screenShareRef}
                  autoPlay 
                  className="h-full object-cover"
                />
              )}
            </div>

            {/* Meeting Controls */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 rounded-full p-2 flex space-x-4">
              <button 
                onClick={() => setIsMicOn(!isMicOn)}
                className={`p-2 rounded-full ${isMicOn ? 'bg-white/20' : 'bg-red-500/50'}`}
              >
                {isMicOn ? <Mic color="white" /> : <MicOff color="white" />}
              </button>
              <button 
                onClick={() => setIsCameraOn(!isCameraOn)}
                className={`p-2 rounded-full ${isCameraOn ? 'bg-white/20' : 'bg-red-500/50'}`}
              >
                {isCameraOn ? <Camera color="white" /> : <VideoOff color="white" />}
              </button>
              <button 
                onClick={startScreenShare}
                className="p-2 rounded-full bg-white/20"
              >
                <ScreenShare color="white" />
              </button>
              <button 
                onClick={copyMeetingLink}
                className="p-2 rounded-full bg-white/20"
              >
                <Clipboard color="white" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-grow flex items-center justify-center bg-gray-200">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Select or Create a Meeting</h2>
              <p className="text-gray-600">Choose a meeting from the list or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* Chat Section */}
      <div className={`
        w-full lg:w-1/5 bg-white border-l
        ${isJoined ? 'hidden lg:block' : 'hidden'}
      `}>
        <div className="flex-grow overflow-y-auto">
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className="mb-2 p-2 bg-gray-100 rounded"
            >
              <strong>{msg.user}: </strong>{msg.text}
            </div>
          ))}
        </div>

        <div className="mt-4 flex">
          <input 
            type="text" 
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message"
            className="flex-grow p-2 border rounded-l"
          />
          <button 
            onClick={sendMessage} 
            className="bg-blue-500 text-white p-2 rounded-r"
          >
            <MessageCircle />
          </button>
        </div>
      </div>

      {/* Create Meeting Modal */}
      {isCreateMeetingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-1/3">
            <h2 className="text-xl font-bold mb-4">Create New Meeting</h2>
            <input 
              type="text"
              placeholder="Meeting Name"
              value={newMeetingDetails.name}
              onChange={(e) => setNewMeetingDetails(prev => ({
                ...prev, 
                name: e.target.value
              }))}
              className="w-full p-2 border rounded mb-4"
            />
            <div className="flex space-x-4 mb-4">
              <input 
                type="datetime-local"
                value={newMeetingDetails.startTime.toISOString().slice(0,16)}
                onChange={(e) => setNewMeetingDetails(prev => ({
                  ...prev, 
                  startTime: new Date(e.target.value)
                }))}
                className="flex-grow p-2 border rounded"
              />
              <select 
                value={newMeetingDetails.duration}
                onChange={(e) => setNewMeetingDetails(prev => ({
                  ...prev, 
                  duration: parseInt(e.target.value)
                }))}
                className="p-2 border rounded"
              >
                <option value={30}>30 min</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
              </select>
            </div>
            <div className="flex justify-end space-x-4">
              <button 
                onClick={() => setIsCreateMeetingModal(false)}
                className="bg-gray-200 text-black p-2 rounded"
              >
                Cancel
              </button>
              <button 
                onClick={createMeeting}
                className="bg-blue-500 text-white p-2 rounded"
              >
                Create Meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation */}
      {isJoined && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-2 flex justify-around lg:hidden">
          <button onClick={() => setShowSidebar(true)} className="p-2">
            <Users className="h-6 w-6" />
          </button>
          <button onClick={() => setShowChat(true)} className="p-2">
            <MessageCircle className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Mobile Sidebar/Chat Drawer */}
      {(showSidebar || showChat) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 lg:hidden">
          <div className="absolute right-0 top-0 bottom-0 w-4/5 bg-white">
            {showSidebar && (
              <div className="h-full overflow-y-auto">
                {/* Sidebar content */}
              </div>
            )}
            {showChat && (
              <div className="h-full overflow-y-auto">
                {/* Chat content */}
              </div>
            )}
            <button 
              onClick={() => {
                setShowSidebar(false);
                setShowChat(false);
              }}
              className="absolute top-4 right-4"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedMeetingPlatform;
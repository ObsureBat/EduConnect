import { useState, useEffect, useRef } from 'react';
import { Users, Plus, Search, Send, Upload } from 'lucide-react';
import { PutItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { getDynamoDBClient, uploadFileToS3 } from '../utils/aws-services';
import { browserEnv } from '../config/browser-env';
import toast from 'react-hot-toast';

interface Group {
  groupId: string;
  name: string;
  description: string;
  members: number;
  image?: string;
  messages?: Message[];
  files?: SharedFile[];
  timestamp: string;
}

interface Message {
  id: string;
  userId: string;
  content: string;
  timestamp: string;
}

interface SharedFile {
  id: string;
  name: string;
  url: string;
  uploadedBy: string;
  timestamp: string;
}

const Groups = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [message, setMessage] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [selectedGroup?.messages]);

  const fetchGroups = async () => {
    try {
      const dynamoClient = getDynamoDBClient();
      const command = new ScanCommand({
        TableName: browserEnv.VITE_AWS_DYNAMODB_GROUPS_TABLE,
      });

      const response = await dynamoClient.send(command);
      if (response.Items) {
        const unmarshalledItems = response.Items.map(item => unmarshall(item)) as Group[];
        setGroups(unmarshalledItems);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to load groups');
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    try {
      const dynamoClient = getDynamoDBClient();
      const newGroupData: Group = {
        groupId: Date.now().toString(),
        name: newGroup.name,
        description: newGroup.description,
        members: 1,
        messages: [],
        files: [],
        timestamp: new Date().toISOString()
      };

      const command = new PutItemCommand({
        TableName: browserEnv.VITE_AWS_DYNAMODB_GROUPS_TABLE,
        Item: marshall(newGroupData)
      });

      await dynamoClient.send(command);
      setGroups(prev => [...prev, newGroupData]);
      setShowCreateModal(false);
      setNewGroup({ name: '', description: '' });
      toast.success('Group created successfully');
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    }
  };

  const handleSendMessage = async () => {
    if (!selectedGroup || !message.trim()) return;

    try {
      const newMessage: Message = {
        id: Date.now().toString(),
        userId: 'current-user', // Replace with actual user ID
        content: message,
        timestamp: new Date().toISOString()
      };

      const updatedGroup = {
        ...selectedGroup,
        messages: [...(selectedGroup.messages || []), newMessage]
      };

      const dynamoClient = getDynamoDBClient();
      const command = new PutItemCommand({
        TableName: browserEnv.VITE_AWS_DYNAMODB_GROUPS_TABLE,
        Item: marshall(updatedGroup)
      });

      await dynamoClient.send(command);
      setSelectedGroup(updatedGroup);
      setGroups(prev => 
        prev.map(group => 
          group.groupId === updatedGroup.groupId ? updatedGroup : group
        )
      );
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length || !selectedGroup) return;

    try {
      const file = event.target.files[0];
      const fileKey = `groups/${selectedGroup.groupId}/files/${file.name}`;
      const fileUrl = await uploadFileToS3(file, fileKey);

      const newFile: SharedFile = {
        id: Date.now().toString(),
        name: file.name,
        url: fileUrl,
        uploadedBy: 'current-user', // Replace with actual user ID
        timestamp: new Date().toISOString()
      };

      const updatedGroup = {
        ...selectedGroup,
        files: [...(selectedGroup.files || []), newFile]
      };

      const dynamoClient = getDynamoDBClient();
      const command = new PutItemCommand({
        TableName: browserEnv.VITE_AWS_DYNAMODB_GROUPS_TABLE,
        Item: marshall(updatedGroup)
      });

      await dynamoClient.send(command);
      setSelectedGroup(updatedGroup);
      setGroups(prev => 
        prev.map(group => 
          group.groupId === updatedGroup.groupId ? updatedGroup : group
        )
      );
      toast.success('File uploaded successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    }
  };

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">Groups</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create New Group
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Groups List */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <Search className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
              </div>
            </div>
            <div className="space-y-3">
              {filteredGroups.map((group) => (
                <div 
                  key={group.groupId} 
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedGroup?.groupId === group.groupId 
                      ? 'bg-indigo-50 border-2 border-indigo-500' 
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => setSelectedGroup(group)}
                >
                  <h4 className="font-medium text-gray-900">{group.name}</h4>
                  <p className="text-sm text-gray-500 truncate">{group.description}</p>
                  <div className="flex items-center mt-2 text-xs text-gray-400">
                    <Users className="h-4 w-4 mr-1" />
                    <span>{group.members} members</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat and Files Area */}
        <div className="lg:col-span-3 order-1 lg:order-2">
          <div className="bg-white rounded-lg shadow-sm h-[800px] flex flex-col">
            {/* Group Header */}
            <div className="p-4 border-b">
              {selectedGroup ? (
                <>
                  <h2 className="text-xl font-bold">{selectedGroup.name}</h2>
                  <p className="text-sm text-gray-500">{selectedGroup.description}</p>
                  <div className="flex items-center mt-2 text-sm text-gray-400">
                    <Users className="h-4 w-4 mr-1" />
                    <span>{selectedGroup.members} members</span>
                  </div>
                </>
              ) : (
                <p>Select a group to start chatting</p>
              )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex">
              {/* Chat Area */}
              <div className="flex-1 flex flex-col">
                {/* Messages */}
                <div 
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4"
                >
                  {selectedGroup?.messages?.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`flex ${msg.userId === 'current-user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] ${
                        msg.userId === 'current-user' 
                          ? 'bg-indigo-500 text-white' 
                          : 'bg-gray-100 text-gray-900'
                        } rounded-lg p-3`}
                      >
                        <div className="text-sm font-medium mb-1">
                          {msg.userId === 'current-user' ? 'You' : msg.userId}
                        </div>
                        <div className="break-words">{msg.content}</div>
                        <div className="text-xs mt-1 opacity-75">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Message Input */}
                <div className="p-4 border-t">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1 border rounded-full px-6 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Type your message..."
                    />
                    <button
                      onClick={handleSendMessage}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Files Sidebar */}
              <div className="w-80 border-l">
                <div className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">Shared Files</h3>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex items-center px-3 py-2 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </label>
                  </div>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {selectedGroup?.files?.map((file) => (
                      <div 
                        key={file.id} 
                        className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{file.name}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Uploaded by {file.uploadedBy}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(file.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-xl font-semibold mb-4">Create New Group</h3>
            <input
              type="text"
              placeholder="Group Name"
              value={newGroup.name}
              onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
              className="w-full mb-4 px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <textarea
              placeholder="Group Description"
              value={newGroup.description}
              onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
              className="w-full mb-4 px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-32 resize-none"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
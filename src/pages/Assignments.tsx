import { useEffect, useState, useContext } from 'react';
import { FileText, Upload, Clock, CheckCircle, Settings, Database, Info, CheckSquare, Bell } from 'lucide-react';
import { PutItemCommand, ScanCommand, UpdateItemCommand, ReturnValue } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { getDynamoDBClient, uploadAssignmentToS3, createS3BucketIfNotExists, testS3Connection } from '../utils/aws-services';
import { browserEnv } from '../config/browser-env';
import toast from 'react-hot-toast';
import { Dialog } from '@headlessui/react';
import { configureS3CorsFromBrowser, getCurrentAwsConfig } from '../utils/aws-config-helper';
import UploadProgress from '../components/UploadProgress';


interface Assignment {
  assignmentId: string;
  title: string;
  course: string;
  dueDate: string;
  status: 'pending' | 'submitted';
  description: string;
  submissionUrl?: string;
  submittedAt?: string;
  timestamp: string;
}

interface NewAssignment {
  title: string;
  course: string;
  dueDate: string;
  description: string;
}

const NotificationBadge = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  
  return (
    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
      {count > 9 ? '9+' : count}
    </div>
  );
};

const Assignments = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState<NewAssignment>({
    title: '',
    course: '',
    dueDate: new Date().toISOString().split('T')[0],
    description: ''
  });

  useEffect(() => {
    fetchAssignments();
    fetchNotifications();
    
    const notificationInterval = setInterval(() => {
      fetchNotifications();
    }, 30000);
    
    return () => {
      clearInterval(notificationInterval);
    };
  }, []);

  const fetchAssignments = async () => {
    try {
      const dynamoClient = getDynamoDBClient();
      const command = new ScanCommand({
        TableName: browserEnv.VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE,
      });

      const response = await dynamoClient.send(command);
      console.log('DynamoDB response:', response);
      if (response.Items) {
        const unmarshalledItems = response.Items.map(item => unmarshall(item)) as Assignment[];
        console.log('Unmarshalled assignments:', unmarshalledItems);
        setAssignments(unmarshalledItems);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Failed to load assignments');
    }
  };

  const fetchNotifications = async () => {
    try {
      const dynamoClient = getDynamoDBClient();
      const command = new ScanCommand({
        TableName: browserEnv.VITE_AWS_DYNAMODB_NOTIFICATIONS_TABLE,
        Limit: 10,
      });

      const response = await dynamoClient.send(command);
      if (response.Items) {
        const unmarshalledItems = response.Items.map(item => unmarshall(item)) as any[];
        console.log('Fetched notifications:', unmarshalledItems);
        
        unmarshalledItems.sort((a, b) => {
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
        
        setNotifications(unmarshalledItems);
        
        const unread = unmarshalledItems.filter(item => item.read === 'false').length;
        setUnreadNotifications(unread);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const openCreateModal = () => setIsCreateModalOpen(true);
  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setNewAssignment({
      title: '',
      course: '',
      dueDate: new Date().toISOString().split('T')[0],
      description: ''
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewAssignment(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dynamoClient = getDynamoDBClient();
      const assignment: Assignment = {
        assignmentId: `assignment_${Date.now()}`,
        status: 'pending',
        timestamp: new Date().toISOString(),
        ...newAssignment
      };

      const command = new PutItemCommand({
        TableName: browserEnv.VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE,
        Item: marshall(assignment)
      });

      console.log('Creating assignment:', assignment);
      await dynamoClient.send(command);
      setAssignments(prev => [...prev, assignment]);
      toast.success('Assignment created successfully');
      closeCreateModal();
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast.error('Failed to create assignment');
    }
  };

  const handleSubmitAssignment = async (assignmentId: string, file?: File) => {
    try {
      if (!file) {
        throw new Error('No file selected');
      }

      // Set upload state
      setIsUploading(true);
      setUploadProgress(0);
      setUploadingFileName(file.name);

      console.log('Starting assignment submission...', {
        assignmentId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        bucket: browserEnv.VITE_AWS_S3_BUCKET,
        region: browserEnv.VITE_AWS_REGION
      });

      // Simulate progress updates 
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 5;
        });
      }, 500);

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        clearInterval(progressInterval);
        setIsUploading(false);
        throw new Error('File size exceeds 10MB limit');
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        clearInterval(progressInterval);
        setIsUploading(false);
        throw new Error('Invalid file type. Only PDF and Word documents are allowed.');
      }

      // Find the assignment
      const assignment = assignments.find(a => a.assignmentId === assignmentId);
      if (!assignment) {
        clearInterval(progressInterval);
        setIsUploading(false);
        throw new Error(`Assignment with ID ${assignmentId} not found`);
      }

      console.log('Assignment found:', assignment);

      // Generate unique file key - this format will be parsed by the Lambda function
      const timestamp = Date.now();
      const fileKey = `assignments/${assignmentId}/${timestamp}-${file.name}`;
      
      console.log('Uploading file to S3 with key:', fileKey);
      
      // Upload the file to S3
      const fileUrl = await uploadAssignmentToS3(file, fileKey);
      console.log('File uploaded successfully, URL:', fileUrl);
      
      // Update DynamoDB record
      const dynamoClient = getDynamoDBClient();
      const updatedAssignment = {
        ...assignment,
        status: 'submitted',
        submissionUrl: fileUrl,
        submittedAt: new Date().toISOString()
      };
      
      const updateCommand = new PutItemCommand({
        TableName: browserEnv.VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE,
        Item: marshall(updatedAssignment)
      });
      
      await dynamoClient.send(updateCommand);
      console.log('DynamoDB record updated successfully');
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Update local state
      setAssignments(prev => prev.map(a => {
        if (a.assignmentId === assignmentId) {
          return {
            ...a,
            status: 'submitted' as const,
            submissionUrl: updatedAssignment.submissionUrl,
            submittedAt: updatedAssignment.submittedAt
          };
        }
        return a;
      }));

      toast.success('Assignment submitted successfully!');
      setIsUploading(false);
      
      // Fetch latest data
      fetchAssignments();
      fetchNotifications();
      
    } catch (error) {
      console.error('Error submitting assignment:', error);
      setIsUploading(false);
      
      let errorMessage = 'Failed to submit assignment';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  };

  const handleConfigureS3Cors = async () => {
    try {
      toast.loading('Configuring S3 CORS settings...');
      const result = await configureS3CorsFromBrowser();
      toast.dismiss();
      toast.success(result);
    } catch (error) {
      toast.dismiss();
      console.error('Error configuring S3 CORS:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to configure S3 CORS');
    }
  };

  const handleCreateS3Bucket = async () => {
    try {
      toast.loading('Creating S3 bucket if it does not exist...');
      const result = await createS3BucketIfNotExists();
      toast.dismiss();
      if (result) {
        toast.success('S3 bucket verification successful or created successfully');
      } else {
        toast.error('Failed to create S3 bucket');
      }
    } catch (error) {
      toast.dismiss();
      console.error('Error creating S3 bucket:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create S3 bucket');
    }
  };

  const handleCheckAwsConfig = async () => {
    try {
      const configInfo = await getCurrentAwsConfig();
      // Use a custom alert dialog that uses line breaks properly
      alert(configInfo);
    } catch (error) {
      console.error('Error checking AWS config:', error);
      toast.error('Error retrieving AWS config');
    }
  };

  const handleTestS3Connection = async () => {
    try {
      toast.loading('Testing S3 connection...');
      const result = await testS3Connection();
      toast.dismiss();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.dismiss();
      console.error('Error testing S3 connection:', error);
      toast.error(error instanceof Error ? error.message : 'Error testing S3 connection');
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const dynamoClient = getDynamoDBClient();
      const command = new UpdateItemCommand({
        TableName: browserEnv.VITE_AWS_DYNAMODB_NOTIFICATIONS_TABLE,
        Key: marshall({
          notificationId: notificationId,
          timestamp: notifications.find(n => n.notificationId === notificationId)?.timestamp || ''
        }),
        UpdateExpression: 'SET #read = :read',
        ExpressionAttributeNames: {
          '#read': 'read'
        },
        ExpressionAttributeValues: marshall({
          ':read': 'true'
        })
      });
      
      await dynamoClient.send(command);
      
      setNotifications(prev => prev.map(n => 
        n.notificationId === notificationId ? { ...n, read: 'true' } : n
      ));
      setUnreadNotifications(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const toggleNotifications = () => {
    setIsNotificationsOpen(prev => !prev);
    
    if (!isNotificationsOpen && unreadNotifications > 0) {
      notifications.forEach(n => {
        if (n.read === 'false') {
          markNotificationAsRead(n.notificationId);
        }
      });
    }
  };

  const CreateAssignmentModal = () => (
    <Dialog open={isCreateModalOpen} onClose={closeCreateModal} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-lg p-6 max-w-md w-full">
          <Dialog.Title className="text-lg font-semibold mb-4">Create New Assignment</Dialog.Title>
          
          <form onSubmit={handleCreateAssignment} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                name="title"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={newAssignment.title}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Course</label>
              <input
                type="text"
                name="course"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={newAssignment.course}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Due Date</label>
              <input
                type="date"
                name="dueDate"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={newAssignment.dueDate}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                name="description"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                rows={3}
                value={newAssignment.description}
                onChange={handleInputChange}
              />
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={closeCreateModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Create Assignment
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Notifications Bell */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-indigo-700">Assignments</h1>
        <div className="relative">
          <button 
            onClick={toggleNotifications} 
            className="p-2 rounded-full hover:bg-gray-100 relative"
            aria-label="Notifications"
          >
            <Bell className="h-6 w-6 text-indigo-600" />
            <NotificationBadge count={unreadNotifications} />
          </button>
          
          {/* Notifications Panel */}
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-20 border border-gray-200">
              <div className="py-2 px-3 bg-indigo-50 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-gray-700">Notifications</h3>
                  <span className="text-xs text-gray-500">{notifications.length} notifications</span>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No notifications</div>
                ) : (
                  <div>
                    {notifications.map((notification) => (
                      <div 
                        key={notification.notificationId} 
                        className={`p-3 border-b border-gray-100 hover:bg-gray-50 ${notification.read === 'false' ? 'bg-blue-50' : ''}`}
                        onClick={() => markNotificationAsRead(notification.notificationId)}
                      >
                        <div className="flex justify-between">
                          <span className="font-medium text-sm">{notification.title}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(notification.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{notification.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Upload Progress Modal */}
      <UploadProgress 
        isUploading={isUploading}
        progress={uploadProgress}
        fileName={uploadingFileName}
      />
      
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold">Assignments</h2>
        <div className="flex space-x-2">
          <button 
            onClick={handleCheckAwsConfig}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            <Info className="w-4 h-4 mr-2" />
            Check AWS Config
          </button>
          <button 
            onClick={handleTestS3Connection}
            className="flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            <CheckSquare className="w-4 h-4 mr-2" />
            Test S3 Connection
          </button>
          <button 
            onClick={handleConfigureS3Cors}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors duration-300"
          >
            <Database className="w-4 h-4 mr-2" />
            Configure S3 CORS
          </button>
          <button 
            onClick={openCreateModal}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-300"
          >
            <FileText className="w-4 h-4 mr-2" />
            Create Assignment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {assignments.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No assignments found. Create one to get started.
          </div>
        ) : (
          assignments.map((assignment) => (
            <div key={assignment.assignmentId} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-xl font-semibold">{assignment.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      assignment.status === 'submitted'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {assignment.status === 'submitted' ? 'Submitted' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-2">{assignment.course}</p>
                  <p className="text-gray-500 mt-4">{assignment.description}</p>
                  
                  <div className="mt-6 flex items-center space-x-6">
                    <div className="flex items-center text-gray-500">
                      <Clock className="h-5 w-5 mr-2" />
                      <span>Due: {assignment.dueDate}</span>
                    </div>
                    {assignment.status === 'submitted' ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        <span>Submitted on {new Date(assignment.submittedAt || '').toLocaleDateString()}</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <label htmlFor={`file-upload-${assignment.assignmentId}`} className="cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors flex items-center">
                          <Upload className="h-5 w-5 mr-2" />
                          Submit Assignment
                        </label>
                        <input
                          id={`file-upload-${assignment.assignmentId}`}
                          type="file"
                          className="hidden"
                          onChange={(e) => handleSubmitAssignment(assignment.assignmentId, e.target.files?.[0])}
                          accept=".pdf,.doc,.docx"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <CreateAssignmentModal />
    </div>
  );
};

export default Assignments;
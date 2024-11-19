import { useEffect, useState } from 'react';
import { FileText, Upload, Clock, CheckCircle } from 'lucide-react';
import { PutItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { getDynamoDBClient, uploadFileToS3 } from '../utils/aws-services';
import { awsConfig } from '../config/aws-config';
import toast from 'react-hot-toast';
import { Dialog } from '@headlessui/react';


interface Assignment {
  assignmentId: string;
  title: string;
  course: string;
  dueDate: string;
  status: 'pending' | 'submitted';
  description: string;
  submissionFile?: string;
}

interface NewAssignment {
  title: string;
  course: string;
  dueDate: string;
  description: string;
}

const Assignments = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState<NewAssignment>({
    title: '',
    course: '',
    dueDate: new Date().toISOString().split('T')[0],
    description: ''
  });

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const dynamoClient = getDynamoDBClient();
      const command = new ScanCommand({
        TableName: awsConfig.dynamodb.assignmentsTable,
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

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dynamoClient = getDynamoDBClient();
      const assignment: Assignment = {
        assignmentId: `assignment_${Date.now()}`,
        status: 'pending',
        ...newAssignment
      };

      const command = new PutItemCommand({
        TableName: awsConfig.dynamodb.assignmentsTable,
        Item: marshall(assignment)
      });

      await dynamoClient.send(command);
      setAssignments(prev => [...prev, assignment]);
      toast.success('Assignment created successfully');
      closeCreateModal();
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast.error('Failed to create assignment');
    }
  };

  const handleSubmitAssignment = async (assignmentId: string) => {
    try {
      const fileInput = document.getElementById(`file-${assignmentId}`) as HTMLInputElement;
      if (!fileInput?.files?.length) {
        toast.error('Please select a file to submit');
        return;
      }

      const file = fileInput.files[0];
      const maxSize = 10 * 1024 * 1024; // 10MB limit
      if (file.size > maxSize) {
        toast.error('File size must be less than 10MB');
        return;
      }

      toast.loading('Submitting assignment...', { id: 'submit' });
      const fileKey = `submissions/${assignmentId}/${Date.now()}_${file.name}`;
      
      await uploadFileToS3(file, fileKey);
      
      const dynamoClient = getDynamoDBClient();
      const assignment = assignments.find(a => a.assignmentId === assignmentId);
      const command = new PutItemCommand({
        TableName: awsConfig.dynamodb.assignmentsTable,
        Item: marshall({
          ...assignment,
          status: 'submitted',
          submissionFile: fileKey,
          submissionDate: new Date().toISOString()
        })
      });

      await dynamoClient.send(command);
      setAssignments(prev => 
        prev.map(a => 
          a.assignmentId === assignmentId 
            ? { ...a, status: 'submitted', submissionFile: fileKey }
            : a
        )
      );
      toast.success('Assignment submitted successfully', { id: 'submit' });
    } catch (error) {
      console.error('Error submitting assignment:', error);
      toast.error('Failed to submit assignment', { id: 'submit' });
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
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={newAssignment.title}
                onChange={e => setNewAssignment(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Course</label>
              <input
                type="text"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={newAssignment.course}
                onChange={e => setNewAssignment(prev => ({ ...prev, course: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Due Date</label>
              <input
                type="date"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={newAssignment.dueDate}
                onChange={e => setNewAssignment(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                rows={3}
                value={newAssignment.description}
                onChange={e => setNewAssignment(prev => ({ ...prev, description: e.target.value }))}
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
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold">Assignments</h2>
        <button 
          onClick={openCreateModal}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          <FileText className="h-5 w-5 mr-2" />
          Create Assignment
        </button>
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
                    {assignment.status === 'submitted' && (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        <span>Submitted</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {assignment.status === 'pending' && (
                  <div className="mt-4">
                    <input
                      type="file"
                      id={`file-${assignment.assignmentId}`}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-indigo-50 file:text-indigo-700
                        hover:file:bg-indigo-100"
                    />
                    <button 
                      onClick={() => handleSubmitAssignment(assignment.assignmentId)}
                      className="mt-2 flex items-center px-4 py-2 bg-indigo-100 text-indigo-600 rounded-md hover:bg-indigo-200 transition-colors"
                    >
                      <Upload className="h-5 w-5 mr-2" />
                      Submit Assignment
                    </button>
                  </div>
                )}
                
                {assignment.status === 'submitted' && assignment.submissionFile && (
                  <div className="mt-4 text-sm text-gray-500">
                    Submitted file: {assignment.submissionFile}
                  </div>
                )}
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
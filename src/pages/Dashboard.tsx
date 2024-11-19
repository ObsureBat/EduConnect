import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, FileText, MessageCircle,
   Activity, Bell
} from 'lucide-react';
import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { getDynamoDBClient } from '../utils/aws-services';
import { awsConfig } from '../config/aws-config';
import { NotificationMetrics } from '../components/NotificationMetrics';
import NotificationService, { Notification } from '../utils/notifications';

interface DashboardStats {
  totalGroups: number;
  totalAssignments: number;
  activeChats: number;
  pendingAssignments: number;
  completedAssignments: number;
  recentActivities: Activity[];
}

interface Activity {
  id: string;
  type: 'assignment' | 'group' | 'chat';
  title: string;
  timestamp: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalGroups: 0,
    totalAssignments: 0,
    activeChats: 0,
    pendingAssignments: 0,
    completedAssignments: 0,
    recentActivities: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationServiceRef = useRef<NotificationService>(new NotificationService());

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      const newNotifications = await notificationServiceRef.current.receiveNotifications();
      setNotifications(newNotifications);
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const dynamoClient = getDynamoDBClient();
      
      // Fetch groups
      const groupsCommand = new ScanCommand({
        TableName: awsConfig.dynamodb.groupsTable
      });
      const groupsResponse = await dynamoClient.send(groupsCommand);
      const groups = groupsResponse.Items?.map(item => unmarshall(item)) || [];

      // Fetch assignments
      const assignmentsCommand = new ScanCommand({
        TableName: awsConfig.dynamodb.assignmentsTable
      });
      const assignmentsResponse = await dynamoClient.send(assignmentsCommand);
      const assignments = assignmentsResponse.Items?.map(item => unmarshall(item)) || [];

      // Calculate stats
      const pendingAssignments = assignments.filter(a => a.status === 'pending').length;
      const completedAssignments = assignments.filter(a => a.status === 'submitted').length;

      // Generate recent activities
      const recentActivities = [
        ...assignments.map(a => ({
          id: a.assignmentId,
          type: 'assignment' as const,
          title: a.title,
          timestamp: new Date(a.dueDate).toISOString()
        })),
        ...groups.map(g => ({
          id: g.groupId,
          type: 'group' as const,
          title: g.name,
          timestamp: new Date().toISOString() // Use actual timestamp if available
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
       .slice(0, 5);

      setStats({
        totalGroups: groups.length,
        totalAssignments: assignments.length,
        activeChats: groups.length, // Assuming each group has an active chat
        pendingAssignments,
        completedAssignments,
        recentActivities
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, onClick, color }: any) => (
    <div 
      onClick={onClick}
      className={`bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 ${color}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="text-gray-500">Welcome to your EduConnect dashboard</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
            <StatCard
              title="Total Groups"
              value={stats.totalGroups}
              icon={Users}
              onClick={() => navigate('/groups')}
              color="border-blue-500"
            />
            <StatCard
              title="Total Assignments"
              value={stats.totalAssignments}
              icon={FileText}
              onClick={() => navigate('/assignments')}
              color="border-green-500"
            />
            <StatCard
              title="Active Chats"
              value={stats.activeChats}
              icon={MessageCircle}
              onClick={() => navigate('/chat')}
              color="border-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Assignment Progress */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Assignment Progress</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Completed</span>
                    <span>{stats.completedAssignments} assignments</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${(stats.completedAssignments / stats.totalAssignments) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Pending</span>
                    <span>{stats.pendingAssignments} assignments</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${(stats.pendingAssignments / stats.totalAssignments) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activities */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Recent Activities</h3>
              <div className="space-y-4">
                {stats.recentActivities.map((activity) => (
                  <div 
                    key={activity.id}
                    className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg"
                  >
                    {activity.type === 'assignment' ? (
                      <FileText className="h-5 w-5 text-blue-500" />
                    ) : (
                      <Users className="h-5 w-5 text-green-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-8">
            {/* Notifications Panel */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Recent Notifications</h3>
              <div className="space-y-4">
                {notifications.map((notification, index) => (
                  <div 
                    key={index}
                    className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg"
                  >
                    <Bell className={`h-5 w-5 ${notification.read ? 'text-gray-400' : 'text-blue-500'}`} />
                    <div>
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-gray-500">{notification.message}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(notification.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CloudWatch Metrics */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <NotificationMetrics />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
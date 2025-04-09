import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  MessageSquare,
  Bell,
  Settings,
  HelpCircle,
  Activity,
  Languages
} from 'lucide-react';
import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { getDynamoDBClient } from '../utils/aws-services';
import { awsConfig } from '../config/aws-config';
import { cloudWatch } from '../utils/cloudwatch-service';
import NotificationService, { type Notification } from '../utils/notifications';

interface SidebarStats {
  totalGroups: number;
  activeAssignments: number;
  pendingMessages: number;
  onlineUsers: number;
}

const Sidebar = () => {
  const [stats, setStats] = useState<SidebarStats>({
    totalGroups: 0,
    activeAssignments: 0,
    pendingMessages: 0,
    onlineUsers: 0
  });
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Create a ref for the notification service to persist between renders
  const notificationServiceRef = React.useRef<NotificationService | null>(null);
  
  // Initialize the notification service
  useEffect(() => {
    if (!notificationServiceRef.current) {
      notificationServiceRef.current = new NotificationService();
    }
  }, []);

  const startNotificationPolling = async () => {
    if (!notificationServiceRef.current) return;
    
    try {
      const newNotifications = await notificationServiceRef.current.receiveNotifications();
      setNotifications(prev => [...prev, ...newNotifications]);
    } catch (error) {
      console.error('Error polling notifications:', error);
      await cloudWatch.logError(error as Error, 'NotificationPolling');
    }
  };

  useEffect(() => {
    const initNotifications = async () => {
      if (!notificationServiceRef.current) return;
      
      try {
        await notificationServiceRef.current.initialize();
        await startNotificationPolling();
        
        const interval = setInterval(startNotificationPolling, 30000);
        return () => clearInterval(interval);
      } catch (error) {
        console.error('Error initializing notifications:', error);
        await cloudWatch.logError(error as Error, 'NotificationInit');
      }
    };

    initNotifications();
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      await cloudWatch.logMetric('StatsRefresh', 1);
      const dynamoClient = getDynamoDBClient();

      // Fetch groups count
      const groupsCommand = new ScanCommand({
        TableName: awsConfig.dynamodb.groupsTable,
        Select: 'COUNT'
      });
      const groupsResponse = await dynamoClient.send(groupsCommand);

      // Fetch pending assignments
      const assignmentsCommand = new ScanCommand({
        TableName: awsConfig.dynamodb.assignmentsTable,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': { S: 'pending' } }
      });
      const assignmentsResponse = await dynamoClient.send(assignmentsCommand);

      // Fetch unread messages
      const messagesCommand = new ScanCommand({
        TableName: awsConfig.dynamodb.messagesTable,
        FilterExpression: '#read = :read',
        ExpressionAttributeNames: { '#read': 'read' },
        ExpressionAttributeValues: { ':read': { BOOL: false } }
      });
      const messagesResponse = await dynamoClient.send(messagesCommand);

      setStats({
        totalGroups: groupsResponse.Count || 0,
        activeAssignments: assignmentsResponse.Count || 0,
        pendingMessages: messagesResponse.Count || 0,
        onlineUsers: Math.floor(Math.random() * 10) + 5 // Simulated for demo
      });
      setLoading(false);
    } catch (error) {
      await cloudWatch.logError(error as Error, 'SidebarStats');
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  const navItems = [
    { 
      icon: LayoutDashboard, 
      label: 'Dashboard', 
      path: '/',
      stat: stats.onlineUsers,
      statLabel: 'online'
    },
    { 
      icon: Users, 
      label: 'Groups', 
      path: '/groups',
      stat: stats.totalGroups,
      statLabel: 'total'
    },
    { 
      icon: FileText, 
      label: 'Assignments', 
      path: '/assignments',
      stat: stats.activeAssignments,
      statLabel: 'pending'
    },
    { 
      icon: MessageSquare, 
      label: 'Chat', 
      path: '/chat',
      stat: stats.pendingMessages,
      statLabel: 'unread'
    },
    {
      icon: Languages,
      label: 'Translate',
      path: '/translate',
      stat: 0,
      statLabel: ''
    }
  ];

  return (
    <div className="w-64 bg-gradient-to-b from-indigo-800 to-indigo-900 text-white flex flex-col">
      <div className="p-6 border-b border-indigo-700">
        <h2 className="text-2xl font-bold flex items-center">
          <Activity className="h-6 w-6 mr-2" />
          EduConnect
        </h2>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-indigo-600 shadow-lg'
                  : 'hover:bg-indigo-700/50'
              }`
            }
          >
            <div className="flex items-center">
              <item.icon className="h-5 w-5 mr-3" />
              <span>{item.label}</span>
            </div>
            {!loading && item.stat > 0 && (
              <span className="bg-indigo-500 px-2 py-1 rounded-full text-xs">
                {item.stat} {item.statLabel}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-indigo-700 space-y-2">
        <button 
          className="w-full flex items-center px-4 py-2 text-sm rounded hover:bg-indigo-700/50 transition-colors"
        >
          <Bell className="h-5 w-5 mr-3" />
          Notifications
          {notifications.length > 0 && (
            <span className="ml-auto bg-red-500 px-2 py-1 rounded-full text-xs">
              {notifications.length}
            </span>
          )}
        </button>
        <button className="w-full flex items-center px-4 py-2 text-sm rounded hover:bg-indigo-700/50 transition-colors">
          <Settings className="h-5 w-5 mr-3" />
          Settings
        </button>
        <button className="w-full flex items-center px-4 py-2 text-sm rounded hover:bg-indigo-700/50 transition-colors">
          <HelpCircle className="h-5 w-5 mr-3" />
          Help & Support
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
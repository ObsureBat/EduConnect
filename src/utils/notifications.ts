export interface Notification {
  type: 'assignment' | 'message' | 'group';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

class NotificationService {
  private mockNotifications: Notification[] = [
    {
      type: 'assignment',
      title: 'New Assignment',
      message: 'You have a new assignment due next week',
      timestamp: new Date().toISOString(),
      read: false
    }
  ];

  async initialize() {
    return Promise.resolve();
  }

  async receiveNotifications(): Promise<Notification[]> {
    if (Math.random() > 0.7) {
      return Promise.resolve([...this.mockNotifications, {
        type: 'message',
        title: 'New Message',
        message: 'You have a new message in your inbox',
        timestamp: new Date().toISOString(),
        read: false
      }]);
    }
    return Promise.resolve(this.mockNotifications);
  }

  async markAsRead(timestamp: string): Promise<void> {
    this.mockNotifications = this.mockNotifications.map(notification => 
      notification.timestamp === timestamp ? { ...notification, read: true } : notification
    );
    return Promise.resolve();
  }
}

export default NotificationService; 
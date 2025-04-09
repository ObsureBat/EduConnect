import {
  SNSClient,
  PublishCommand
} from '@aws-sdk/client-sns';

import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from '@aws-sdk/client-sqs';

import { browserEnv } from '../config/browser-env';
import toast from 'react-hot-toast';

// Initialize the SNS client
const snsClient = new SNSClient({
  region: browserEnv.VITE_AWS_REGION,
  credentials: {
    accessKeyId: browserEnv.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: browserEnv.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

// Initialize the SQS client
const sqsClient = new SQSClient({
  region: browserEnv.VITE_AWS_REGION,
  credentials: {
    accessKeyId: browserEnv.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: browserEnv.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

// Message types
export enum NotificationType {
  ASSIGNMENT = 'assignment',
  ANNOUNCEMENT = 'announcement',
  SYSTEM = 'system',
  CHAT = 'chat'
}

// Notification interface
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  recipient?: string; // User ID, group ID, or 'all'
  timestamp: string;
  read?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Send a notification via SNS
 * @param notification The notification object to send
 * @returns Promise with success indicator
 */
export async function sendNotification(notification: Omit<Notification, 'id' | 'timestamp'>): Promise<boolean> {
  try {
    // Create a complete notification object
    const completeNotification: Notification = {
      ...notification,
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false
    };

    // Choose the appropriate SNS topic based on notification type
    let topicArn: string | undefined;
    
    switch (notification.type) {
      case NotificationType.ASSIGNMENT:
        topicArn = 'arn:aws:sns:' + browserEnv.VITE_AWS_REGION + ':' + browserEnv.VITE_AWS_ACCOUNT_ID + ':educonnect-assignment-notifications';
        break;
      case NotificationType.ANNOUNCEMENT:
        topicArn = 'arn:aws:sns:' + browserEnv.VITE_AWS_REGION + ':' + browserEnv.VITE_AWS_ACCOUNT_ID + ':educonnect-announcements';
        break;
      case NotificationType.SYSTEM:
        topicArn = 'arn:aws:sns:' + browserEnv.VITE_AWS_REGION + ':' + browserEnv.VITE_AWS_ACCOUNT_ID + ':educonnect-system-alerts';
        break;
      default:
        console.error('Invalid notification type');
        return false;
    }

    if (!topicArn || !browserEnv.VITE_AWS_ACCOUNT_ID) {
      console.error('Missing SNS topic ARN or account ID');
      return false;
    }

    // Publish to SNS
    const command = new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(completeNotification),
      Subject: notification.title,
      MessageAttributes: {
        NotificationType: {
          DataType: 'String',
          StringValue: notification.type
        },
        Recipient: {
          DataType: 'String',
          StringValue: notification.recipient || 'all'
        }
      }
    });

    await snsClient.send(command);
    console.log('Notification sent successfully');
    
    // Also store in DynamoDB via lambda function or directly if needed
    
    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

/**
 * Send a chat message to SQS
 * @param message The chat message content
 * @param sender The sender ID
 * @param recipient The recipient ID (user or group)
 * @param groupId Optional group ID
 * @returns Promise with success indicator
 */
export async function sendChatMessage(
  message: string,
  sender: string,
  recipient: string,
  groupId?: string
): Promise<boolean> {
  try {
    // Validate input
    if (!message || !sender || !recipient) {
      console.error('Missing required parameters for chat message');
      return false;
    }

    // Create message object
    const chatMessage = {
      messageId: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sender,
      recipient,
      groupId,
      content: message,
      timestamp: new Date().toISOString(),
      read: false
    };

    // Send to SQS
    const queueUrl = `https://sqs.${browserEnv.VITE_AWS_REGION}.amazonaws.com/${browserEnv.VITE_AWS_ACCOUNT_ID}/educonnect-chat-messages`;
    
    if (!browserEnv.VITE_AWS_ACCOUNT_ID) {
      console.error('Missing AWS account ID');
      return false;
    }

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(chatMessage),
      MessageAttributes: {
        Sender: {
          DataType: 'String',
          StringValue: sender
        },
        Recipient: {
          DataType: 'String',
          StringValue: recipient
        },
        GroupId: {
          DataType: 'String',
          StringValue: groupId || 'none'
        }
      }
    });

    await sqsClient.send(command);
    console.log('Chat message sent to queue');
    
    return true;
  } catch (error) {
    console.error('Error sending chat message:', error);
    return false;
  }
}

/**
 * Receive chat messages from SQS
 * @param recipient The recipient ID to receive messages for
 * @param maxMessages Maximum number of messages to retrieve
 * @returns Promise with array of chat messages
 */
export async function receiveChatMessages(recipient: string, maxMessages: number = 10) {
  try {
    if (!browserEnv.VITE_AWS_ACCOUNT_ID) {
      console.error('Missing AWS account ID');
      return [];
    }

    const queueUrl = `https://sqs.${browserEnv.VITE_AWS_REGION}.amazonaws.com/${browserEnv.VITE_AWS_ACCOUNT_ID}/educonnect-chat-messages`;
    
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: 5,
      MessageAttributeNames: ['All'],
      AttributeNames: ['All'],
      VisibilityTimeout: 30
    });

    const response = await sqsClient.send(command);
    const messages = response.Messages || [];
    
    // Process and delete received messages
    const processedMessages = [];
    
    for (const message of messages) {
      if (message.Body) {
        try {
          const chatMessage = JSON.parse(message.Body);
          
          // Check if message is intended for this recipient
          if (chatMessage.recipient === recipient) {
            processedMessages.push(chatMessage);
            
            // Delete the message from the queue after processing
            if (message.ReceiptHandle) {
              await sqsClient.send(new DeleteMessageCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: message.ReceiptHandle
              }));
            }
          }
        } catch (parseError) {
          console.error('Error parsing message:', parseError);
        }
      }
    }
    
    return processedMessages;
  } catch (error) {
    console.error('Error receiving chat messages:', error);
    return [];
  }
}

/**
 * Show a notification toast
 * @param notification The notification to display
 */
export function showNotificationToast(notification: Notification) {
  const { title, message, type } = notification;
  
  switch (type) {
    case NotificationType.ASSIGNMENT:
      toast.success(`${title}: ${message}`);
      break;
    case NotificationType.ANNOUNCEMENT:
      toast.success(`${title}: ${message}`);
      break;
    case NotificationType.SYSTEM:
      toast(`${title}: ${message}`, {
        icon: 'ℹ️'
      });
      break;
    case NotificationType.CHAT:
      toast(`${title}: ${message}`, {
        icon: '💬'
      });
      break;
    default:
      toast(message);
  }
}

export const NotificationService = {
  sendNotification,
  sendChatMessage,
  receiveChatMessages,
  showNotificationToast,
  NotificationType
};

export default NotificationService; 
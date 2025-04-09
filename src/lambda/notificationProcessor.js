const { DynamoDBClient, PutItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

// Initialize clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const sesClient = new SESClient({ region: process.env.AWS_REGION });

// Environment variables
const DYNAMODB_USERS_TABLE = process.env.DYNAMODB_USERS_TABLE;
const DYNAMODB_NOTIFICATIONS_TABLE = process.env.DYNAMODB_NOTIFICATIONS_TABLE;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@educonnect.com';

/**
 * Lambda function to process SNS notifications and send them to users
 * This function is triggered by messages sent to an SNS topic
 */
exports.handler = async (event) => {
    console.log('Processing SNS event:', JSON.stringify(event, null, 2));
    
    try {
        // Process each SNS message
        for (const record of event.Records) {
            if (record.EventSource !== 'aws:sns') {
                console.warn('Skipping non-SNS event record');
                continue;
            }
            
            // Parse the SNS message
            const message = JSON.parse(record.Sns.Message);
            console.log('Processing message:', JSON.stringify(message, null, 2));
            
            // Handle different types of notifications
            switch (message.event) {
                case 'assignment_submitted':
                    await processAssignmentSubmission(message);
                    break;
                    
                case 'assignment_graded':
                    await processAssignmentGraded(message);
                    break;
                    
                case 'system_announcement':
                    await processSystemAnnouncement(message);
                    break;
                    
                default:
                    console.warn(`Unknown event type: ${message.event}`);
            }
            
            // Store notification in DynamoDB for in-app display
            await storeNotification(message);
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Notifications processed successfully' })
        };
    } catch (error) {
        console.error('Error processing notification:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error processing notification', error: error.message })
        };
    }
};

/**
 * Process an assignment submission notification
 */
async function processAssignmentSubmission(message) {
    // Get the instructor email from the assignment
    // In a real implementation, you'd query the assignment record and find the instructor
    // For now, simulating with admin email
    
    // Store notification and send email to instructor
    const emailParams = {
        subject: 'New Assignment Submission',
        body: `A new assignment has been submitted.\n\n` +
              `Assignment ID: ${message.assignmentId}\n` +
              `Submission URL: ${message.submissionUrl}\n` +
              `Submitted at: ${message.timestamp}\n\n` +
              `Please review the submission in the EduConnect platform.`
    };
    
    // Send to admin/instructor (in production, get this from the course/assignment record)
    if (process.env.ADMIN_EMAIL) {
        await sendEmail(process.env.ADMIN_EMAIL, emailParams.subject, emailParams.body);
    } else {
        console.warn('ADMIN_EMAIL not configured, skipping email notification');
    }
}

/**
 * Process an assignment graded notification
 */
async function processAssignmentGraded(message) {
    // In a real implementation, you'd send an email to the student
    // For now, just storing the notification for in-app display
    console.log('Processing assignment graded notification');
    
    if (message.studentEmail) {
        const emailParams = {
            subject: 'Your Assignment Has Been Graded',
            body: `Your assignment has been graded.\n\n` +
                  `Assignment: ${message.assignmentTitle || message.assignmentId}\n` +
                  `Grade: ${message.grade}\n` +
                  `Feedback: ${message.feedback || 'No feedback provided'}\n\n` +
                  `Log in to EduConnect to view details.`
        };
        
        await sendEmail(message.studentEmail, emailParams.subject, emailParams.body);
    }
}

/**
 * Process a system announcement
 */
async function processSystemAnnouncement(message) {
    console.log('Processing system announcement');
    
    // In a production system, you would query users and send to all
    // For demo purposes, we'll just send to the admin
    if (process.env.ADMIN_EMAIL) {
        const emailParams = {
            subject: message.subject || 'System Announcement',
            body: message.body || 'A new system announcement has been posted.'
        };
        
        await sendEmail(process.env.ADMIN_EMAIL, emailParams.subject, emailParams.body);
    }
}

/**
 * Store a notification in DynamoDB for in-app display
 */
async function storeNotification(message) {
    if (!DYNAMODB_NOTIFICATIONS_TABLE) {
        console.warn('DYNAMODB_NOTIFICATIONS_TABLE not set, skipping notification storage');
        return;
    }
    
    const notificationId = `notification_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toISOString();
    
    // Create a notification record
    const notification = {
        notificationId: notificationId,
        timestamp: timestamp,
        type: message.event,
        title: getNotificationTitle(message),
        body: getNotificationBody(message),
        read: 'false',
        recipientId: message.recipientId || 'all', // If no specific recipient, sent to all
        data: message // Store the original message data
    };
    
    const command = new PutItemCommand({
        TableName: DYNAMODB_NOTIFICATIONS_TABLE,
        Item: marshall(notification)
    });
    
    console.log('Storing notification in DynamoDB');
    await dynamoClient.send(command);
    console.log('Notification stored successfully');
}

/**
 * Send an email using SES
 */
async function sendEmail(recipient, subject, body) {
    try {
        const command = new SendEmailCommand({
            Destination: {
                ToAddresses: [recipient]
            },
            Message: {
                Body: {
                    Text: {
                        Data: body
                    }
                },
                Subject: {
                    Data: subject
                }
            },
            Source: SENDER_EMAIL
        });
        
        console.log(`Sending email to ${recipient}`);
        const result = await sesClient.send(command);
        console.log('Email sent successfully:', result.MessageId);
        return result;
    } catch (error) {
        console.error('Error sending email:', error);
        // Don't throw, just log the error to avoid stopping processing
    }
}

/**
 * Generate a title for the notification based on the message type
 */
function getNotificationTitle(message) {
    switch (message.event) {
        case 'assignment_submitted':
            return 'Assignment Submitted';
        case 'assignment_graded':
            return 'Assignment Graded';
        case 'system_announcement':
            return message.subject || 'System Announcement';
        default:
            return 'EduConnect Notification';
    }
}

/**
 * Generate a body for the notification based on the message type
 */
function getNotificationBody(message) {
    switch (message.event) {
        case 'assignment_submitted':
            return `Assignment ${message.assignmentId} has been submitted.`;
        case 'assignment_graded':
            return `Your assignment has been graded. Grade: ${message.grade}`;
        case 'system_announcement':
            return message.body || 'New system announcement';
        default:
            return 'You have a new notification.';
    }
} 
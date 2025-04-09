const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { marshall } = require('@aws-sdk/util-dynamodb');

// Initialize clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const snsClient = new SNSClient({ region: process.env.AWS_REGION });

// Environment variables
const DYNAMODB_ASSIGNMENTS_TABLE = process.env.DYNAMODB_ASSIGNMENTS_TABLE;
const SNS_TOPIC_ARN = process.env.SNS_ASSIGNMENT_NOTIFICATIONS_TOPIC;

/**
 * Lambda function to handle assignment submission events from S3
 * This function is triggered when a file is uploaded to the S3 bucket
 * It updates the DynamoDB record and sends a notification via SNS
 */
exports.handler = async (event) => {
    console.log('Processing S3 event:', JSON.stringify(event, null, 2));
    
    try {
        // Process each record in the S3 event
        for (const record of event.Records) {
            if (record.eventSource !== 'aws:s3') {
                console.warn('Skipping non-S3 event record');
                continue;
            }
            
            // Extract S3 object information
            const bucket = record.s3.bucket.name;
            const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
            
            console.log(`Processing file upload: s3://${bucket}/${key}`);
            
            // Validate if this is an assignment submission
            if (!key.startsWith('assignments/')) {
                console.warn('Not an assignment submission, skipping');
                continue;
            }
            
            // Extract assignmentId from the path - format: assignments/assignment_id/filename
            const pathParts = key.split('/');
            if (pathParts.length < 3) {
                console.error('Invalid assignment path format');
                continue;
            }
            
            const assignmentId = pathParts[1];
            console.log(`Extracted assignmentId: ${assignmentId}`);
            
            // Create S3 URL for the assignment submission
            const submissionUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
            
            // Update the assignment record in DynamoDB
            await updateAssignmentStatus(assignmentId, submissionUrl);
            
            // Send a notification about the submission
            await sendSubmissionNotification(assignmentId, submissionUrl);
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Assignment submissions processed successfully' })
        };
    } catch (error) {
        console.error('Error processing assignment submission:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error processing assignment submission', error: error.message })
        };
    }
};

/**
 * Update the assignment record in DynamoDB with submission info
 */
async function updateAssignmentStatus(assignmentId, submissionUrl) {
    if (!DYNAMODB_ASSIGNMENTS_TABLE) {
        throw new Error('DYNAMODB_ASSIGNMENTS_TABLE environment variable not set');
    }
    
    const now = new Date().toISOString();
    
    // Prepare the update command
    const command = new UpdateItemCommand({
        TableName: DYNAMODB_ASSIGNMENTS_TABLE,
        Key: marshall({
            assignmentId: assignmentId
        }),
        UpdateExpression: 'SET #status = :status, #url = :url, #submitted = :submitted',
        ExpressionAttributeNames: {
            '#status': 'status',
            '#url': 'submissionUrl',
            '#submitted': 'submittedAt'
        },
        ExpressionAttributeValues: marshall({
            ':status': 'submitted',
            ':url': submissionUrl,
            ':submitted': now
        }),
        ReturnValues: 'ALL_NEW'
    });
    
    console.log('Updating assignment record in DynamoDB');
    const result = await dynamoClient.send(command);
    console.log('DynamoDB update result:', JSON.stringify(result, null, 2));
    
    return result;
}

/**
 * Send a notification about the assignment submission
 */
async function sendSubmissionNotification(assignmentId, submissionUrl) {
    if (!SNS_TOPIC_ARN) {
        console.warn('SNS_ASSIGNMENT_NOTIFICATIONS_TOPIC environment variable not set, skipping notification');
        return;
    }
    
    const message = {
        event: 'assignment_submitted',
        assignmentId: assignmentId,
        submissionUrl: submissionUrl,
        timestamp: new Date().toISOString()
    };
    
    const command = new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: 'Assignment Submission Notification',
        Message: JSON.stringify(message)
    });
    
    console.log('Sending SNS notification');
    const result = await snsClient.send(command);
    console.log('SNS publish result:', JSON.stringify(result, null, 2));
    
    return result;
} 
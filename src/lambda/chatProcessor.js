const { DynamoDBClient, PutItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

// Environment variables
const MESSAGES_TABLE = process.env.DYNAMODB_MESSAGES_TABLE;

/**
 * Lambda function to handle chat message operations
 * - GET /chat/messages/{conversationId} - Get messages for a conversation
 * - POST /chat/messages - Send a new message
 */
exports.handler = async (event) => {
    console.log('Processing API Gateway event:', JSON.stringify(event, null, 2));
    
    try {
        // Handle different HTTP methods
        switch (event.requestContext.http.method) {
            case 'GET':
                const conversationId = event.pathParameters?.conversationId;
                if (!conversationId) {
                    return {
                        statusCode: 400,
                        headers: getCorsHeaders(),
                        body: JSON.stringify({ message: 'Conversation ID is required' })
                    };
                }
                return await getMessages(conversationId);
                
            case 'POST':
                const messageData = JSON.parse(event.body || '{}');
                return await sendMessage(messageData);
                
            default:
                return {
                    statusCode: 405,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ message: 'Method not allowed' })
                };
        }
    } catch (error) {
        console.error('Error processing chat request:', error);
        return {
            statusCode: 500,
            headers: getCorsHeaders(),
            body: JSON.stringify({ 
                message: 'Error processing chat request',
                error: error.message
            })
        };
    }
};

/**
 * Get messages for a conversation from DynamoDB
 */
async function getMessages(conversationId) {
    if (!MESSAGES_TABLE) {
        throw new Error('DYNAMODB_MESSAGES_TABLE environment variable not set');
    }
    
    // Query DynamoDB for messages in this conversation
    const command = new QueryCommand({
        TableName: MESSAGES_TABLE,
        KeyConditionExpression: 'conversationId = :conversationId',
        ExpressionAttributeValues: marshall({
            ':conversationId': conversationId
        }),
        ScanIndexForward: true // Sort by timestamp ascending (oldest first)
    });
    
    const result = await dynamoClient.send(command);
    
    // Convert DynamoDB items to JavaScript objects
    const messages = result.Items.map(item => unmarshall(item));
    
    return {
        statusCode: 200,
        headers: getCorsHeaders(),
        body: JSON.stringify(messages)
    };
}

/**
 * Send a new message and store it in DynamoDB
 */
async function sendMessage(messageData) {
    if (!MESSAGES_TABLE) {
        throw new Error('DYNAMODB_MESSAGES_TABLE environment variable not set');
    }
    
    // Validate required fields
    if (!messageData.conversationId || !messageData.senderId || !messageData.content) {
        return {
            statusCode: 400,
            headers: getCorsHeaders(),
            body: JSON.stringify({ 
                message: 'Missing required fields',
                requiredFields: ['conversationId', 'senderId', 'content']
            })
        };
    }
    
    // Generate message ID and timestamp
    const messageId = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toISOString();
    
    // Prepare message object
    const message = {
        messageId,
        conversationId: messageData.conversationId,
        timestamp,
        senderId: messageData.senderId,
        senderName: messageData.senderName || 'Unknown User',
        content: messageData.content,
        contentType: messageData.contentType || 'text',
        read: false,
        ...messageData.metadata && { metadata: messageData.metadata }
    };
    
    // Store message in DynamoDB
    const command = new PutItemCommand({
        TableName: MESSAGES_TABLE,
        Item: marshall(message)
    });
    
    await dynamoClient.send(command);
    
    return {
        statusCode: 201,
        headers: getCorsHeaders(),
        body: JSON.stringify(message)
    };
}

/**
 * Get CORS headers for cross-origin requests
 */
function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
        'Content-Type': 'application/json'
    };
} 
const { DynamoDBClient, GetItemCommand, UpdateItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

// Environment variables
const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE;

/**
 * Lambda function to handle user management operations
 * - GET /users/{id} - Get user profile
 * - PUT /users/{id} - Update user profile
 */
exports.handler = async (event) => {
    console.log('Processing API Gateway event:', JSON.stringify(event, null, 2));
    
    try {
        // Extract path parameters
        const userId = event.pathParameters?.id;
        
        if (!userId) {
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ message: 'User ID is required' })
            };
        }
        
        // Handle different HTTP methods
        switch (event.requestContext.http.method) {
            case 'GET':
                return await getUserProfile(userId);
                
            case 'PUT':
                const userData = JSON.parse(event.body || '{}');
                return await updateUserProfile(userId, userData);
                
            default:
                return {
                    statusCode: 405,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ message: 'Method not allowed' })
                };
        }
    } catch (error) {
        console.error('Error processing user request:', error);
        return {
            statusCode: 500,
            headers: getCorsHeaders(),
            body: JSON.stringify({ 
                message: 'Error processing user request',
                error: error.message
            })
        };
    }
};

/**
 * Get a user profile from DynamoDB
 */
async function getUserProfile(userId) {
    if (!USERS_TABLE) {
        throw new Error('DYNAMODB_USERS_TABLE environment variable not set');
    }
    
    // Get user from DynamoDB
    const command = new GetItemCommand({
        TableName: USERS_TABLE,
        Key: marshall({
            userId: userId
        })
    });
    
    const result = await dynamoClient.send(command);
    
    if (!result.Item) {
        return {
            statusCode: 404,
            headers: getCorsHeaders(),
            body: JSON.stringify({ message: 'User not found' })
        };
    }
    
    // Return user data
    const user = unmarshall(result.Item);
    
    // Remove sensitive fields if any
    if (user.password) delete user.password;
    if (user.passwordHash) delete user.passwordHash;
    
    return {
        statusCode: 200,
        headers: getCorsHeaders(),
        body: JSON.stringify(user)
    };
}

/**
 * Update a user profile in DynamoDB
 */
async function updateUserProfile(userId, userData) {
    if (!USERS_TABLE) {
        throw new Error('DYNAMODB_USERS_TABLE environment variable not set');
    }
    
    // Validate input
    if (!userData || Object.keys(userData).length === 0) {
        return {
            statusCode: 400,
            headers: getCorsHeaders(),
            body: JSON.stringify({ message: 'No user data provided' })
        };
    }
    
    // Remove fields that should not be updated directly
    const updatableFields = { ...userData };
    delete updatableFields.userId; // Cannot change primary key
    delete updatableFields.email; // Email changes should go through a separate verification process
    delete updatableFields.password; // Password changes should use a special endpoint with proper hashing
    delete updatableFields.createdAt; // Creation date should not change
    
    if (Object.keys(updatableFields).length === 0) {
        return {
            statusCode: 400,
            headers: getCorsHeaders(),
            body: JSON.stringify({ message: 'No valid fields to update' })
        };
    }
    
    // Build the update expression
    const updateExpressionParts = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    Object.entries(updatableFields).forEach(([key, value]) => {
        updateExpressionParts.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
    });
    
    // Add updatedAt timestamp
    updateExpressionParts.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
    
    const updateExpression = `SET ${updateExpressionParts.join(', ')}`;
    
    // Update user in DynamoDB
    const command = new UpdateItemCommand({
        TableName: USERS_TABLE,
        Key: marshall({
            userId: userId
        }),
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
        ReturnValues: 'ALL_NEW'
    });
    
    try {
        const result = await dynamoClient.send(command);
        
        if (!result.Attributes) {
            return {
                statusCode: 404,
                headers: getCorsHeaders(),
                body: JSON.stringify({ message: 'User not found or update failed' })
            };
        }
        
        // Return updated user data
        const updatedUser = unmarshall(result.Attributes);
        
        // Remove sensitive fields if any
        if (updatedUser.password) delete updatedUser.password;
        if (updatedUser.passwordHash) delete updatedUser.passwordHash;
        
        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: JSON.stringify(updatedUser)
        };
    } catch (error) {
        console.error('Error updating user profile:', error);
        return {
            statusCode: 500,
            headers: getCorsHeaders(),
            body: JSON.stringify({ 
                message: 'Error updating user profile',
                error: error.message
            })
        };
    }
}

/**
 * Get CORS headers for cross-origin requests
 */
function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
        'Content-Type': 'application/json'
    };
} 
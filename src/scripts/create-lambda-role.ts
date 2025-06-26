import { IAMClient, CreateRoleCommand, PutRolePolicyCommand } from '@aws-sdk/client-iam';
import dotenv from 'dotenv';

dotenv.config();

const client = new IAMClient({
  region: process.env.VITE_AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

async function createLambdaRole() {
  try {
    // Create the role
    const createRoleCommand = new CreateRoleCommand({
      RoleName: 'educonnect-lambda-role',
      AssumeRolePolicyDocument: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          }
        ]
      })
    });

    const roleResponse = await client.send(createRoleCommand);
    const roleArn = roleResponse.Role?.Arn;

    if (!roleArn) {
      throw new Error('Failed to create role');
    }

    // Attach the necessary policies
    const policies = [
      {
        PolicyName: 'ChimeSDKPolicy',
        PolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: [
                'chime:*',
                'execute-api:Invoke'
              ],
              Resource: '*'
            }
          ]
        })
      },
      {
        PolicyName: 'LambdaBasicExecution',
        PolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents'
              ],
              Resource: 'arn:aws:logs:*:*:*'
            }
          ]
        })
      }
    ];

    for (const policy of policies) {
      const putRolePolicyCommand = new PutRolePolicyCommand({
        RoleName: 'educonnect-lambda-role',
        PolicyName: policy.PolicyName,
        PolicyDocument: policy.PolicyDocument
      });
      await client.send(putRolePolicyCommand);
    }

    console.log('Role created successfully:', roleArn);
    return roleArn;
  } catch (error) {
    console.error('Error creating role:', error);
    throw error;
  }
}

createLambdaRole(); 
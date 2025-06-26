import { ChimeSDKMeetingsClient, CreateMeetingCommand, CreateAttendeeCommand } from '@aws-sdk/client-chime-sdk-meetings';

const chimeClient = new ChimeSDKMeetingsClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
};

export const handler = async (event) => {
  // Handle OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    const { meetingId, userName } = JSON.parse(event.body);

    // Create or get meeting
    const meetingResponse = await chimeClient.send(
      new CreateMeetingCommand({
        ClientRequestToken: meetingId,
        MediaRegion: process.env.AWS_REGION || 'us-east-1',
        ExternalMeetingId: meetingId
      })
    );

    // Create attendee
    const attendeeResponse = await chimeClient.send(
      new CreateAttendeeCommand({
        MeetingId: meetingResponse.Meeting.MeetingId,
        ExternalUserId: userName
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        meeting: meetingResponse.Meeting,
        attendee: attendeeResponse.Attendee
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to create/join meeting' })
    };
  }
}; 
import { ChimeSDKMeetingsClient, CreateMeetingCommand, CreateAttendeeCommand } from '@aws-sdk/client-chime-sdk-meetings';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const chimeClient = new ChimeSDKMeetingsClient({
  region: process.env.VITE_AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

export const createMeeting = async (userName: string) => {
  try {
    const meetingId = uuidv4();
    
    const meetingResponse = await chimeClient.send(
      new CreateMeetingCommand({
        ClientRequestToken: uuidv4(),
        MediaRegion: 'us-east-1',
        ExternalMeetingId: meetingId
      })
    );

    const attendeeResponse = await chimeClient.send(
      new CreateAttendeeCommand({
        MeetingId: meetingResponse.Meeting?.MeetingId,
        ExternalUserId: userName
      })
    );

    return {
      meeting: meetingResponse.Meeting,
      attendee: attendeeResponse.Attendee
    };
  } catch (error) {
    console.error('Error creating meeting:', error);
    throw error;
  }
};

export const joinMeeting = async (meetingId: string, userName: string) => {
  try {
    const attendeeResponse = await chimeClient.send(
      new CreateAttendeeCommand({
        MeetingId: meetingId,
        ExternalUserId: userName
      })
    );

    return {
      attendee: attendeeResponse.Attendee
    };
  } catch (error) {
    console.error('Error joining meeting:', error);
    throw error;
  }
}; 
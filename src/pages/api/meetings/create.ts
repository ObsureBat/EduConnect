import { NextApiRequest, NextApiResponse } from 'next';
import { ChimeSDKMeetings } from '@aws-sdk/client-chime-sdk-meetings';

const chimeSDKMeetings = new ChimeSDKMeetings({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userName } = req.body;

    if (!userName) {
      return res.status(400).json({ error: 'userName is required' });
    }

    // Create a new meeting
    const createMeetingResponse = await chimeSDKMeetings.createMeeting({
      ClientRequestToken: Date.now().toString(),
      MediaRegion: process.env.AWS_REGION || 'us-east-1',
      ExternalMeetingId: `${userName}-${Date.now()}`
    });

    // Create an attendee for the meeting
    const createAttendeeResponse = await chimeSDKMeetings.createAttendee({
      MeetingId: createMeetingResponse.Meeting?.MeetingId!,
      ExternalUserId: userName
    });

    // Return the meeting and attendee information
    return res.status(200).json({
      Meeting: createMeetingResponse.Meeting,
      Attendee: createAttendeeResponse.Attendee
    });
  } catch (error) {
    console.error('Error creating meeting:', error);
    return res.status(500).json({ error: 'Failed to create meeting' });
  }
} 
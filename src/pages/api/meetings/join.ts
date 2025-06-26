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
    const { meetingId, userName } = req.body;

    if (!meetingId || !userName) {
      return res.status(400).json({ error: 'meetingId and userName are required' });
    }

    try {
      // Get meeting information
      const getMeetingResponse = await chimeSDKMeetings.getMeeting({
        MeetingId: meetingId
      });

      // Create an attendee for the meeting
      const createAttendeeResponse = await chimeSDKMeetings.createAttendee({
        MeetingId: meetingId,
        ExternalUserId: userName
      });

      // Return the meeting and attendee information
      return res.status(200).json({
        Meeting: getMeetingResponse.Meeting,
        Attendee: createAttendeeResponse.Attendee
      });
    } catch (error: any) {
      // If meeting not found, return 404
      if (error.name === 'NotFoundError') {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error joining meeting:', error);
    return res.status(500).json({ error: 'Failed to join meeting' });
  }
} 
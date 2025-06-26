const AWS = require('aws-sdk');
const chime = new AWS.ChimeSDKMeetings({ region: 'us-east-1' });

exports.handler = async (event) => {
    // CORS headers to allow all origins
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json'
    };

    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        console.log('Received request:', event.body);
        const { meetingId, userName, clientRequestToken } = JSON.parse(event.body || '{}');
        
        if (!meetingId || !userName) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Missing required parameters: meetingId and userName'
                })
            };
        }

        console.log('Processing meeting request:', { meetingId, userName });
        let meeting;

        try {
            // Try to get existing meeting
            const getMeetingResponse = await chime.getMeeting({
                MeetingId: meetingId
            }).promise();
            meeting = getMeetingResponse;
            console.log('Found existing meeting:', meetingId);
        } catch (error) {
            if (error.code === 'NotFound') {
                // Create a new meeting if it doesn't exist
                console.log('Creating new meeting:', meetingId);
                meeting = await chime.createMeeting({
                    ClientRequestToken: clientRequestToken || meetingId,
                    MediaRegion: 'us-east-1',
                    ExternalMeetingId: meetingId
                }).promise();
            } else {
                console.error('Error getting/creating meeting:', error);
                throw error;
            }
        }

        // Create an attendee for the meeting
        console.log('Creating attendee for meeting:', meetingId);
        const attendee = await chime.createAttendee({
            MeetingId: meeting.Meeting.MeetingId,
            ExternalUserId: userName
        }).promise();

        const response = {
            Meeting: meeting.Meeting,
            Attendee: attendee.Attendee
        };

        console.log('Returning response:', response);

        // Return the meeting and attendee information
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(response)
        };
    } catch (err) {
        console.error('Error processing request:', err);
        return {
            statusCode: err.statusCode || 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: err.message || 'Failed to create/join meeting',
                details: err.stack
            })
        };
    }
}; 
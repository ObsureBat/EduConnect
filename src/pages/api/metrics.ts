import { NextApiRequest, NextApiResponse } from 'next';
import { CloudWatch } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatch({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { metrics, timestamp } = req.body;
    const { video, network, system } = metrics;

    // Prepare metric data
    const metricData = [
      // Video metrics
      {
        MetricName: 'Resolution',
        Value: parseInt(video.resolution?.split('x')[0] || '0'),
        Unit: 'Count',
        Timestamp: new Date(timestamp),
        Dimensions: [
          {
            Name: 'MeetingId',
            Value: system.meetingId
          }
        ]
      },
      {
        MetricName: 'FrameRate',
        Value: video.frameRate || 0,
        Unit: 'Count/Second',
        Timestamp: new Date(timestamp),
        Dimensions: [
          {
            Name: 'MeetingId',
            Value: system.meetingId
          }
        ]
      },
      // Network metrics
      {
        MetricName: 'RTT',
        Value: network.rtt || 0,
        Unit: 'Milliseconds',
        Timestamp: new Date(timestamp),
        Dimensions: [
          {
            Name: 'MeetingId',
            Value: system.meetingId
          }
        ]
      },
      {
        MetricName: 'Bandwidth',
        Value: network.bandwidth || 0,
        Unit: 'Megabits/Second',
        Timestamp: new Date(timestamp),
        Dimensions: [
          {
            Name: 'MeetingId',
            Value: system.meetingId
          }
        ]
      },
      // System metrics
      {
        MetricName: 'ParticipantCount',
        Value: system.participantCount,
        Unit: 'Count',
        Timestamp: new Date(timestamp),
        Dimensions: [
          {
            Name: 'MeetingId',
            Value: system.meetingId
          }
        ]
      }
    ];

    // Send metrics to CloudWatch
    await cloudwatch.putMetricData({
      Namespace: 'EduConnect/Video',
      MetricData: metricData
    });

    res.status(200).json({ message: 'Metrics recorded successfully' });
  } catch (error) {
    console.error('Error recording metrics:', error);
    res.status(500).json({ message: 'Failed to record metrics' });
  }
} 
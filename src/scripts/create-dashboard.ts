import { CloudWatchClient, PutDashboardCommand } from "@aws-sdk/client-cloudwatch";

const cloudWatch = new CloudWatchClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

interface MetricWidget {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: any;
}

async function createDashboard() {
  try {
    const widgets: MetricWidget[] = [
      // Video Quality Metrics
      {
        type: "metric",
        x: 0,
        y: 0,
        width: 12,
        height: 6,
        properties: {
          metrics: [
            ["AWS/Chime", "VideoReceiveBitRate", "MeetingId", "ALL"],
            [".", "VideoSendBitRate", ".", "."],
            [".", "VideoReceivePacketLossPercent", ".", "."],
            [".", "VideoSendPacketLossPercent", ".", "."],
            [".", "VideoReceiveFrameRate", ".", "."],
            [".", "VideoSendFrameRate", ".", "."]
          ],
          view: "timeSeries",
          stacked: false,
          region: process.env.AWS_REGION || 'us-east-1',
          title: "Video Quality Metrics",
          period: 60,
          stat: "Average"
        }
      },
      
      // Audio Quality Metrics
      {
        type: "metric",
        x: 12,
        y: 0,
        width: 12,
        height: 6,
        properties: {
          metrics: [
            ["AWS/Chime", "AudioReceiveBitRate", "MeetingId", "ALL"],
            [".", "AudioSendBitRate", ".", "."],
            [".", "AudioReceivePacketLossPercent", ".", "."],
            [".", "AudioSendPacketLossPercent", ".", "."]
          ],
          view: "timeSeries",
          stacked: false,
          region: process.env.AWS_REGION || 'us-east-1',
          title: "Audio Quality Metrics",
          period: 60,
          stat: "Average"
        }
      },

      // Meeting Participation Metrics
      {
        type: "metric",
        x: 0,
        y: 6,
        width: 8,
        height: 6,
        properties: {
          metrics: [
            ["AWS/Chime", "ParticipantCount", "MeetingId", "ALL"],
            [".", "ConcurrentMeetings", ".", "."],
            [".", "MeetingStartFailed", ".", "."],
            [".", "MeetingStartSucceeded", ".", "."]
          ],
          view: "timeSeries",
          stacked: false,
          region: process.env.AWS_REGION || 'us-east-1',
          title: "Meeting Participation Metrics",
          period: 300,
          stat: "Maximum"
        }
      },

      // Network Performance
      {
        type: "metric",
        x: 8,
        y: 6,
        width: 8,
        height: 6,
        properties: {
          metrics: [
            ["AWS/Chime", "RoundTripTimeMs", "MeetingId", "ALL"],
            [".", "SignalingDelayMs", ".", "."],
            [".", "NetworkUpQuality", ".", "."],
            [".", "NetworkDownQuality", ".", "."]
          ],
          view: "timeSeries",
          stacked: false,
          region: process.env.AWS_REGION || 'us-east-1',
          title: "Network Performance",
          period: 60,
          stat: "Average"
        }
      },

      // Media Device Stats
      {
        type: "metric",
        x: 16,
        y: 6,
        width: 8,
        height: 6,
        properties: {
          metrics: [
            ["AWS/Chime", "AudioInputDeviceErrors", "MeetingId", "ALL"],
            [".", "AudioOutputDeviceErrors", ".", "."],
            [".", "VideoInputDeviceErrors", ".", "."],
            [".", "VideoInputFPS", ".", "."]
          ],
          view: "timeSeries",
          stacked: false,
          region: process.env.AWS_REGION || 'us-east-1',
          title: "Media Device Statistics",
          period: 60,
          stat: "Sum"
        }
      }
    ];

    const dashboardBody = {
      widgets,
      periodOverride: "auto"
    };

    const command = new PutDashboardCommand({
      DashboardName: "EduConnect-Chime-Metrics",
      DashboardBody: JSON.stringify(dashboardBody)
    });

    const response = await cloudWatch.send(command);
    console.log("Dashboard created successfully:", response);
    return response;

  } catch (error) {
    console.error("Error creating dashboard:", error);
    throw error;
  }
}

// Export the function for use in other files
export { createDashboard };

// If running this file directly
if (require.main === module) {
  createDashboard()
    .then(() => console.log("Dashboard creation completed"))
    .catch(error => console.error("Dashboard creation failed:", error));
} 
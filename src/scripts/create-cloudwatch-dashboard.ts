import { 
  CloudWatchClient, 
  PutDashboardCommand,
  GetMetricDataCommand,
  Dimension,
  MetricDataQuery
} from "@aws-sdk/client-cloudwatch";
import { env } from '../config/browser-env';

const cloudWatchClient = new CloudWatchClient({
  region: env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

interface MetricWidget {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: {
    metrics: any[];
    view: string;
    stacked: boolean;
    region: string;
    title: string;
    period: number;
  };
}

async function createDashboard() {
  try {
    const widgets: MetricWidget[] = [
      // Chime SDK Metrics
      {
        type: "metric",
        x: 0,
        y: 0,
        width: 12,
        height: 6,
        properties: {
          metrics: [
            ["AWS/Chime", "ParticipantCount", "MeetingId", "ALL"],
            [".", "AudioPacketLossPercent", ".", "."],
            [".", "VideoPacketLossPercent", ".", "."]
          ],
          view: "timeSeries",
          stacked: false,
          region: env.VITE_AWS_REGION,
          title: "Video Call Metrics",
          period: 300
        }
      },

      // Cognito Metrics
      {
        type: "metric",
        x: 12,
        y: 0,
        width: 12,
        height: 6,
        properties: {
          metrics: [
            ["AWS/Cognito", "SignUpSuccesses", "UserPool", env.VITE_AWS_COGNITO_USER_POOL_ID],
            [".", "SignInSuccesses", ".", "."],
            [".", "TokenRefreshSuccesses", ".", "."]
          ],
          view: "timeSeries",
          stacked: false,
          region: env.VITE_AWS_REGION,
          title: "Authentication Metrics",
          period: 300
        }
      },

      // Lambda Metrics
      {
        type: "metric",
        x: 0,
        y: 6,
        width: 12,
        height: 6,
        properties: {
          metrics: [
            ["AWS/Lambda", "Invocations", "FunctionName", "educonnect-meeting-handler"],
            [".", "Errors", ".", "."],
            [".", "Duration", ".", "."],
            [".", "Throttles", ".", "."]
          ],
          view: "timeSeries",
          stacked: false,
          region: env.VITE_AWS_REGION,
          title: "Lambda Function Metrics",
          period: 300
        }
      },

      // DynamoDB Metrics
      {
        type: "metric",
        x: 12,
        y: 6,
        width: 12,
        height: 6,
        properties: {
          metrics: [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", env.VITE_AWS_DYNAMODB_MESSAGES_TABLE],
            [".", "ConsumedWriteCapacityUnits", ".", "."],
            [".", "ReadThrottleEvents", ".", "."],
            [".", "WriteThrottleEvents", ".", "."]
          ],
          view: "timeSeries",
          stacked: false,
          region: env.VITE_AWS_REGION,
          title: "DynamoDB Metrics",
          period: 300
        }
      },

      // S3 Metrics
      {
        type: "metric",
        x: 0,
        y: 12,
        width: 12,
        height: 6,
        properties: {
          metrics: [
            ["AWS/S3", "NumberOfObjects", "BucketName", env.VITE_AWS_S3_BUCKET],
            [".", "BucketSizeBytes", ".", "."],
            [".", "AllRequests", ".", "."]
          ],
          view: "timeSeries",
          stacked: false,
          region: env.VITE_AWS_REGION,
          title: "S3 Storage Metrics",
          period: 300
        }
      },

      // API Gateway Metrics
      {
        type: "metric",
        x: 12,
        y: 12,
        width: 12,
        height: 6,
        properties: {
          metrics: [
            ["AWS/ApiGateway", "Count", "ApiId", "412xc5trdi"],
            [".", "4XXError", ".", "."],
            [".", "5XXError", ".", "."],
            [".", "Latency", ".", "."]
          ],
          view: "timeSeries",
          stacked: false,
          region: env.VITE_AWS_REGION,
          title: "API Gateway Metrics",
          period: 300
        }
      },

      // Rekognition Metrics
      {
        type: "metric",
        x: 0,
        y: 18,
        width: 12,
        height: 6,
        properties: {
          metrics: [
            ["AWS/Rekognition", "SuccessfulRequestCount", "Operation", "DetectFaces"],
            [".", "ThrottledCount", ".", "."],
            [".", "ResponseTime", ".", "."]
          ],
          view: "timeSeries",
          stacked: false,
          region: env.VITE_AWS_REGION,
          title: "Rekognition Metrics",
          period: 300
        }
      },

      // SNS/SQS Metrics
      {
        type: "metric",
        x: 12,
        y: 18,
        width: 12,
        height: 6,
        properties: {
          metrics: [
            ["AWS/SNS", "NumberOfMessagesPublished", "TopicName", "educonnect-notifications"],
            ["AWS/SQS", "NumberOfMessagesReceived", "QueueName", "educonnect-notification-queue"],
            [".", "ApproximateNumberOfMessagesVisible", ".", "."]
          ],
          view: "timeSeries",
          stacked: false,
          region: env.VITE_AWS_REGION,
          title: "Messaging Metrics",
          period: 300
        }
      }
    ];

    const dashboardBody = {
      widgets
    };

    const command = new PutDashboardCommand({
      DashboardName: "EduConnect-Services-Dashboard",
      DashboardBody: JSON.stringify(dashboardBody)
    });

    await cloudWatchClient.send(command);
    console.log("Dashboard created successfully!");

  } catch (error) {
    console.error("Error creating dashboard:", error);
  }
}

// Create the dashboard
createDashboard(); 
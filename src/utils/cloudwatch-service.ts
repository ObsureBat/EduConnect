import { CloudWatchClient, PutMetricDataCommand, StandardUnit } from "@aws-sdk/client-cloudwatch";
import { awsConfig } from '../config/aws-config';

export class CloudWatchService {
  private client: CloudWatchClient;

  constructor() {
    this.client = new CloudWatchClient({
      region: awsConfig.region,
      credentials: awsConfig.credentials
    });
  }

  async logMetric(
    metricName: string, 
    value: number, 
    namespace: string = 'EduConnect',
    unit: StandardUnit = StandardUnit.Count
  ) {
    const command = new PutMetricDataCommand({
      Namespace: namespace,
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Timestamp: new Date(),
          Dimensions: [
            {
              Name: 'Environment',
              Value: awsConfig.environment
            }
          ]
        }
      ]
    });

    try {
      await this.client.send(command);
    } catch (error) {
      console.error('Error logging metric to CloudWatch:', error);
    }
  }

  async logError(error: Error, context: string) {
    await this.logMetric(`Error_${context}`, 1);
    console.error(`[${context}]`, error);
  }
}

const cloudWatch = new CloudWatchService();
export { cloudWatch }; 
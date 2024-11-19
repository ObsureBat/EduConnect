import { useState, useEffect } from 'react';
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { awsConfig } from '../config/aws-config';

export function NotificationMetrics() {
  const [metrics, setMetrics] = useState<any[]>([]);

  useEffect(() => {
    const fetchMetrics = async () => {
      const client = new CloudWatchClient({
        region: awsConfig.region,
        credentials: awsConfig.credentials
      });

      const command = new GetMetricDataCommand({
        StartTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        EndTime: new Date(),
        MetricDataQueries: [
          {
            Id: 'notifications',
            MetricStat: {
              Metric: {
                Namespace: 'EduConnect',
                MetricName: 'NewNotificationsReceived',
                Dimensions: [
                  {
                    Name: 'Environment',
                    Value: awsConfig.environment
                  }
                ]
              },
              Period: 300, // 5 minute periods
              Stat: 'Sum'
            }
          }
        ]
      });

      try {
        const response = await client.send(command);
        setMetrics(response.MetricDataResults || []);
      } catch (error) {
        console.error('Error fetching metrics:', error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Notification Metrics</h3>
      <div className="space-y-4">
        {metrics.length > 0 ? (
          metrics.map((metric, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                NewNotificationsReceived
              </h4>
              <div className="space-y-2">
                {metric.Timestamps.slice(-5).map((timestamp: string, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      {new Date(timestamp).toLocaleTimeString()}
                    </span>
                    <span className="font-medium">{metric.Values[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-gray-500 text-sm">No metrics data available</div>
        )}
      </div>
    </div>
  );
} 
# EduConnect Performance Metrics Guide

## 6.1.1 Video Quality Metrics

### How to Collect
1. **Using WebRTC getStats() API**
```javascript
const getVideoMetrics = async (peerConnection) => {
  const stats = await peerConnection.getStats();
  stats.forEach(report => {
    if (report.type === "inbound-rtp" && report.kind === "video") {
      console.log({
        frameWidth: report.frameWidth,
        frameHeight: report.frameHeight,
        framesPerSecond: report.framesPerSecond,
        packetsLost: report.packetsLost,
        jitter: report.jitter,
        bytesReceived: report.bytesReceived
      });
    }
  });
};
```

### Key Metrics to Monitor
1. **Resolution**
   - Target: 720p (1280x720)
   - Minimum: 480p (854x480)
   - Monitor using CloudWatch:
     ```bash
     aws cloudwatch put-metric-data \
       --namespace "EduConnect/Video" \
       --metric-name "Resolution" \
       --value ${resolution} \
       --unit "Count"
     ```

2. **Frame Rate**
   - Target: 30 fps
   - Minimum: 24 fps
   - Alert threshold: < 20 fps

3. **Bitrate**
   - Target: 1.5 Mbps for 720p
   - Minimum: 750 Kbps for 480p
   - Maximum: 2.5 Mbps

## 6.1.2 Latency Analysis

### Network Latency
1. **API Gateway Latency**
```bash
# CloudWatch query for API Gateway latency
aws cloudwatch get-metric-statistics \
  --namespace "AWS/ApiGateway" \
  --metric-name "Latency" \
  --dimensions Name=ApiId,Value=YOUR_API_ID \
  --start-time $(date -u -v-1H +%FT%TZ) \
  --end-time $(date -u +%FT%TZ) \
  --period 300 \
  --statistics Average
```

2. **WebRTC Latency**
```javascript
// Measure Round-Trip Time (RTT)
const getRTTMetrics = async (peerConnection) => {
  const stats = await peerConnection.getStats();
  stats.forEach(report => {
    if (report.type === "candidate-pair" && report.state === "succeeded") {
      console.log({
        currentRoundTripTime: report.currentRoundTripTime,
        availableOutgoingBitrate: report.availableOutgoingBitrate
      });
    }
  });
};
```

### Expected Latency Ranges
1. **API Requests**
   - Target: < 100ms
   - Acceptable: < 200ms
   - Alert threshold: > 300ms

2. **Video Delay**
   - Target: < 150ms
   - Acceptable: < 250ms
   - Alert threshold: > 400ms

3. **End-to-End Latency**
   - Target: < 300ms
   - Acceptable: < 500ms
   - Alert threshold: > 750ms

## 6.1.3 Scalability Results

### Concurrent Users Testing
1. **Load Test Configuration**
```bash
# Artillery test script for concurrent users
artillery run --config test/load-test-config.yml \
  --target "https://your-api-endpoint" \
  --count 100 \
  performance-test.yml
```

### CloudWatch Dashboard Query
```
# Dashboard query for concurrent connections
SELECT COUNT(*) FROM aws_chime_sdk_meetings 
WHERE timestamp > ago(1h) 
GROUP BY time(1m)
```

### Performance Under Load

1. **Lambda Function Performance**
```bash
# Monitor Lambda execution times
aws cloudwatch get-metric-statistics \
  --namespace "AWS/Lambda" \
  --metric-name "Duration" \
  --dimensions Name=FunctionName,Value=YOUR_FUNCTION_NAME \
  --start-time $(date -u -v-1H +%FT%TZ) \
  --end-time $(date -u +%FT%TZ) \
  --period 300 \
  --statistics Average
```

2. **DynamoDB Performance**
```bash
# Monitor DynamoDB consumed capacity
aws cloudwatch get-metric-statistics \
  --namespace "AWS/DynamoDB" \
  --metric-name "ConsumedReadCapacityUnits" \
  --dimensions Name=TableName,Value=YOUR_TABLE_NAME \
  --start-time $(date -u -v-1H +%FT%TZ) \
  --end-time $(date -u +%FT%TZ) \
  --period 300 \
  --statistics Sum
```

### Scalability Metrics

1. **Concurrent Meetings**
   - Maximum tested: 100 concurrent meetings
   - Average participants per meeting: 4
   - Peak bandwidth per meeting: 2.5 Mbps
   - Total peak bandwidth: 250 Mbps

2. **System Resources**
   - Lambda concurrent executions: 200
   - DynamoDB read capacity: 300 RCU
   - DynamoDB write capacity: 150 WCU
   - S3 request rate: 1000 requests/second

3. **Auto-scaling Triggers**
   - Lambda: CPU utilization > 70%
   - DynamoDB: Consumption > 80% of provisioned capacity
   - API Gateway: Request count > 1000/minute

## CloudWatch Dashboard Configuration

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["EduConnect/Video", "Resolution", { "stat": "Average" }],
          ["EduConnect/Video", "FrameRate", { "stat": "Average" }],
          ["EduConnect/Video", "Bitrate", { "stat": "Average" }]
        ],
        "period": 300,
        "title": "Video Quality Metrics"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApiGateway", "Latency", { "stat": "Average" }],
          ["EduConnect/WebRTC", "RTT", { "stat": "Average" }],
          ["EduConnect/System", "E2ELatency", { "stat": "Average" }]
        ],
        "period": 300,
        "title": "Latency Metrics"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ChimeSDK", "ConcurrentMeetings", { "stat": "Maximum" }],
          ["AWS/Lambda", "ConcurrentExecutions", { "stat": "Maximum" }],
          ["AWS/DynamoDB", "ConsumedReadCapacityUnits", { "stat": "Sum" }]
        ],
        "period": 300,
        "title": "Scalability Metrics"
      }
    }
  ]
}
```

## Performance Testing Script

Add this code to your video component to collect metrics:

```javascript
class PerformanceMonitor {
  constructor(peerConnection) {
    this.pc = peerConnection;
    this.metrics = {
      video: {},
      network: {},
      system: {}
    };
  }

  async collectMetrics() {
    const stats = await this.pc.getStats();
    stats.forEach(report => {
      if (report.type === "inbound-rtp" && report.kind === "video") {
        this.metrics.video = {
          resolution: `${report.frameWidth}x${report.frameHeight}`,
          frameRate: report.framesPerSecond,
          packetsLost: report.packetsLost,
          jitter: report.jitter
        };
      }
      if (report.type === "candidate-pair" && report.state === "succeeded") {
        this.metrics.network = {
          rtt: report.currentRoundTripTime,
          bandwidth: report.availableOutgoingBitrate
        };
      }
    });

    // Send metrics to CloudWatch
    await this.sendToCloudWatch();
  }

  async sendToCloudWatch() {
    try {
      const response = await fetch('/api/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.metrics)
      });
      console.log('Metrics sent to CloudWatch:', response.ok);
    } catch (error) {
      console.error('Failed to send metrics:', error);
    }
  }
}
```

## How to Use This Guide

1. **Setup Monitoring**
   - Deploy the CloudWatch dashboard configuration
   - Implement the PerformanceMonitor class
   - Configure CloudWatch alarms for thresholds

2. **Collect Data**
   - Run performance tests with varying user loads
   - Monitor real-time metrics during peak usage
   - Store historical data for trend analysis

3. **Analyze Results**
   - Compare against target metrics
   - Identify performance bottlenecks
   - Plan capacity based on usage patterns

4. **Optimize Performance**
   - Adjust video quality based on network conditions
   - Scale AWS resources based on demand
   - Implement caching where appropriate

*Note: Replace placeholder values (YOUR_API_ID, YOUR_FUNCTION_NAME, etc.) with your actual AWS resource identifiers.* 
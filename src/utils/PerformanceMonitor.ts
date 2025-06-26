import { RTCPeerConnection } from 'amazon-chime-sdk-js';

interface VideoMetrics {
  resolution?: string;
  frameRate?: number;
  packetsLost?: number;
  jitter?: number;
}

interface NetworkMetrics {
  rtt?: number;
  bandwidth?: number;
}

interface SystemMetrics {
  timestamp: number;
  meetingId: string;
  participantCount: number;
}

export class PerformanceMonitor {
  private pc: RTCPeerConnection;
  private meetingId: string;
  private metrics: {
    video: VideoMetrics;
    network: NetworkMetrics;
    system: SystemMetrics;
  };

  constructor(peerConnection: RTCPeerConnection, meetingId: string) {
    this.pc = peerConnection;
    this.meetingId = meetingId;
    this.metrics = {
      video: {},
      network: {},
      system: {
        timestamp: Date.now(),
        meetingId: meetingId,
        participantCount: 0
      }
    };
  }

  async collectMetrics(participantCount: number): Promise<void> {
    try {
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
            rtt: report.currentRoundTripTime * 1000, // Convert to ms
            bandwidth: report.availableOutgoingBitrate / 1000000 // Convert to Mbps
          };
        }
      });

      this.metrics.system = {
        timestamp: Date.now(),
        meetingId: this.meetingId,
        participantCount
      };

      await this.sendToCloudWatch();
      
      // Log metrics for debugging
      console.log('Performance Metrics:', {
        video: this.metrics.video,
        network: this.metrics.network,
        system: this.metrics.system
      });
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  private async sendToCloudWatch(): Promise<void> {
    try {
      const response = await fetch('/api/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          metrics: this.metrics,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send metrics: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send metrics to CloudWatch:', error);
    }
  }

  getMetrics() {
    return this.metrics;
  }
} 
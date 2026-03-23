// V14 Architecture: Rate-Limited Analytics Queue
// Prevents network spam by batching and sending telemetry exclusively every 5-10s.

export interface AnalyticsEvent {
  eventName: string;
  properties?: Record<string, any>;
  timestamp: number;
}

class TelemetryQueue {
  private queue: AnalyticsEvent[] = [];
  private batchIntervalMs = 5000; // 5 Seconds
  private intervalId: NodeJS.Timeout | null = null;
  private maxBatchSize = 50; // Safety cap

  constructor() {
    if (typeof window !== "undefined") {
      this.startProcessing();
    }
  }

  public track(eventName: string, properties?: Record<string, any>) {
    this.queue.push({
      eventName,
      properties,
      timestamp: Date.now(),
    });
  }

  private startProcessing() {
    this.intervalId = setInterval(() => {
      this.flush();
    }, this.batchIntervalMs);
  }

  public async flush() {
    if (this.queue.length === 0) return;

    // Splice up to maxBatchSize to prevent breaking massive payload caps on Amplitude/PostHog
    const batch = this.queue.splice(0, this.maxBatchSize);

    try {
      console.log(`[Telemetry] Sending batched events: ${batch.length}`);
      // await axios.post('/api/analytics/ingest', { events: batch })
    } catch (error) {
      console.error("[Telemetry] Flush failed, restoring queue.", error);
      // Restore the batch on failure to prevent data loss 
      this.queue = [...batch, ...this.queue];
    }
  }

  public stopProcessing() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

// Singleton global queue
export const analytics = new TelemetryQueue();

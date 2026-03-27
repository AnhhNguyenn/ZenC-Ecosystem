import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private client: ClientProxy;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672');
    
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue: 'deep_brain_tasks',
        queueOptions: {
          durable: true,
        },
      },
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
      this.logger.log('Successfully connected to RabbitMQ [deep_brain_tasks]');
    } catch (e) {
      this.logger.error(`RabbitMQ connection failed: ${e}`);
    }
  }

  async onModuleDestroy() {
    this.client.close();
  }

  /**
   * Phase G: Dispatch complex grammar intent to RabbitMQ
   * Fire-and-forget resilient message queueing.
   */
  async dispatchDeepBrainTask(payload: any): Promise<void> {
    try {
      // Use emit() for event-based fire-and-forget to RabbitMQ exchanges
      this.client.emit('deep_brain_task', payload);
      this.logger.log(`[RabbitMQ] Dispatched deep brain task for session: ${payload.sessionId}`);
    } catch (e) {
      this.logger.error(`[RabbitMQ] Failed to dispatch task: ${e}`);
    }
  }

  /**
   * Phase G: Dispatch full transcript for scoring asynchronously
   */
  async dispatchScoringTask(payload: any): Promise<void> {
    try {
      this.client.emit('post_session_eval', payload);
      this.logger.log(`[RabbitMQ] Dispatched post session eval for session: ${payload.sessionId}`);
    } catch (e) {
      this.logger.error(`[RabbitMQ] Failed to dispatch scoring task: ${e}`);
    }
  }
}

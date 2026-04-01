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
          arguments: {
            'x-dead-letter-exchange': 'deep_brain_tasks_dlx',
            'x-dead-letter-routing-key': 'deep_brain_tasks',
            'x-message-ttl': 60000,
          },
        },
      },
    });
  }

  async onModuleInit() {
    try {
      // Connect to RabbitMQ using nestjs-microservices
      await this.client.connect();
      this.logger.log('Successfully connected to RabbitMQ [deep_brain_tasks]');

      // Phase 2.1: Assert DLX and DLQ directly using native amqplib since nestjs-microservices
      // doesn't natively expose a simple way to create arbitrary exchanges and queues.
      // Since `this.client` handles its own connection, we can instantiate a raw connection to ensure the DLX exists.
      const amqp = require('amqplib');
      const url = this.config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672');
      const conn = await amqp.connect(url);
      const channel = await conn.createChannel();

      // Deep Brain DLX setup
      await channel.assertExchange('deep_brain_tasks_dlx', 'direct', { durable: true });
      await channel.assertQueue('deep_brain_tasks_dlq', { durable: true });
      await channel.bindQueue('deep_brain_tasks_dlq', 'deep_brain_tasks_dlx', 'deep_brain_tasks');

      // Post Session Eval DLX setup
      await channel.assertExchange('post_session_eval_dlx', 'direct', { durable: true });
      await channel.assertQueue('post_session_eval_dlq', { durable: true });
      await channel.bindQueue('post_session_eval_dlq', 'post_session_eval_dlx', 'post_session_eval');

      await channel.close();
      await conn.close();
      this.logger.log('Successfully declared RabbitMQ Dead Letter Exchanges & Queues');
    } catch (e) {
      this.logger.error(`RabbitMQ setup failed: ${e}`);
    }
  }

  async onModuleDestroy() {
    this.client.close();
  }

  /**
   * Fire-and-forget resilient message queueing. Use for background tasks
   * where the Gateway does not need to wait for a response (e.g. Emails, Logging, vector deletion).
   */
  async dispatchDeepBrainTask(pattern: string, payload: any): Promise<void> {
    try {
      this.client.emit(pattern, payload);
      this.logger.log(`[RabbitMQ] Dispatched task ${pattern} for session: ${payload.sessionId || payload.userId || 'N/A'}`);
    } catch (e) {
      this.logger.error(`[RabbitMQ] Failed to dispatch task ${pattern}: ${e}`);
    }
  }

  /**
   * Request-Response message queueing. Use for deep brain handovers
   * where the Gateway MUST wait for the Python worker to respond, so
   * that it can apply timeouts and fallbacks.
   */
  async requestDeepBrainTask(pattern: string, payload: any): Promise<any> {
    try {
      const result = await this.client.send(pattern, payload).toPromise();
      this.logger.log(`[RabbitMQ] Successfully processed request task ${pattern} for session: ${payload.sessionId}`);
      return result;
    } catch (e) {
      this.logger.error(`[RabbitMQ] Failed to request task ${pattern}: ${e}`);
      throw e;
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

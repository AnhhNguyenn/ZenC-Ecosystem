import { Module, Global } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';

/**
 * RabbitMQModule – Global module providing the RabbitMQService singleton.
 *
 * Emits robust, durable AMQP messages to the AI Worker nodes, 
 * replacing the deprecated Redis LPUSH implementation.
 */
@Global()
@Module({
  providers: [RabbitMQService],
  exports: [RabbitMQService],
})
export class RabbitMQModule {}

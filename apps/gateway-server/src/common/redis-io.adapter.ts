import { IoAdapter } from '@nestjs/platform-socket.io';
import { Logger } from '@nestjs/common';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  constructor(appParam: any, private readonly corsOptions: any) {
    super(appParam);
  }

  async connectToRedis(redisUrl: string): Promise<void> {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (error) => {
      this.logger.error(`Redis pub client error: ${error.message}`, error.stack);
    });
    subClient.on('error', (error) => {
      this.logger.error(`Redis sub client error: ${error.message}`, error.stack);
    });

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const mergedOptions: any = {
        ...options,
        cors: this.corsOptions,
    };
    const server = super.createIOServer(port, mergedOptions);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

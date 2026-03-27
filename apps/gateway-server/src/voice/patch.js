const fs = require('fs');
let code = fs.readFileSync('./apps/gateway-server/src/voice/voice.gateway.ts', 'utf8');

code = code.replace(
  "import { CircuitBreaker } from './circuit-breaker';",
  "import { CircuitBreaker } from './circuit-breaker';\nimport { RabbitMQService } from '../common/rabbitmq.service';"
);

code = code.replace(
  "private readonly redis: RedisService,",
  "private readonly redis: RedisService,\n    private readonly rabbitmq: RabbitMQService,"
);

code = code.replace(
  "void this.redis.client.lpush('durable_queue:deep_brain_tasks', JSON.stringify({",
  "void this.rabbitmq.dispatchDeepBrainTask({"
);

code = code.replace(
  "question: text\n            }));",
  "question: text\n            });"
);

fs.writeFileSync('./apps/gateway-server/src/voice/voice.gateway.ts', code);
console.log('patched');

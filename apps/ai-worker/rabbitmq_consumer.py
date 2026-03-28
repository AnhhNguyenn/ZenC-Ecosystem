"""
RabbitMQ ASYNC Consumer for AI Worker (Phase G)

Listens to `deep_brain_tasks` and `post_session_eval` queues via AMQP instead of Redis.
"""
import asyncio
import json
import logging
import aio_pika
from config import settings

logger = logging.getLogger("zenc.worker.rabbitmq")

class RabbitMQConsumer:
    def __init__(self):
        self.connection = None
        self.channel = None
        self._running = False
        self._tasks = []

    async def start(self):
        try:
            self.connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
            self.channel = await self.connection.channel()
            # Set prefetch count for fair dispatch
            await self.channel.set_qos(prefetch_count=10)

            self._running = True
            
            # Start Deep Brain task consumer
            self._tasks.append(
                asyncio.create_task(self._consume_queue("deep_brain_tasks", self._handle_deep_brain))
            )

            # Start Post Session Eval consumer
            self._tasks.append(
                asyncio.create_task(self._consume_queue("post_session_eval", self._handle_scoring))
            )
            
            # Start Placement Turn Eval consumer
            self._tasks.append(
                asyncio.create_task(self._consume_queue("placement_turn_evaluate", self._handle_placement_turn))
            )

            logger.info("RabbitMQ Consumer started successfully.")
        except Exception as e:
            logger.error(f"Failed to start RabbitMQ consumer: {e}")
            raise e

    async def _consume_queue(self, queue_name: str, handler):
        if not self.channel: return
        
        queue = await self.channel.declare_queue(queue_name, durable=True)
        logger.info(f"Subscribed to RabbitMQ queue: {queue_name}")

        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                if not self._running:
                    break
                try:
                    # Execute handler and manually acknowledge on success
                    await handler(message.body.decode())
                    await message.ack()
                except Exception as e:
                    logger.error(f"Error processing {queue_name} task: {e}")
                    # Negative Acknowledge unconditionally triggers requeue or DLQ
                    await message.nack(requeue=True)

    async def _handle_deep_brain(self, raw_data: str):
        # Delegate down to exactly the same logic currently in pubsub_listener.py
        from events.pubsub_listener import pubsub_listener
        await pubsub_listener._handle_deep_brain(raw_data)

    async def _handle_scoring(self, raw_data: str):
        from events.pubsub_listener import pubsub_listener
        await pubsub_listener._handle_conversation_evaluate(raw_data)

    async def _handle_placement_turn(self, raw_data: str):
        from main import redis_client
        if not redis_client:
            logger.error("Redis client unavailable for placement evaluation")
            return

        logger.info(f"Processing placement turn evaluate task")
        from services.irt_evaluator import handle_placement_turn_evaluate
        await handle_placement_turn_evaluate(raw_data, redis_client)

    async def stop(self):
        self._running = False
        for task in self._tasks:
            task.cancel()
        if self.connection:
            await self.connection.close()
        logger.info("RabbitMQ Consumer stopped.")

rabbitmq_consumer = RabbitMQConsumer()

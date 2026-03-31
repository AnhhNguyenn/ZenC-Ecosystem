import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation } from '../entities/conversation.entity';
import { ConversationDocument, ConversationSchema } from './schemas/conversation.schema';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';

/**
 * ConversationModule – Manages conversation session records,
 * history, scoring, and analytics.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation]),
    MongooseModule.forFeature([{ name: ConversationDocument.name, schema: ConversationSchema }]),
  ],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}

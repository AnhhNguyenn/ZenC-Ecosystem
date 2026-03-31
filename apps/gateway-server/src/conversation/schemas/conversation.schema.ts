import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConversationDoc = ConversationDocument & Document;

@Schema({ timestamps: true, collection: 'conversations' })
export class ConversationDocument {
  @Prop({ required: true, index: true })
  conversationId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop()
  transcript?: string;

  @Prop()
  userTranscript?: string;

  @Prop()
  highlights?: string;

  @Prop()
  improvements?: string;

  @Prop()
  vietnameseAdvice?: string;
}

export const ConversationSchema = SchemaFactory.createForClass(ConversationDocument);

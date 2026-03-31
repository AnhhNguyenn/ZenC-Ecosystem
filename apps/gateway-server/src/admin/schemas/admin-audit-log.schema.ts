import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AdminAuditLogDoc = AdminAuditLogDocument & Document;

@Schema({ timestamps: true, collection: 'admin_audit_logs' })
export class AdminAuditLogDocument {
  @Prop({ required: true, index: true })
  auditLogId!: string;

  @Prop({ required: true, index: true })
  adminId!: string;

  @Prop({ required: true, index: true })
  targetUserId!: string;

  @Prop({ required: true })
  action!: string;

  @Prop()
  reason?: string;

  @Prop({ type: Object })
  changeSnapshot?: Record<string, any> | string;
}

export const AdminAuditLogSchema = SchemaFactory.createForClass(AdminAuditLogDocument);

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * AdminAuditLog Entity – Immutable record of every "God Mode" action.
 *
 * Design decisions:
 * - Separate adminId and targetUserId columns (both FK to User) to
 *   answer "who did what to whom" without ambiguity.
 * - Action stored as a constrained string enum for queryability.
 * - Reason is mandatory – every admin action must be justified for
 *   enterprise audit compliance.
 * - No UPDATE or DELETE should ever be performed on this table;
 *   it is append-only by design.
 */
@Entity('admin_audit_logs')
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The admin who performed the action */
  @ManyToOne(() => User, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'adminId' })
  admin!: User;

  @Column({ type: 'uniqueidentifier' })
  adminId!: string;

  /** The user affected by the action */
  @ManyToOne(() => User, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'targetUserId' })
  targetUser!: User;

  @Column({ type: 'uniqueidentifier' })
  targetUserId!: string;

  /**
   * Action type enum – constrained set of allowed admin operations.
   * Matches the AdminAction enum from @zenc/shared-types.
   */
  @Column({ type: 'nvarchar', length: 50 })
  action!: string;

  /** Mandatory audit justification for compliance */
  @Column({ type: 'nvarchar', length: 1000 })
  reason!: string;

  /** Snapshot of the changes made (JSON stringified before/after) */
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  changeSnapshot!: string | null;

  @CreateDateColumn({ type: 'datetime2' })
  timestamp!: Date;
}

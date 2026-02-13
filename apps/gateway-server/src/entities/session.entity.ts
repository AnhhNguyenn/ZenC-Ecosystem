import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Session Entity – Billing and audit log for every voice conversation.
 *
 * Design decisions:
 * - TotalTokensConsumed is an integer for atomic increment safety.
 * - ClientIP and DeviceFingerprint enable anti-fraud detection
 *   (e.g. detecting credential sharing across geolocations).
 * - Indexed on userId for fast "my sessions" dashboard queries.
 */
@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uniqueidentifier' })
  userId!: string;

  @Column({ type: 'datetime2' })
  startTime!: Date;

  @Column({ type: 'datetime2', nullable: true })
  endTime!: Date | null;

  /** Accumulated token count for this session (atomic increments) */
  @Column({ type: 'int', default: 0 })
  totalTokensConsumed!: number;

  @Column({ type: 'nvarchar', length: 45, nullable: true })
  clientIp!: string | null;

  @Column({ type: 'nvarchar', length: 512, nullable: true })
  deviceFingerprint!: string | null;

  /** Full transcript stored for async grammar analysis by the Deep Brain */
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  transcript!: string | null;

  @CreateDateColumn({ type: 'datetime2' })
  createdAt!: Date;
}

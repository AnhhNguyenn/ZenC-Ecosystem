import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 50 })
  planId!: string; // 'PRO' or 'UNLIMITED'

  @Column({ type: 'varchar', length: 50 })
  provider!: 'APPLE' | 'GOOGLE' | 'STRIPE';

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  originalTransactionId!: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  status!: 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'REFUNDED';

  @Column({ type: 'timestamptz' })
  currentPeriodStart!: Date;

  @Index()
  @Column({ type: 'timestamptz' })
  currentPeriodEnd!: Date;

  @Column({ type: 'boolean', default: true })
  autoRenewStatus!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  readonly createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  readonly updatedAt!: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('transaction_history')
export class TransactionHistory {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  transactionId!: string;

  @Column({ type: 'varchar', length: 255 })
  originalTransactionId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: 'NEW' | 'RENEWAL' | 'REFUND';

  @Column({ type: 'varchar', length: 50 })
  provider!: 'APPLE' | 'GOOGLE' | 'STRIPE';

  @Column({ type: 'jsonb', nullable: true })
  receiptData!: any;

  @CreateDateColumn({ type: 'timestamptz' })
  readonly createdAt!: Date;
}

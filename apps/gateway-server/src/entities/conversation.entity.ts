import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Conversation Entity – Stores conversation session records
 * with evaluation scores, mode, and metadata.
 *
 * Each conversation belongs to a user and tracks:
 * - Mode (FREE_TALK, ROLE_PLAY, SHADOWING, DEBATE, INTERVIEW, TOPIC)
 * - AI provider used (gemini/openai)
 * - Full transcript
 * - Post-session scores (fluency, accuracy, complexity, coherence)
 * - Duration and token usage
 */
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ length: 30, default: 'FREE_TALK' })
  mode!: string;

  @Column({ length: 20, default: 'gemini' })
  provider!: string;

  @Column({ length: 100, nullable: true })
  scenarioId!: string | null;

  @Column({ length: 100, nullable: true })
  topicId!: string | null;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  transcript!: string | null;

  /** User-only transcript for analysis */
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  userTranscript!: string | null;

  // ── Post-session scores (0-100, filled by Worker) ──────────
  @Column({ type: 'float', nullable: true })
  fluencyScore!: number | null;

  @Column({ type: 'float', nullable: true })
  accuracyScore!: number | null;

  @Column({ type: 'float', nullable: true })
  complexityScore!: number | null;

  @Column({ type: 'float', nullable: true })
  coherenceScore!: number | null;

  @Column({ type: 'float', nullable: true })
  overallScore!: number | null;

  /** AI-generated highlights from the conversation */
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  highlights!: string | null;

  /** AI-generated improvement suggestions */
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  improvements!: string | null;

  /** Vietnamese-language advice */
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  vietnameseAdvice!: string | null;

  @Column({ type: 'float', default: 0 })
  durationMinutes!: number;

  @Column({ type: 'int', default: 0 })
  totalTokens!: number;

  @Column({ type: 'int', default: 0 })
  wordCount!: number;

  @CreateDateColumn()
  createdAt!: Date;
}

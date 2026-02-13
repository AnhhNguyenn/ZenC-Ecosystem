import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Unit } from './unit.entity';

/**
 * Lesson Entity – Individual learning session within a unit.
 *
 * A lesson contains exercises and has a type (GRAMMAR, VOCABULARY, SPEAKING,
 * LISTENING, CONVERSATION) that determines which UI and exercise templates
 * the mobile app renders.
 *
 * XP reward is configurable per lesson, enabling curriculum designers to
 * weight harder lessons more heavily in the gamification system.
 */
@Entity('lessons')
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Index()
  @ManyToOne(() => Unit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unitId' })
  unit!: Unit;

  @Column({ type: 'uniqueidentifier' })
  unitId!: string;

  @Column({ type: 'nvarchar', length: 255 })
  title!: string;

  /**
   * Lesson type drives the UI template selection on the mobile client.
   * CONVERSATION type triggers the voice pipeline; others use exercise UI.
   */
  @Column({ type: 'nvarchar', length: 20 })
  type!: 'GRAMMAR' | 'VOCABULARY' | 'SPEAKING' | 'LISTENING' | 'CONVERSATION' | 'READING';

  /** Markdown-formatted lesson content (theory/explanation section) */
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  content!: string | null;

  /** XP awarded on completion – higher for harder lessons */
  @Column({ type: 'int', default: 20 })
  xpReward!: number;

  /** Estimated completion time in minutes */
  @Column({ type: 'int', default: 10 })
  estimatedMinutes!: number;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  /** Difficulty multiplier for adaptive scoring (1.0 = normal, 1.5 = hard) */
  @Column({ type: 'decimal', precision: 3, scale: 1, default: 1.0 })
  difficultyMultiplier!: number;

  @CreateDateColumn({ type: 'datetime2' })
  readonly createdAt!: Date;
}

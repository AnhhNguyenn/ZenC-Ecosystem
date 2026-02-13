import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Lesson } from './lesson.entity';

/**
 * Exercise Entity – Individual exercise within a lesson.
 *
 * Supports 6 exercise types matching major EdTech platforms:
 * - MCQ: Multiple Choice Question (4 options, 1 correct)
 * - FILL_BLANK: Fill in the blank with correct word/phrase
 * - SPEAKING: Record audio, assessed by pronunciation engine
 * - LISTENING: Listen to audio, answer comprehension question
 * - REORDER: Reorder scrambled words into correct sentence
 * - MATCHING: Match pairs (word↔translation, audio↔text)
 *
 * Security: `correctAnswer` is NEVER sent to the client before submission.
 * The client sends the user's answer; the server validates and scores.
 * This prevents answer extraction via network inspection.
 *
 * Performance: `options` stored as JSON string to avoid extra join table,
 * since options are always loaded with the exercise (no separate queries).
 */
@Entity('exercises')
export class Exercise {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Index()
  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lessonId' })
  lesson!: Lesson;

  @Column({ type: 'uniqueidentifier' })
  lessonId!: string;

  @Column({ type: 'nvarchar', length: 20 })
  type!: 'MCQ' | 'FILL_BLANK' | 'SPEAKING' | 'LISTENING' | 'REORDER' | 'MATCHING';

  /** The question/prompt text displayed to the user */
  @Column({ type: 'nvarchar', length: 2000 })
  prompt!: string;

  /**
   * JSON-serialized options array. Structure varies by type:
   * MCQ: ["option1", "option2", "option3", "option4"]
   * MATCHING: [{"left": "hello", "right": "xin chào"}, ...]
   * REORDER: ["scrambled", "words", "in", "random", "order"]
   * FILL_BLANK/SPEAKING/LISTENING: null or hints array
   */
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  optionsJson!: string | null;

  /**
   * Correct answer – NEVER exposed to client in GET responses.
   * Server-only validation field. For MCQ this is the correct option text;
   * for FILL_BLANK the expected word; for REORDER the correct sequence
   * as JSON array; for SPEAKING the reference text.
   */
  @Column({ type: 'nvarchar', length: 2000 })
  correctAnswer!: string;

  /**
   * Acceptable alternative answers (JSON array of strings).
   * Handles synonyms, spelling variants, contractions.
   * E.g., ["don't", "do not"] for a fill-blank exercise.
   */
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  acceptableAnswersJson!: string | null;

  /** Audio URL for LISTENING/SPEAKING exercises (CDN path) */
  @Column({ type: 'nvarchar', length: 500, nullable: true })
  audioUrl!: string | null;

  /** Optional image URL for visual context */
  @Column({ type: 'nvarchar', length: 500, nullable: true })
  imageUrl!: string | null;

  /**
   * Explanation shown after submission – teaches WHY the answer is correct.
   * Critical for learning efficacy (not just testing).
   */
  @Column({ type: 'nvarchar', length: 2000, nullable: true })
  explanation!: string | null;

  /** Vietnamese hint for low-confidence users */
  @Column({ type: 'nvarchar', length: 1000, nullable: true })
  hintVi!: string | null;

  /** Points awarded for correct answer (before difficulty multiplier) */
  @Column({ type: 'int', default: 10 })
  points!: number;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ type: 'datetime2' })
  readonly createdAt!: Date;
}

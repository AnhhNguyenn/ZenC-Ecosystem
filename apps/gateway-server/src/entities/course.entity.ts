import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

/**
 * Course Entity – Top-level curriculum container.
 *
 * A Course represents a structured learning path (e.g., "Business English B1",
 * "IELTS Speaking Preparation"). Each course contains ordered Units, which
 * contain ordered Lessons.
 *
 * Security: `isPublished` gate prevents users from accessing draft content.
 * Performance: Indexed on `level` and `isPublished` for filtered listing queries.
 */
@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 2000 })
  description!: string;

  /** CEFR level this course targets – used for adaptive course recommendations */
  @Index()
  @Column({ type: 'varchar', length: 2 })
  targetLevel!: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

  /** Display order in course catalog – lower numbers appear first */
  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  /** URL to course thumbnail – stored in CDN, never in DB as blob */
  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnailUrl!: string | null;

  /** XP bonus awarded on course completion */
  @Column({ type: 'int', default: 500 })
  completionXp!: number;

  /** Estimated total hours to complete */
  @Column({ type: 'decimal', precision: 5, scale: 1, default: 10 })
  estimatedHours!: number;

  /**
   * Draft/publish gate: unpublished courses are invisible to non-admin users.
   * Prevents accidental exposure of incomplete content.
   */
  @Index()
  @Column({ type: 'boolean', default: false })
  isPublished!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  readonly createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  readonly updatedAt!: Date;
}

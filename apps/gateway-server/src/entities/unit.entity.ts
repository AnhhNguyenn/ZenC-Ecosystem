import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Course } from './course.entity';

/**
 * Unit Entity – Groups lessons within a course (e.g., "Introductions", "At the Airport").
 *
 * Units serve as visual milestones in the learning path (similar to Duolingo's
 * skill nodes). Each unit has a mandatory sortOrder to maintain curriculum sequence.
 *
 * Constraint: Units reference a Course via cascading FK –
 * deleting a course deletes all its units and their lessons.
 */
@Entity('units')
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Index()
  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  course!: Course;

  @Column({ type: 'uniqueidentifier' })
  courseId!: string;

  @Column({ type: 'nvarchar', length: 255 })
  title!: string;

  @Column({ type: 'nvarchar', length: 1000, nullable: true })
  description!: string | null;

  /** Display order within the course – enforces curriculum sequence */
  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  /** Icon URL for the skill tree visualization (CDN path) */
  @Column({ type: 'nvarchar', length: 500, nullable: true })
  iconUrl!: string | null;

  /**
   * Minimum score (0-100) required on the previous unit to unlock this one.
   * Set to 0 for the first unit in a course. Default 80 = Duolingo-style
   * mastery requirement.
   */
  @Column({ type: 'int', default: 80 })
  unlockThreshold!: number;

  @CreateDateColumn({ type: 'datetime2' })
  readonly createdAt!: Date;
}

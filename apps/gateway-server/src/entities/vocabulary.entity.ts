import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

/**
 * Vocabulary Entity – Master dictionary of words/phrases.
 *
 * Admin-managed global word bank. Users can add words to their personal
 * bank (UserVocabulary) for SM-2 spaced repetition review.
 *
 * Design:
 * - IPA phonetic transcription for pronunciation reference
 * - Audio URL points to CDN-hosted native speaker recordings
 * - Category enables topical browsing (Travel, Business, Academic, etc.)
 * - Difficulty rating drives adaptive vocabulary recommendations
 *
 * Performance:
 * - Indexed on `level` + `category` for filtered browsing queries
 * - Full-text potential on `word` + `exampleSentence` for search
 */
@Entity('vocabulary')
export class Vocabulary {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Index()
  @Column({ type: 'nvarchar', length: 200 })
  word!: string;

  /** Vietnamese translation */
  @Column({ type: 'nvarchar', length: 500 })
  translation!: string;

  /** IPA phonetic transcription (e.g., /prəˌnʌnsiˈeɪʃən/) */
  @Column({ type: 'nvarchar', length: 200, nullable: true })
  phonetic!: string | null;

  /** Part of speech: noun, verb, adjective, adverb, preposition, etc. */
  @Column({ type: 'nvarchar', length: 20 })
  partOfSpeech!: string;

  /** Example sentence demonstrating usage in context */
  @Column({ type: 'nvarchar', length: 1000 })
  exampleSentence!: string;

  /** Vietnamese translation of the example sentence */
  @Column({ type: 'nvarchar', length: 1000, nullable: true })
  exampleTranslation!: string | null;

  /** CDN URL to native speaker audio recording */
  @Column({ type: 'nvarchar', length: 500, nullable: true })
  audioUrl!: string | null;

  /** CDN URL to illustrative image */
  @Column({ type: 'nvarchar', length: 500, nullable: true })
  imageUrl!: string | null;

  /** CEFR level for difficulty matching */
  @Index()
  @Column({ type: 'nvarchar', length: 2 })
  level!: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

  /** Topic category for browsing (Travel, Business, Academic, Daily, Medical, etc.) */
  @Index()
  @Column({ type: 'nvarchar', length: 50 })
  category!: string;

  /**
   * Difficulty rating 1-10 within the CEFR level.
   * Used by the recommender to select words at the user's growth edge.
   */
  @Column({ type: 'int', default: 5 })
  difficultyRating!: number;

  @CreateDateColumn({ type: 'datetime2' })
  readonly createdAt!: Date;
}

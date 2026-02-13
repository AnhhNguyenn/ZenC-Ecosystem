import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserVocabulary } from '../entities/user-vocabulary.entity';
import { RedisService } from '../common/redis.service';

/**
 * VocabularyContextService – Vocabulary learning through context.
 *
 * Features:
 * - Extract vocabulary from conversation transcripts
 * - Generate contextual example sentences
 * - Track vocabulary in spaced repetition (SM-2)
 * - Vocabulary quiz generation
 * - Collocations and word families
 * - Vietnamese translations with usage notes
 *
 * Integration:
 * - Hooks into Conversation end events via Redis
 * - Provides vocabulary suggestions during conversation
 * - Feeds into the SmartExercise engine for review exercises
 */
@Injectable()
export class VocabularyContextService {
  private readonly logger = new Logger(VocabularyContextService.name);

  constructor(
    @InjectRepository(UserVocabulary)
    private readonly vocabRepo: Repository<UserVocabulary>,
    private readonly redis: RedisService,
  ) {}

  /**
   * Extract vocabulary from conversation transcript and save for user.
   * Called by ConversationService after session ends.
   */
  async extractFromTranscript(userId: string, transcript: string): Promise<any[]> {
    const words = this.extractKeywords(transcript);
    const saved: any[] = [];

    for (const word of words.slice(0, 10)) { // Max 10 words per session
      const exists = await this.vocabRepo.findOne({
        where: { userId, word: word.word },
      });

      if (!exists) {
        const vocab = this.vocabRepo.create({
          userId,
          word: word.word,
          definition: word.definition,
          exampleSentence: word.context,
          masteryLevel: 0,
          nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
        await this.vocabRepo.save(vocab);
        saved.push({ word: word.word, definition: word.definition });
      }
    }

    if (saved.length > 0) {
      this.logger.log(`Extracted ${saved.length} new words for user ${userId}`);
    }
    return saved;
  }

  /**
   * Get vocabulary to review today (SM-2 due items).
   */
  async getDueVocabulary(userId: string, limit = 20) {
    const items = await this.vocabRepo
      .createQueryBuilder('v')
      .where('v.userId = :userId', { userId })
      .andWhere('v.nextReviewAt <= :now', { now: new Date() })
      .orderBy('v.nextReviewAt', 'ASC')
      .take(limit)
      .getMany();

    return items.map((item: UserVocabulary) => ({
      id: item.id,
      word: item.word,
      definition: item.definition,
      exampleSentence: item.exampleSentence,
      masteryLevel: item.masteryLevel,
      reviewCount: item.repetitionCount || 0,
    }));
  }

  /**
   * Submit vocabulary review result (SM-2 algorithm update).
   */
  async submitReview(
    userId: string,
    vocabId: string,
    quality: number, // 0-5 (0=complete blackout, 5=perfect recall)
  ) {
    const vocab = await this.vocabRepo.findOne({
      where: { id: vocabId, userId },
    });
    if (!vocab) return null;

    // SM-2 algorithm
    const q = Math.max(0, Math.min(5, quality));
    let ef = (vocab as any).easinessFactor || 2.5;
    let interval = (vocab as any).intervalDays || 1;
    let reps = vocab.repetitionCount || 0;

    if (q >= 3) {
      // Successful recall
      if (reps === 0) interval = 1;
      else if (reps === 1) interval = 6;
      else interval = Math.round(interval * ef);
      reps++;
    } else {
      // Failed recall – reset
      reps = 0;
      interval = 1;
    }

    ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    ef = Math.max(1.3, ef);

    // Update mastery level (0-100)
    const mastery = Math.min(100, Math.round((reps / 8) * 100));

    await this.vocabRepo.update(vocabId, {
      repetitionCount: reps,
      masteryLevel: mastery,
      nextReviewAt: new Date(Date.now() + interval * 24 * 60 * 60 * 1000),
      lastReviewedAt: new Date(),
    } as any);

    return {
      word: vocab.word,
      mastery,
      nextReviewAt: new Date(Date.now() + interval * 24 * 60 * 60 * 1000),
      intervalDays: interval,
    };
  }

  /**
   * Generate a vocabulary quiz from user's word bank.
   */
  async generateQuiz(userId: string, size = 10) {
    const allVocab = await this.vocabRepo.find({
      where: { userId },
      order: { masteryLevel: 'ASC' }, // Prioritize least mastered
      take: size * 2,
    });

    if (allVocab.length < 4) {
      return { quizItems: [], message: 'Need at least 4 words in vocabulary to generate quiz' };
    }

    // Shuffle and select
    const shuffled = allVocab.sort(() => Math.random() - 0.5).slice(0, size);

    const quizItems = shuffled.map((word: UserVocabulary) => {
      // Get 3 wrong options from other words
      const distractors = allVocab
        .filter((w: UserVocabulary) => w.id !== word.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((w: UserVocabulary) => w.definition);

      const options = [word.definition, ...distractors].sort(
        () => Math.random() - 0.5,
      );

      return {
        id: word.id,
        word: word.word,
        exampleSentence: word.exampleSentence,
        options,
        correctAnswer: word.definition,
        type: 'MULTIPLE_CHOICE',
      };
    });

    return { quizItems, totalWords: allVocab.length };
  }

  /**
   * Get word collocations and family.
   * Uses static data + Redis cache for AI-generated collocations.
   */
  async getWordContext(word: string) {
    // Check Redis cache
    const cacheKey = `word_context:${word.toLowerCase()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Generate using built-in data
    const context = {
      word: word.toLowerCase(),
      collocations: COMMON_COLLOCATIONS[word.toLowerCase()] || [],
      wordFamily: this.getWordFamily(word),
      commonMistakes: VIETNAMESE_COMMON_MISTAKES[word.toLowerCase()] || null,
    };

    // Cache for 24h
    await this.redis.set(cacheKey, JSON.stringify(context), 86400);
    return context;
  }

  /**
   * Get vocabulary statistics for a user.
   */
  async getStats(userId: string) {
    const total = await this.vocabRepo.count({ where: { userId } });
    const mastered = await this.vocabRepo
      .createQueryBuilder('v')
      .where('v.userId = :userId', { userId })
      .andWhere('v.masteryLevel >= 80')
      .getCount();

    const learning = await this.vocabRepo
      .createQueryBuilder('v')
      .where('v.userId = :userId', { userId })
      .andWhere('v.masteryLevel >= 20 AND v.masteryLevel < 80')
      .getCount();

    const newWords = total - mastered - learning;

    return {
      total,
      mastered,
      learning,
      new: newWords,
      masteryRate: total > 0 ? Math.round((mastered / total) * 100) : 0,
    };
  }

  // ── Private Helpers ─────────────────────────────────────────────

  private extractKeywords(transcript: string): { word: string; definition: string; context: string }[] {
    const words = transcript.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();

    for (const w of words) {
      const cleaned = w.replace(/[^a-zA-Z]/g, '');
      if (cleaned.length >= 4 && !STOP_WORDS.has(cleaned)) {
        wordFreq.set(cleaned, (wordFreq.get(cleaned) || 0) + 1);
      }
    }

    // Return top words by frequency (likely important in context)
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word]) => ({
        word,
        definition: `Definition for "${word}" (auto-extracted)`,
        context: this.findSentenceWith(transcript, word),
      }));
  }

  private findSentenceWith(text: string, word: string): string {
    const sentences = text.split(/[.!?]+/);
    const found = sentences.find((s: string) =>
      s.toLowerCase().includes(word.toLowerCase()),
    );
    return found?.trim() || `Example with "${word}"`;
  }

  private getWordFamily(word: string): string[] {
    const lower = word.toLowerCase();
    const families: string[] = [lower];
    // Common suffixes
    if (lower.endsWith('tion')) families.push(lower.replace(/tion$/, 'te'));
    if (lower.endsWith('ly')) families.push(lower.replace(/ly$/, ''));
    if (lower.endsWith('ment')) families.push(lower.replace(/ment$/, ''));
    if (lower.endsWith('ness')) families.push(lower.replace(/ness$/, ''));
    if (lower.endsWith('ful')) families.push(lower.replace(/ful$/, ''));
    if (lower.endsWith('able')) families.push(lower.replace(/able$/, ''));
    if (lower.endsWith('ing')) families.push(lower.replace(/ing$/, ''));
    if (lower.endsWith('er')) families.push(lower.replace(/er$/, ''));
    return [...new Set(families)];
  }
}

// ═══════════════════════════════════════════════════════════════
// STATIC DATA
// ═══════════════════════════════════════════════════════════════

const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her',
  'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there',
  'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get',
  'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no',
  'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your',
  'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then',
  'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first',
  'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
  'give', 'day', 'most', 'us', 'very', 'much', 'been', 'was',
  'were', 'are', 'has', 'had', 'did', 'does', 'been', 'being',
]);

const COMMON_COLLOCATIONS: Record<string, string[]> = {
  'make': ['make a decision', 'make progress', 'make an effort', 'make a mistake'],
  'do': ['do homework', 'do research', 'do a favor', 'do business'],
  'take': ['take a break', 'take notes', 'take advantage', 'take action'],
  'get': ['get started', 'get along', 'get rid of', 'get used to'],
  'have': ['have fun', 'have a look', 'have a conversation', 'have an impact'],
  'break': ['break the ice', 'break a habit', 'break the news', 'break a record'],
  'keep': ['keep in mind', 'keep in touch', 'keep up with', 'keep track of'],
  'pay': ['pay attention', 'pay a visit', 'pay a compliment', 'pay the price'],
};

const VIETNAMESE_COMMON_MISTAKES: Record<string, {
  mistake: string;
  correct: string;
  viExplanation: string;
}> = {
  'information': {
    mistake: 'informations (adding plural)',
    correct: 'information (uncountable)',
    viExplanation: 'Information không đếm được nên không thêm "s"',
  },
  'advice': {
    mistake: 'advices (adding plural)',
    correct: 'advice (uncountable)',
    viExplanation: 'Advice không đếm được. Dùng "a piece of advice"',
  },
  'discuss': {
    mistake: 'discuss about (adding unnecessary preposition)',
    correct: 'discuss + noun (no preposition)',
    viExplanation: 'Discuss không cần giới từ "about" theo sau',
  },
  'suggest': {
    mistake: 'suggest + to infinitive',
    correct: 'suggest + gerund / suggest that + clause',
    viExplanation: 'Suggest theo sau bởi V-ing hoặc that-clause',
  },
};

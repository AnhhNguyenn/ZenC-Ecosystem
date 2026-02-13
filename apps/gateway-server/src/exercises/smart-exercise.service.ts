import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis.service';

/**
 * SmartExerciseService – Enhanced exercise engine with 8 new types.
 *
 * New Exercise Types (Phase 4):
 * 1. LISTEN_AND_TYPE   – Listen to audio, type what you hear
 * 2. WORD_ORDER        – Reorder scrambled words into correct sentence
 * 3. CLOZE_TEST        – Fill in blanks in a paragraph
 * 4. CONVERSATION_FILL – Complete missing turns in a dialogue
 * 5. ERROR_CORRECTION  – Find and fix grammar errors
 * 6. PICTURE_DESCRIBE  – Describe an image in English
 * 7. SHADOWING         – Listen and repeat sentence by sentence
 * 8. DICTATION         – Write down spoken passages
 *
 * All exercise types produce a standardized result:
 * { score: number, maxScore: number, isCorrect: boolean, feedback: string }
 */
@Injectable()
export class SmartExerciseService {
  private readonly logger = new Logger(SmartExerciseService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Evaluate any exercise type. Routes to the correct evaluator.
   */
  async evaluate(
    exerciseType: string,
    userId: string,
    payload: Record<string, any>,
  ): Promise<ExerciseResult> {
    switch (exerciseType) {
      case 'LISTEN_AND_TYPE':
        return this.evaluateListenAndType(payload as any);
      case 'WORD_ORDER':
        return this.evaluateWordOrder(payload as any);
      case 'CLOZE_TEST':
        return this.evaluateClozeTest(payload as any);
      case 'CONVERSATION_FILL':
        return this.evaluateConversationFill(payload as any);
      case 'ERROR_CORRECTION':
        return this.evaluateErrorCorrection(payload as any);
      case 'PICTURE_DESCRIBE':
        return this.evaluatePictureDescribe(userId, payload as any);
      case 'SHADOWING':
        return this.evaluateShadowing(userId, payload as any);
      case 'DICTATION':
        return this.evaluateDictation(payload as any);
      default:
        return { score: 0, maxScore: 100, isCorrect: false, feedback: 'Unknown exercise type' };
    }
  }

  /**
   * LISTEN_AND_TYPE: Compare user's typed text against reference.
   * Uses Levenshtein distance for partial credit.
   */
  private evaluateListenAndType(payload: {
    referenceText: string;
    userText: string;
  }): ExerciseResult {
    const ref = payload.referenceText.toLowerCase().trim();
    const user = payload.userText.toLowerCase().trim();
    const similarity = this.calculateSimilarity(ref, user);
    const score = Math.round(similarity * 100);

    return {
      score,
      maxScore: 100,
      isCorrect: score >= 80,
      feedback: score >= 90
        ? 'Excellent listening! Perfect transcription.'
        : score >= 70
          ? 'Good job! A few words were different.'
          : 'Keep practicing. Try listening again carefully.',
      details: {
        expectedText: payload.referenceText,
        yourText: payload.userText,
        similarity: `${score}%`,
      },
    };
  }

  /**
   * WORD_ORDER: Check if user reordered words correctly.
   */
  private evaluateWordOrder(payload: {
    correctOrder: string[];
    userOrder: string[];
  }): ExerciseResult {
    const correct = payload.correctOrder;
    const user = payload.userOrder;
    let matchCount = 0;

    for (let i = 0; i < correct.length; i++) {
      if (user[i]?.toLowerCase() === correct[i].toLowerCase()) {
        matchCount++;
      }
    }

    const score = Math.round((matchCount / correct.length) * 100);
    return {
      score,
      maxScore: 100,
      isCorrect: score === 100,
      feedback: score === 100
        ? 'Perfect word order!'
        : `${matchCount}/${correct.length} words in correct position.`,
      details: { correctOrder: correct.join(' ') },
    };
  }

  /**
   * CLOZE_TEST: Evaluate fill-in-the-blank answers.
   */
  private evaluateClozeTest(payload: {
    blanks: { id: string; correctAnswer: string; userAnswer: string }[];
  }): ExerciseResult {
    let correct = 0;
    const results = payload.blanks.map((blank) => {
      const isRight =
        blank.userAnswer.toLowerCase().trim() ===
        blank.correctAnswer.toLowerCase().trim();
      if (isRight) correct++;
      return {
        id: blank.id,
        correct: isRight,
        expected: blank.correctAnswer,
        yours: blank.userAnswer,
      };
    });

    const score = Math.round((correct / payload.blanks.length) * 100);
    return {
      score,
      maxScore: 100,
      isCorrect: score >= 80,
      feedback: `${correct}/${payload.blanks.length} blanks filled correctly.`,
      details: { results },
    };
  }

  /**
   * CONVERSATION_FILL: Check dialogue completion answers.
   */
  private evaluateConversationFill(payload: {
    turns: { speaker: string; expected: string; userAnswer: string }[];
  }): ExerciseResult {
    let totalSimilarity = 0;
    const results = payload.turns.map((turn) => {
      const similarity = this.calculateSimilarity(
        turn.expected.toLowerCase(),
        turn.userAnswer.toLowerCase(),
      );
      totalSimilarity += similarity;
      return {
        speaker: turn.speaker,
        expected: turn.expected,
        yours: turn.userAnswer,
        similarity: `${Math.round(similarity * 100)}%`,
      };
    });

    const score = Math.round((totalSimilarity / payload.turns.length) * 100);
    return {
      score,
      maxScore: 100,
      isCorrect: score >= 70,
      feedback: score >= 90
        ? 'Natural dialogue completion!'
        : 'Good attempt. Review the expected responses.',
      details: { results },
    };
  }

  /**
   * ERROR_CORRECTION: Find and fix grammar errors in sentences.
   */
  private evaluateErrorCorrection(payload: {
    sentences: {
      original: string;
      correctAnswer: string;
      userAnswer: string;
      errorType: string;
    }[];
  }): ExerciseResult {
    let correct = 0;
    const results = payload.sentences.map((s) => {
      const isRight =
        s.userAnswer.toLowerCase().trim() ===
        s.correctAnswer.toLowerCase().trim();
      if (isRight) correct++;
      return {
        original: s.original,
        expected: s.correctAnswer,
        yours: s.userAnswer,
        correct: isRight,
        errorType: s.errorType,
      };
    });

    const score = Math.round((correct / payload.sentences.length) * 100);
    return {
      score,
      maxScore: 100,
      isCorrect: score >= 80,
      feedback: `${correct}/${payload.sentences.length} errors corrected.`,
      details: { results },
    };
  }

  /**
   * PICTURE_DESCRIBE: Submit audio/text description for AI evaluation.
   * Dispatches to Worker for Gemini evaluation.
   */
  private async evaluatePictureDescribe(
    userId: string,
    payload: { imageId: string; description: string; audioBase64?: string },
  ): Promise<ExerciseResult> {
    if (payload.audioBase64) {
      const assessmentId = `pic_${userId}_${Date.now()}`;
      await this.redis.publish(
        'pronunciation_assess',
        JSON.stringify({
          assessmentId,
          userId,
          audioBase64: payload.audioBase64,
          referenceText: payload.description,
        }),
      );
    }

    // Basic text evaluation (word count, sentence count)
    const words = payload.description.trim().split(/\s+/).length;
    const score = Math.min(100, words * 5); // 20+ words = 100

    return {
      score,
      maxScore: 100,
      isCorrect: score >= 60,
      feedback:
        words >= 20
          ? 'Great description! Rich in detail.'
          : 'Try to describe more details in the image.',
    };
  }

  /**
   * SHADOWING: Compare user's repeated sentence against original.
   * Dispatches audio to Worker for pronunciation scoring.
   */
  private async evaluateShadowing(
    userId: string,
    payload: {
      referenceText: string;
      audioBase64: string;
    },
  ): Promise<ExerciseResult> {
    const assessmentId = `shadow_${userId}_${Date.now()}`;
    await this.redis.publish(
      'pronunciation_assess',
      JSON.stringify({
        assessmentId,
        userId,
        audioBase64: payload.audioBase64,
        referenceText: payload.referenceText,
      }),
    );

    return {
      score: 0,
      maxScore: 100,
      isCorrect: false,
      feedback: 'Audio submitted for pronunciation analysis.',
      details: { assessmentId, status: 'PROCESSING' },
    };
  }

  /**
   * DICTATION: Compare user's written text against spoken passage.
   */
  private evaluateDictation(payload: {
    referenceText: string;
    userText: string;
  }): ExerciseResult {
    const refWords = payload.referenceText.toLowerCase().split(/\s+/);
    const userWords = payload.userText.toLowerCase().split(/\s+/);
    let correct = 0;

    for (let i = 0; i < refWords.length; i++) {
      if (userWords[i] === refWords[i]) correct++;
    }

    const score = Math.round((correct / refWords.length) * 100);
    return {
      score,
      maxScore: 100,
      isCorrect: score >= 80,
      feedback:
        score >= 90
          ? 'Excellent dictation!'
          : `${correct}/${refWords.length} words correct.`,
      details: { expectedText: payload.referenceText },
    };
  }

  /**
   * Levenshtein-based similarity score (0-1).
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;

    const matrix: number[][] = [];
    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }
    return 1 - matrix[a.length][b.length] / maxLen;
  }
}

interface ExerciseResult {
  score: number;
  maxScore: number;
  isCorrect: boolean;
  feedback: string;
  details?: Record<string, any>;
}

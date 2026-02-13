import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis.service';

/**
 * PronunciationDrillService – Generates and manages pronunciation drills.
 *
 * Vietnamese-specific phoneme challenges:
 * - /θ/ vs /s/ (think vs sink) – Vietnamese has no dental fricative
 * - /ð/ vs /z/ (this vs zis)
 * - /ʃ/ vs /s/ (ship vs sip)
 * - /r/ vs /l/ (right vs light)
 * - /p/ vs /b/ (pat vs bat) – final consonant devoicing
 * - /t/ vs /d/ (tent vs dent)
 * - /ɪ/ vs /iː/ (sit vs seat)
 * - /æ/ vs /e/ (bad vs bed)
 * - Final consonant clusters (acts, hands, strength)
 */
@Injectable()
export class PronunciationDrillService {
  private readonly logger = new Logger(PronunciationDrillService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Get minimal pair drills personalized to user's problem sounds.
   * Minimal pairs are word pairs differing by one phoneme.
   */
  async getMinimalPairs(userId: string) {
    const problemSounds = await this.getUserProblemSounds(userId);
    const prioritized = problemSounds.length > 0
      ? MINIMAL_PAIRS.filter((p) =>
          problemSounds.some((s: string) => p.targetPhoneme.includes(s)),
        )
      : MINIMAL_PAIRS;

    // Return top 10 prioritized + 5 random for variety
    const selected = [
      ...prioritized.slice(0, 10),
      ...MINIMAL_PAIRS.sort(() => Math.random() - 0.5).slice(0, 5),
    ].slice(0, 15);

    return { drills: selected, totalAvailable: MINIMAL_PAIRS.length };
  }

  getIPAChart() {
    return {
      vowels: IPA_VOWELS,
      consonants: IPA_CONSONANTS,
      diphthongs: IPA_DIPHTHONGS,
      vietnameseNotes: VIETNAMESE_IPA_NOTES,
    };
  }

  async getTongueTwisters(userId: string) {
    const profile = await this.redis.getCachedUserProfile(userId);
    const level = profile?.['currentLevel'] || 'A1';
    const filtered = TONGUE_TWISTERS.filter((t) =>
      t.levels.includes(level),
    );
    return { drills: filtered.slice(0, 10) };
  }

  async getIntonationDrills(userId: string) {
    return { drills: INTONATION_DRILLS.slice(0, 10) };
  }

  async getStressPatterns(userId: string) {
    return { drills: STRESS_DRILLS.slice(0, 10) };
  }

  async getVietnameseSpecificDrills(userId: string) {
    return { drills: VIETNAMESE_DRILLS };
  }

  async getUserProblemSounds(userId: string): Promise<string[]> {
    try {
      const key = `pronunciation_problems:${userId}`;
      const data = await this.redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        return Object.keys(parsed).sort(
          (a, b) => parsed[b] - parsed[a],
        );
      }
    } catch { /* empty */ }
    return [];
  }

  async submitDrillResult(
    userId: string,
    drillType: string,
    drillId: string,
    audioBase64?: string,
    userAnswer?: string,
  ) {
    // Publish to Worker for scoring if audio provided
    if (audioBase64) {
      const assessmentId = `drill_${userId}_${Date.now()}`;
      await this.redis.publish(
        'pronunciation_assess',
        JSON.stringify({
          assessmentId,
          userId,
          audioBase64,
          referenceText: drillId,
          drillType,
        }),
      );
      return {
        assessmentId,
        status: 'PROCESSING',
        message: 'Audio submitted for analysis',
      };
    }

    return { status: 'SUBMITTED', drillType, drillId };
  }
}

// ═══════════════════════════════════════════════════════════════
// STATIC DRILL DATA
// ═══════════════════════════════════════════════════════════════

const MINIMAL_PAIRS = [
  { id: 'mp_01', targetPhoneme: '/θ/-/s/', word1: 'think', word2: 'sink', ipa1: '/θɪŋk/', ipa2: '/sɪŋk/', viHint: 'Đặt lưỡi giữa hai hàm răng cho /θ/' },
  { id: 'mp_02', targetPhoneme: '/ð/-/z/', word1: 'this', word2: 'zis', ipa1: '/ðɪs/', ipa2: '/zɪs/', viHint: 'Rung dây thanh khi phát âm /ð/' },
  { id: 'mp_03', targetPhoneme: '/ʃ/-/s/', word1: 'ship', word2: 'sip', ipa1: '/ʃɪp/', ipa2: '/sɪp/', viHint: 'Chu môi nhẹ cho /ʃ/' },
  { id: 'mp_04', targetPhoneme: '/r/-/l/', word1: 'right', word2: 'light', ipa1: '/raɪt/', ipa2: '/laɪt/', viHint: 'Cuộn lưỡi cho /r/, chạm nướu cho /l/' },
  { id: 'mp_05', targetPhoneme: '/p/-/b/', word1: 'pat', word2: 'bat', ipa1: '/pæt/', ipa2: '/bæt/', viHint: '/b/ cần rung dây thanh, /p/ không rung' },
  { id: 'mp_06', targetPhoneme: '/ɪ/-/iː/', word1: 'sit', word2: 'seat', ipa1: '/sɪt/', ipa2: '/siːt/', viHint: '/iː/ kéo dài hơn /ɪ/' },
  { id: 'mp_07', targetPhoneme: '/æ/-/e/', word1: 'bad', word2: 'bed', ipa1: '/bæd/', ipa2: '/bed/', viHint: 'Mở miệng rộng hơn cho /æ/' },
  { id: 'mp_08', targetPhoneme: '/v/-/w/', word1: 'vine', word2: 'wine', ipa1: '/vaɪn/', ipa2: '/waɪn/', viHint: 'Cắn nhẹ môi dưới cho /v/' },
  { id: 'mp_09', targetPhoneme: '/tʃ/-/ʃ/', word1: 'chair', word2: 'share', ipa1: '/tʃeə/', ipa2: '/ʃeə/', viHint: '/tʃ/ bắt đầu bằng /t/ rồi chuyển sang /ʃ/' },
  { id: 'mp_10', targetPhoneme: '/dʒ/-/ʒ/', word1: 'judge', word2: 'rouge', ipa1: '/dʒʌdʒ/', ipa2: '/ruːʒ/', viHint: '/dʒ/ bắt đầu bằng /d/ rồi chuyển sang /ʒ/' },
  { id: 'mp_11', targetPhoneme: '/ŋ/-/n/', word1: 'sing', word2: 'sin', ipa1: '/sɪŋ/', ipa2: '/sɪn/', viHint: 'Phía sau lưỡi chạm vòm họng cho /ŋ/' },
  { id: 'mp_12', targetPhoneme: '/f/-/p/', word1: 'fan', word2: 'pan', ipa1: '/fæn/', ipa2: '/pæn/', viHint: 'Cắn nhẹ môi dưới cho /f/' },
];

const IPA_VOWELS = [
  { symbol: '/iː/', example: 'see', viHint: 'Giống "i" dài trong tiếng Việt' },
  { symbol: '/ɪ/', example: 'sit', viHint: 'Ngắn hơn /iː/, miệng mở hơn một chút' },
  { symbol: '/e/', example: 'bed', viHint: 'Giống "e" trong tiếng Việt' },
  { symbol: '/æ/', example: 'cat', viHint: 'Giữa /e/ và /a/, mở miệng rộng' },
  { symbol: '/ɑː/', example: 'car', viHint: 'Giống "a" dài trong tiếng Việt' },
  { symbol: '/ɒ/', example: 'hot', viHint: 'Giống "o" ngắn, môi tròn nhẹ' },
  { symbol: '/ɔː/', example: 'saw', viHint: 'Giống "o" dài, môi tròn' },
  { symbol: '/ʊ/', example: 'put', viHint: 'Giống "u" ngắn' },
  { symbol: '/uː/', example: 'too', viHint: 'Giống "u" dài, môi tròn chặt' },
  { symbol: '/ʌ/', example: 'cup', viHint: 'Giống "ơ" ngắn, miệng mở vừa' },
  { symbol: '/ɜː/', example: 'bird', viHint: 'Giống "ơ" dài, không tròn môi' },
  { symbol: '/ə/', example: 'about', viHint: 'Âm trung tính, rất ngắn và nhẹ' },
];

const IPA_CONSONANTS = [
  { symbol: '/θ/', example: 'think', viHint: 'Đặt lưỡi giữa răng (không có trong tiếng Việt)' },
  { symbol: '/ð/', example: 'this', viHint: 'Như /θ/ nhưng rung dây thanh' },
  { symbol: '/ʃ/', example: 'ship', viHint: 'Chu môi, luồng hơi ra' },
  { symbol: '/ʒ/', example: 'measure', viHint: 'Như /ʃ/ nhưng rung dây thanh' },
  { symbol: '/tʃ/', example: 'church', viHint: 'Kết hợp /t/ và /ʃ/' },
  { symbol: '/dʒ/', example: 'judge', viHint: 'Kết hợp /d/ và /ʒ/' },
];

const IPA_DIPHTHONGS = [
  { symbol: '/eɪ/', example: 'say', viHint: 'Bắt đầu từ /e/ trượt lên /ɪ/' },
  { symbol: '/aɪ/', example: 'my', viHint: 'Bắt đầu từ /a/ trượt lên /ɪ/' },
  { symbol: '/ɔɪ/', example: 'boy', viHint: 'Bắt đầu từ /ɔ/ trượt lên /ɪ/' },
  { symbol: '/aʊ/', example: 'now', viHint: 'Bắt đầu từ /a/ trượt lên /ʊ/' },
  { symbol: '/əʊ/', example: 'go', viHint: 'Bắt đầu từ /ə/ trượt lên /ʊ/' },
];

const VIETNAMESE_IPA_NOTES = {
  hardestSounds: ['/θ/', '/ð/', '/r/', '/ʒ/'],
  commonConfusions: [
    { confuse: '/θ/ ↔ /s/', tip: 'Luôn đặt lưỡi giữa răng cho /θ/' },
    { confuse: '/r/ ↔ /l/', tip: 'Cuộn lưỡi ra phía sau cho /r/' },
    { confuse: '/æ/ ↔ /e/', tip: 'Mở miệng rộng hơn cho /æ/' },
    { confuse: 'Final consonants omitted', tip: 'Luyện tập phát âm rõ phụ âm cuối' },
  ],
};

const TONGUE_TWISTERS = [
  { id: 'tt_01', text: 'She sells seashells by the seashore.', target: '/ʃ/-/s/', levels: ['A2', 'B1', 'B2'] },
  { id: 'tt_02', text: 'Red lorry, yellow lorry.', target: '/r/-/l/', levels: ['A1', 'A2', 'B1'] },
  { id: 'tt_03', text: 'The thirty-three thieves thought that they thrilled the throne throughout Thursday.', target: '/θ/', levels: ['B1', 'B2', 'C1'] },
  { id: 'tt_04', text: 'Peter Piper picked a peck of pickled peppers.', target: '/p/', levels: ['A2', 'B1'] },
  { id: 'tt_05', text: 'How much wood would a woodchuck chuck if a woodchuck could chuck wood?', target: '/w/-/ʊ/', levels: ['B1', 'B2'] },
  { id: 'tt_06', text: 'Betty Botter bought some butter.', target: '/b/-/t/', levels: ['A1', 'A2'] },
  { id: 'tt_07', text: 'I scream, you scream, we all scream for ice cream.', target: 'vowels', levels: ['A1', 'A2'] },
  { id: 'tt_08', text: "The sixth sick sheik's sixth sheep's sick.", target: '/s/-/ʃ/-/θ/', levels: ['C1', 'C2'] },
];

const INTONATION_DRILLS = [
  { id: 'in_01', text: 'Nice to meet you.', pattern: 'falling', viHint: 'Giọng xuống ở cuối câu chào' },
  { id: 'in_02', text: 'Are you ready?', pattern: 'rising', viHint: 'Giọng lên ở cuối câu hỏi Yes/No' },
  { id: 'in_03', text: 'Do you want coffee or tea?', pattern: 'rising-falling', viHint: 'Lên ở "coffee", xuống ở "tea"' },
  { id: 'in_04', text: "I don't think so.", pattern: 'falling', viHint: 'Giọng xuống ở cuối câu phủ định' },
  { id: 'in_05', text: 'What time is it?', pattern: 'falling', viHint: 'Câu hỏi Wh- thường có giọng xuống' },
];

const STRESS_DRILLS = [
  { id: 'st_01', word: 'photograph', stress: 'PHO-to-graph', syllables: 3, viHint: 'Nhấn vào âm tiết đầu' },
  { id: 'st_02', word: 'photography', stress: 'pho-TOG-ra-phy', syllables: 4, viHint: 'Nhấn vào âm tiết thứ 2' },
  { id: 'st_03', word: 'photographic', stress: 'pho-to-GRAPH-ic', syllables: 4, viHint: 'Nhấn vào âm tiết thứ 3' },
  { id: 'st_04', word: 'information', stress: 'in-for-MA-tion', syllables: 4, viHint: 'Nhấn vào âm tiết thứ 3' },
  { id: 'st_05', word: 'communication', stress: 'com-mu-ni-CA-tion', syllables: 5, viHint: 'Nhấn vào âm tiết thứ 4' },
];

const VIETNAMESE_DRILLS = [
  { id: 'vn_01', category: 'Final Consonants', text: 'cat, hat, sit, hot, cup', viHint: 'Phát âm rõ phụ âm cuối -t, -p', exampleSentence: 'The cat sat on the mat.' },
  { id: 'vn_02', category: 'Final Consonants', text: 'dogs, bags, hands, beds', viHint: 'Luyện phụ âm cuối -s, -z, -dz', exampleSentence: 'The dogs and cats play in the yard.' },
  { id: 'vn_03', category: 'Consonant Clusters', text: 'streets, tests, strengths', viHint: 'Không thêm nguyên âm giữa phụ âm', exampleSentence: 'The streets are full of strengths and tests.' },
  { id: 'vn_04', category: 'TH Sound', text: 'think, thank, three, throw', viHint: 'Đặt lưỡi giữa hai hàm răng', exampleSentence: 'I think we should thank the three.' },
  { id: 'vn_05', category: 'R vs L', text: 'red/led, right/light, rain/lane', viHint: 'Cuộn lưỡi cho /r/, chạm nướu cho /l/', exampleSentence: 'Turn right at the red light.' },
  { id: 'vn_06', category: 'V vs W', text: 'vest/west, vine/wine, very/wary', viHint: 'Cắn nhẹ môi dưới cho /v/', exampleSentence: 'The vine near the west wall.' },
];

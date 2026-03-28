const fs = require('fs');

let code = fs.readFileSync('apps/gateway-server/src/voice/voice.gateway.ts', 'utf8');

// 1. Add Redis import
code = code.replace(/import { JwtService } from '@nestjs\/jwt';/,
`import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';`);

// 2. Add trackers and init
code = code.replace(/  private readonly isSwitching = new Set<string>\(\);/,
`  private readonly isSwitching = new Set<string>();

  // ── IRT Placement Level Subscriber ──────────
  private placementLevelSubscriber: Redis | null = null;

  // ── Affective Computing tracking ──────────
  /** Maps socketId → NodeJS.Timeout for detecting long silence */
  private readonly socketSilenceTimers = new Map<string, NodeJS.Timeout>();`);

code = code.replace(/  \) \{\}/,
`  ) {
    this.initPlacementLevelSubscriber();
  }`);

code = code.replace(/  \/\/ ═══════════════════════════════════════════════════════════════\n  \/\/ CONNECTION LIFECYCLE/,
`  private async initPlacementLevelSubscriber() {
    try {
      this.placementLevelSubscriber = this.redis.getClient().duplicate();
      await this.placementLevelSubscriber.subscribe('placement_level_update', (err: any, count: any) => {
        if (err) this.logger.error('Failed to subscribe to placement_level_update', err);
      });
      this.placementLevelSubscriber.on('message', (channel: string, message: string) => {
        if (channel === 'placement_level_update') {
          try {
            const data = JSON.parse(message);
            this.handlePlacementLevelUpdate(data.userId, data.newLevel);
          } catch (e) {
            this.logger.error('Failed to parse placement_level_update message', e);
          }
        }
      });
    } catch (e) {
      this.logger.error('Failed to initialize placement level subscriber', e);
    }
  }

  private handlePlacementLevelUpdate(userId: string, newLevel: string) {
    let targetSocketId: string | undefined;
    for (const [socketId, uid] of this.socketUsers.entries()) {
      if (uid === userId && this.socketModes.get(socketId) === 'PLACEMENT_TEST') {
        targetSocketId = socketId;
        break;
      }
    }

    if (targetSocketId) {
      this.logger.log(\`[IRT] Adjusting placement test difficulty to \${newLevel} for user \${userId}\`);
      const providerSessionId = this.providerSessionIds.get(targetSocketId);
      const provider = this.socketProviders.get(targetSocketId);

      if (providerSessionId) {
        const prompt = \`System instruction: The student's current estimated level is now \${newLevel}. Adjust your next question to exactly match this CEFR difficulty level.\`;
        if (provider === 'openai') {
          this.openaiService.sendTextPrompt(providerSessionId, prompt);
        } else {
          this.geminiService.sendTextPrompt(providerSessionId, prompt);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CONNECTION LIFECYCLE`);

// 3. Vocab Forcing
code = code.replace(/const systemPrompt = await this\.buildAdaptivePrompt\(userId, profile, 'FREE_TALK'\);/g,
`const targetWords = await this.redis.getClient().lrange(\`vocab_force:\${userId}\`, 0, 2);
      const systemPrompt = await this.buildAdaptivePrompt(userId, profile, 'FREE_TALK', undefined, undefined, undefined, targetWords);`);

code = code.replace(/let systemPrompt = await this\.buildAdaptivePrompt\([\s\S]*?userId,\n        profile \|\| \{ currentLevel: 'A1', confidenceScore: '0\.5', vnSupportEnabled: 'true', tier: 'FREE' \},\n        mode,\n      \);/,
`const targetWords = await this.redis.getClient().lrange(\`vocab_force:\${userId}\`, 0, 2);
      let systemPrompt = await this.buildAdaptivePrompt(
        userId,
        profile || { currentLevel: 'A1', confidenceScore: '0.5', vnSupportEnabled: 'true', tier: 'FREE' },
        mode,
        undefined,
        undefined,
        undefined,
        targetWords
      );`);

code = code.replace(/const systemPrompt = await this\.buildAdaptivePrompt\([\s\S]*?userId,\n        profile \|\| \{ currentLevel: 'A1', confidenceScore: '0\.5', vnSupportEnabled: 'true', tier: 'FREE' \},\n        data\.mode,\n        scenarioId,\n        topicId,\n        ragContext,\n      \);/,
`const targetWords = await this.redis.getClient().lrange(\`vocab_force:\${userId}\`, 0, 2);
      const systemPrompt = await this.buildAdaptivePrompt(
        userId,
        profile || { currentLevel: 'A1', confidenceScore: '0.5', vnSupportEnabled: 'true', tier: 'FREE' },
        data.mode,
        scenarioId,
        topicId,
        ragContext,
        targetWords,
      );`);

code = code.replace(/  private async buildAdaptivePrompt\(\n    userId: string,\n    profile: Record<string, string>,\n    mode: string,\n    scenarioId\?: string,\n    topicId\?: string,\n    ragContext\?: string,\n  \): Promise<string> \{/,
`  private async buildAdaptivePrompt(
    userId: string,
    profile: Record<string, string>,
    mode: string,
    scenarioId?: string,
    topicId?: string,
    ragContext?: string,
    targetWords?: string[],
  ): Promise<string> {`);

code = code.replace(/\$\{groundedContext\}\n\n<security_shield>/,
`\${groundedContext}\${targetWords && targetWords.length > 0 ? \`\\n\\n[SECRET MISSION]\\nYour secret mission today is to subtly force the student to say these target words naturally: [\${targetWords.join(', ')}]. \\nCreate conversational situations or ask questions that heavily imply these words. \\nIf the student says the word, or any variation of it, YOU MUST immediately and enthusiastically praise them (e.g., "Wow, you used the word '\${targetWords[0]}' perfectly!"), and then transition to another topic or the next target word.\` : ''}

<security_shield>`);

// 4. UserTranscript Interceptions (Affective & IRT)
code = code.replace(/      client\.emit\('ai_transcript', \{ text: redactedUserText, isUser: true \}\); \/\/ Echo back to client/g,
`      client.emit('ai_transcript', { text: redactedUserText, isUser: true }); // Echo back to client

      // Placement Test IRT trigger
      const currentMode = this.socketModes.get(client.id) || 'FREE_TALK';
      const dbSessionIdVal = this.socketSessions.get(client.id);
      const userIdVal = this.socketUsers.get(client.id);

      if (currentMode === 'PLACEMENT_TEST' && dbSessionIdVal && userIdVal) {
        this.rabbitmq.dispatchDeepBrainTask('placement_turn_evaluate', {
          userId: userIdVal,
          sessionId: dbSessionIdVal,
          transcript: redactedUserText,
        }).catch(e => this.logger.error('Failed to queue placement turn evaluation to RabbitMQ', e));
      }

      // Affective Computing: Check for filler words
      const fillerRegex = /(^|\\s)(uh|um|hmm|ờ|ờm)(?=\\s|$)/gi;
      const fillers = redactedUserText.match(fillerRegex);
      if (fillers && fillers.length > 3) {
        this.logger.log(\`[Affective] Detected \${fillers.length} filler words for \${client.id}\`);
        const providerSessionId = this.providerSessionIds.get(client.id);
        if (providerSessionId) {
          const provider = this.socketProviders.get(client.id);
          const prompt = "System instruction: The student is using many filler words and seems anxious. Instantly switch to a warmer, more comforting tone. Speak 30% slower and offer 2 simple hints in Vietnamese to help them out.";
          if (provider === 'openai') {
            this.openaiService.sendTextPrompt(providerSessionId, prompt);
          } else {
            this.geminiService.sendTextPrompt(providerSessionId, prompt);
          }
        }
      }`);

// 5. Affective Computing timers
code = code.replace(/    emitter\.on\('turnComplete', \(\) => \{\n      client\.emit\('turn_complete'\);\n    \}\);/,
`    emitter.on('turnComplete', () => {
      client.emit('turn_complete');

      // Affective Computing: Start 4s silence detection
      const existingTimer = this.socketSilenceTimers.get(client.id);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        this.logger.log(\`[Affective] User \${client.id} silent for 4s.\`);
        const providerSessionId = this.providerSessionIds.get(client.id);
        if (providerSessionId) {
          const provider = this.socketProviders.get(client.id);
          const prompt = "System instruction: The user has been silent for 4 seconds. They might be stuck. Gently offer a hint or suggest a simpler way to express their idea in Vietnamese.";
          if (provider === 'openai') {
            this.openaiService.sendTextPrompt(providerSessionId, prompt);
          } else {
            this.geminiService.sendTextPrompt(providerSessionId, prompt);
          }
        }
      }, 4000);
      this.socketSilenceTimers.set(client.id, timer);
    });

    emitter.on('speechStarted', () => {
      // Affective Computing: Clear silence timer on VAD detection
      const existingTimer = this.socketSilenceTimers.get(client.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.socketSilenceTimers.delete(client.id);
      }
    });`);

code = code.replace(/    this\.socketAudioEventCounts\.delete\(client\.id\);/g,
`    this.socketAudioEventCounts.delete(client.id);
    const silenceTimer = this.socketSilenceTimers.get(client.id);
    if (silenceTimer) clearTimeout(silenceTimer);
    this.socketSilenceTimers.delete(client.id);`);

// 6. Save placement score and add validMode
code = code.replace(/    \/\/ 4\. Batch update user token balance/g,
`    // Save placement test result to DB
    const mode = this.socketModes.get(client.id) || 'FREE_TALK';
    if (mode === 'PLACEMENT_TEST' && userId) {
      const eloKey = \`placement_elo:\${userId}\`;
      const profileKey = \`user_profile:\${userId}\`;
      try {
        const elo = await this.redis.getClient().get(eloKey);
        const profileStr = await this.redis.getClient().get(profileKey);
        if (elo && profileStr) {
           const profile = JSON.parse(profileStr);
           const level = profile.currentLevel;
           await this.profileRepo.update({ userId }, { currentLevel: level });
           this.logger.log(\`Placement test finished for \${userId}. Level set to \${level} (Elo: \${elo})\`);
        }
      } catch (e) {
        this.logger.error(\`Failed to save placement level to DB: \${(e as Error).message}\`);
      }
    }

    // 4. Batch update user token balance`);

code = code.replace(/        'TOPIC_DISCUSSION',\n      \];/,
`        'TOPIC_DISCUSSION',
        'PLACEMENT_TEST',
      ];`);

code = code.replace(/      case 'TOPIC_DISCUSSION':\n        return `MODE: Topic Discussion\$\{topicId \? ` \(Topic: \$\{topicId\}\)` : ''\}\nGuide a focused discussion on a specific topic\.\n- Introduce the topic with a question or statement\n- Ask probing questions to deepen discussion\n- Introduce topic-specific vocabulary\n- Encourage the student to express opinions with supporting reasons\n- Keep discussion at \$\{level\} level with appropriate complexity`;/,
`      case 'TOPIC_DISCUSSION':
        return \`MODE: Topic Discussion\${topicId ? \` (Topic: \${topicId})\` : ''}
Guide a focused discussion on a specific topic.
- Introduce the topic with a question or statement
- Ask probing questions to deepen discussion
- Introduce topic-specific vocabulary
- Encourage the student to express opinions with supporting reasons
- Keep discussion at \${level} level with appropriate complexity\`;

      case 'PLACEMENT_TEST':
        return \`MODE: Dynamic Placement Test
You are assessing the student's English proficiency level using a conversational adaptive test.
- The student's estimated current level is \${level}. Ask a question or provide a speaking prompt appropriate for this exact level.
- Keep your turn relatively short (1-2 sentences) so the student has to speak.
- Do NOT correct their grammar or vocabulary directly. Your job is to listen and ask the next question.
- Do NOT give them their score. Act like a friendly conversational partner who is getting to know them.
- If they ask for help, provide minimal assistance and move to a simpler question.\`;`);

code = code.replace(/      TOPIC_DISCUSSION:\n        "Topic discussion mode! I'll guide us through a topic\.",\n    \};/,
`      TOPIC_DISCUSSION:
        "Topic discussion mode! I'll guide us through a topic.",
      PLACEMENT_TEST:
        "Welcome to the Placement Test! Let's have a quick 5-minute chat to find your level.",
    };`);


fs.writeFileSync('apps/gateway-server/src/voice/voice.gateway.ts', code);

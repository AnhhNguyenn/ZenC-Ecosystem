const fs = require('fs');

let code = fs.readFileSync('apps/gateway-server/src/voice/voice.gateway.ts', 'utf8');

code = code.replace(/    emitter\.on\('userTranscript', async \(text: string\) => \{\n      \/\/ ── PII REDACTION \(Client Audio → Log\/AI\) ──\n      \/\/ Before routing or sending to Redis, redact PII from the raw transcript\.\n      const redactedUserText = this\.redactPii\(text\);\n      client\.emit\('ai_transcript', \{ text: redactedUserText, isUser: true \}\); \/\/ Echo back to client\n\n      \/\/ Trigger real-time grammar check on user's recent text if enabled, only when user finishes a sentence\n      if \(this\.correctionEnabled\.get\(client\.id\)\) \{\n        void this\.triggerRealtimeGrammarCheck\(client\);\n      \}\n\n      const sid = this\.socketSessions\.get\(client\.id\);\n      if \(sid\) \{\n        this\.redis\.appendTranscriptLine\(sid, 'user', redactedUserText\)\.catch\(e => this\.logger\.error\(e\)\);\n      \}\n\n      \/\/ ── COGNITIVE ROUTING \(Handover to Deep Brain\) ──\n      const dbSessionId = this\.socketSessions\.get\(client\.id\);\n      const providerSessionId = this\.providerSessionIds\.get\(client\.id\);\n      const userId = this\.socketUsers\.get\(client\.id\);\n      \n      const isGrammarIntent = await this\.classifyIntent\(redactedUserText\);/g,
`    emitter.on('userTranscript', async (text: string) => {
      // ── PII REDACTION (Client Audio → Log/AI) ──
      // Before routing or sending to Redis, redact PII from the raw transcript.
      const redactedUserText = this.redactPII(text);
      client.emit('ai_transcript', { text: redactedUserText, isUser: true }); // Echo back to client

      const currentMode = this.socketModes.get(client.id) || 'FREE_TALK';
      const dbSessionIdVal = this.socketSessions.get(client.id);
      const userIdVal = this.socketUsers.get(client.id);

      // Placement Test IRT trigger
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
      }

      // Trigger real-time grammar check on user's recent text if enabled, only when user finishes a sentence
      if (this.correctionEnabled.get(client.id)) {
        void this.triggerRealtimeGrammarCheck(client, redactedUserText);
      }

      const sid = dbSessionIdVal;
      if (sid) {
        this.redis.appendTranscriptLine(sid, 'user', redactedUserText).catch(e => this.logger.error(e));
      }

      // ── COGNITIVE ROUTING (Handover to Deep Brain) ──
      const dbSessionId = dbSessionIdVal;
      const providerSessionId = this.providerSessionIds.get(client.id);
      const userId = userIdVal;

      const isGrammarIntent = await this.classifyIntent(redactedUserText);`);

code = code.replace(/    this\.socketAudioEventCounts\.delete\(client\.id\);\n\n    \/\/ 6\. Remove active session from Redis \(Prevent Race Condition\)/g,
`    this.socketAudioEventCounts.delete(client.id);
    const silenceTimer = this.socketSilenceTimers.get(client.id);
    if (silenceTimer) clearTimeout(silenceTimer);
    this.socketSilenceTimers.delete(client.id);

    // 6. Remove active session from Redis (Prevent Race Condition)`);

fs.writeFileSync('apps/gateway-server/src/voice/voice.gateway.ts', code);

const fs = require('fs');
let content = fs.readFileSync('apps/gateway-server/src/voice/voice.gateway.ts', 'utf8');

content = content.replace(/      \/\/ ── Step 5: Create AI Session ───────────────────────────────\n      const targetWords = await this\.redis\.getClient\(\)\.lrange\(`vocab_force:\$\{userId\}`\, 0, 2\);\n      const systemPrompt = await this\.buildAdaptivePrompt\([\s\S]*?this\.logger\.error\(\n        `Switch mode error: \$\{\(error as Error\)\.message\}`\,\n      \);\n    \}\n  \}\n/g, '');

content = content.replace(/      \/\/ ── Step 5: Create AI Session ───────────────────────────────\n/g,
`      // ── Step 5: Create AI Session ───────────────────────────────
      const targetWords = await this.redis.getClient().lrange(\`vocab_force:\${userId}\`, 0, 2);
      const systemPrompt = await this.buildAdaptivePrompt(userId, profile, 'FREE_TALK', undefined, undefined, undefined, targetWords);`);

content = content.replace(/  private async initPlacementLevelSubscriber\(\) \{[\s\S]*?private handlePlacementLevelUpdate\(userId: string, newLevel: string\) \{/g,
`  private selectProvider(): 'gemini' | 'openai' {
    const primaryConfig = this.config.get<string>(
      'AI_PROVIDER_PRIMARY',
      'gemini',
    );

    if (primaryConfig === 'gemini' && this.geminiService.isHealthy()) {
      return 'gemini';
    }
    if (primaryConfig === 'openai' && this.openaiService.isHealthy()) {
      return 'openai';
    }

    // Fallback logic
    if (this.geminiService.isHealthy()) return 'gemini';
    if (this.openaiService.isHealthy()) return 'openai';

    // Both unhealthy – try Gemini anyway (it will retry)
    this.logger.warn('Both AI providers unhealthy, defaulting to Gemini');
    return 'gemini';
  }

  private async initPlacementLevelSubscriber() {
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

  private handlePlacementLevelUpdate(userId: string, newLevel: string) {`);

fs.writeFileSync('apps/gateway-server/src/voice/voice.gateway.ts', content);

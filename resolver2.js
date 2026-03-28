const fs = require('fs');
let content = fs.readFileSync('apps/gateway-server/src/voice/voice.gateway.ts', 'utf8');

// Fix triggerRealtimeGrammarCheck signature
content = content.replace(/triggerRealtimeGrammarCheck\(client\)/g, 'triggerRealtimeGrammarCheck(client, redactedUserText)');

// Fix dangling arguments from buildAdaptivePrompt
content = content.replace(/let systemPrompt = await this\.buildAdaptivePrompt\([\s\S]*?targetWords\n      \);\n        profile \|\| \{ currentLevel: 'A1', confidenceScore: '0\.5', vnSupportEnabled: 'true', tier: 'FREE' \},\n        mode,\n        undefined,\n        undefined,\n        undefined,\n        targetWords\n      \);/g, `let systemPrompt = await this.buildAdaptivePrompt(
        userId,
        profile || { currentLevel: 'A1', confidenceScore: '0.5', vnSupportEnabled: 'true', tier: 'FREE' },
        mode,
        undefined,
        undefined,
        undefined,
        targetWords
      );`);

content = content.replace(/const systemPrompt = await this\.buildAdaptivePrompt\([\s\S]*?targetWords,\n      \);\n        profile \|\| \{ currentLevel: 'A1', confidenceScore: '0\.5', vnSupportEnabled: 'true', tier: 'FREE' \},\n        data\.mode,\n        scenarioId,\n        topicId,\n        ragContext,\n        targetWords,\n      \);/g, `const systemPrompt = await this.buildAdaptivePrompt(
        userId,
        profile || { currentLevel: 'A1', confidenceScore: '0.5', vnSupportEnabled: 'true', tier: 'FREE' },
        data.mode,
        scenarioId,
        topicId,
        ragContext,
        targetWords,
      );`);

// Fix redeclared block scope variables
content = content.replace(/      const dbSessionId = this\.socketSessions\.get\(client\.id\);\n      const providerSessionId = this\.providerSessionIds\.get\(client\.id\);\n      const userId = this\.socketUsers\.get\(client\.id\);\n      \n      const isGrammarIntent = await this\.classifyIntent\(text\);/g, `      // Variables were already defined earlier in the block.
      // Doing cognitive routing using existing vars dbSessionIdVal, userIdVal, etc.
      const isGrammarIntent = await this.classifyIntent(text);`);

content = content.replace(/      const dbSessionId = this\.socketSessions\.get\(client\.id\);\n      const providerSessionId = this\.providerSessionIds\.get\(client\.id\);\n      const userId = this\.socketUsers\.get\(client\.id\);\n      \n      const isGrammarIntent = await this\.classifyIntent\(redactedUserText\);/g, `      const providerSessionId = this.providerSessionIds.get(client.id);
      const isGrammarIntent = await this.classifyIntent(redactedUserText);`);

content = content.replace(/      if \(dbSessionId && providerSessionId && userId && isGrammarIntent\) \{/g, `      if (dbSessionIdVal && providerSessionId && userIdVal && isGrammarIntent) {`);

content = content.replace(/const sid = this\.socketSessions\.get\(client\.id\);/g, `const sid = dbSessionIdVal;`);

fs.writeFileSync('apps/gateway-server/src/voice/voice.gateway.ts', content);

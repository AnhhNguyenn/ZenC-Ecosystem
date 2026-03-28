const fs = require('fs');
let content = fs.readFileSync('apps/gateway-server/src/voice/voice.gateway.ts', 'utf8');

// I will just replace the entire content with a correctly patched version from scratch based on the original master.
// Instead of complex regexes, let's reset to master and do it line by line safely.

const fs = require('fs');
let content = fs.readFileSync('apps/gateway-server/src/voice/voice.gateway.ts', 'utf8');

content = content.replace(
/<<<<<<< HEAD[\s\S]*?>>>>>>> origin\/master\n=======[\s\S]*?>>>>>>> REPLACE/g, '');

content = content.replace(/redactPii/g, 'redactPII');
fs.writeFileSync('apps/gateway-server/src/voice/voice.gateway.ts', content);

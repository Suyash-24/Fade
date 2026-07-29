const tio = require('tio.js').default || require('tio.js');

const code = `
const targetUser = "@user_target";
const exploitPayload = "0x0A9F21B";

async function bypassSecurity() {
    console.log(\`[+] Initializing exploit payload \${exploitPayload}...\`);
    await new Promise(r => setTimeout(r, 600));
    console.log(\`[+] Bypassing Discord OAuth2 Gateway...\`);
    await new Promise(r => setTimeout(r, 500));
    console.log(\`[+] Injecting SQL payload into user database...\`);
    await new Promise(r => setTimeout(r, 800));
    console.log(\`[+] Access granted. Extracting credentials...\\n\`);
    await new Promise(r => setTimeout(r, 1200));

    console.log(\`=================================\`);
    console.log(\`TARGET COMPROMISED\`);
    console.log(\`Email:    [SENT TO YOUR DMs]\`);
    console.log(\`Password: [SENT TO YOUR DMs]\`);
    console.log(\`=================================\`);
    console.log(\`\\nSelf-destructing logs in 15 seconds...\`);
}

bypassSecurity();
`;

tio(code, { language: 'javascript-node' })
    .then(console.log)
    .catch(e => console.error(e));

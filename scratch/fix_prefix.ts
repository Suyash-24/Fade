import fs from 'fs';
import path from 'path';

const files = [
    'src/commands/utility/afk.ts',
    'src/commands/utility/askai.ts',
    'src/commands/general/avatar.ts',
    'src/commands/economy/coinflip.ts',
    'src/commands/general/fortnite.ts',
    'src/commands/utility/imagine.ts',
    'src/commands/general/ping.ts',
    'src/commands/fun/quote.ts',
    'src/commands/scrapbook/scrapbook.ts',
    'src/commands/general/serverinfo.ts',
    'src/commands/fun/ship.ts',
    'src/commands/utility/snipe.ts',
    'src/commands/general/valorant.ts'
];

for (const f of files) {
    const fullPath = path.join(process.cwd(), f);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        // Check if prefixOnly is already there
        if (!content.includes('prefixOnly:')) {
            // Find category: '...' or similar and insert prefixOnly: true, after it
            content = content.replace(/(category:\s*['"][a-zA-Z]+['"],)/, '$1\n    prefixOnly: true,');
            fs.writeFileSync(fullPath, content);
            console.log(`Updated ${f}`);
        }
    } else {
        console.log(`Not found: ${f}`);
    }
}

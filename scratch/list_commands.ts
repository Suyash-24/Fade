import fs from 'fs';
import path from 'path';

async function loadCommands() {
    const dir = path.join(process.cwd(), 'src/commands');
    let count = 0;
    const list: string[] = [];
    
    async function scan(currentDir: string) {
        const files = fs.readdirSync(currentDir);
        for (const file of files) {
            const fullPath = path.join(currentDir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                await scan(fullPath);
            } else if (fullPath.endsWith('.ts')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                // Regex to catch varying spaces
                const isMusic = /category:\s*['"]music['"]/.test(content);
                const isPrefixOnly = /prefixOnly:\s*true/.test(content);
                
                if (!isMusic && !isPrefixOnly) {
                    const match = content.match(/setName\(\s*['"`]([^'"`]+)['"`]\s*\)/);
                    if (match) {
                        list.push(match[1]);
                        count++;
                    }
                }
            }
        }
    }
    
    await scan(dir);
    list.sort();
    console.log(`Total: ${count}`);
    let output = '';
    list.forEach((cmd, i) => output += `${i + 1}. ${cmd}\n`);
    console.log(output);
}
loadCommands();

const fs = require('fs');
const path = require('path');
const commandsDir = path.join('D:\\Suyash\\Fade\\src\\commands');
const results = {};

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const cat = path.basename(path.dirname(fullPath));
            
            // Basic regex to find setName and setDescription
            // This is a naive parse and might miss subcommands, but it's a start.
            let nameMatch = content.match(/\.setName\(['"`](.+?)['"`]\)/);
            let descMatch = content.match(/\.setDescription\(['"`](.+?)['"`]\)/);
            
            if (nameMatch) {
                if (!results[cat]) results[cat] = [];
                
                // Let's also look for subcommands
                const subcommands = [];
                const subReg = /\.addSubcommand\(.*?\.setName\(['"`](.+?)['"`]\).*?\.setDescription\(['"`](.+?)['"`]\)/gs;
                let match;
                while ((match = subReg.exec(content)) !== null) {
                    subcommands.push({name: match[1], desc: match[2]});
                }
                
                results[cat].push({
                    name: nameMatch[1],
                    desc: descMatch ? descMatch[1] : 'No description',
                    subcommands: subcommands,
                    file: path.basename(file)
                });
            }
        }
    }
}
walk(commandsDir);
fs.writeFileSync('commands_dump.json', JSON.stringify(results, null, 2));
console.log('Dumped to commands_dump.json');

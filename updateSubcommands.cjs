const fs = require('fs');
const path = require('path');
const https = require('https');

async function fetchServerCount(token) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'discord.com',
            path: '/api/v10/users/@me/guilds',
            method: 'GET',
            headers: {
                'Authorization': `Bot ${token}`,
                'User-Agent': 'DiscordBot (https://github.com, 1.0.0)'
            }
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const guilds = JSON.parse(data);
                        resolve(guilds.length);
                    } catch (e) {
                        resolve(0);
                    }
                } else {
                    resolve(0);
                }
            });
        });
        req.on('error', () => resolve(0));
        req.end();
    });
}

async function main() {
    const commandsDir = path.join(process.cwd(), 'src/commands');
    function getFiles(dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                results = results.concat(getFiles(filePath));
            } else if (filePath.endsWith('.ts')) {
                results.push(filePath);
            }
        });
        return results;
    }

    const files = getFiles(commandsDir);
    const commands = [];
    
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        
        let baseName = '';
        let baseDesc = '';
        
        const baseNameMatch = content.match(/\.setName\(['"\`](.+?)['"\`]\)/);
        if (baseNameMatch) baseName = baseNameMatch[1];
        else {
            const n2 = content.match(/name:\s*['"\`](.+?)['"\`]/);
            if (n2) baseName = n2[1];
        }
        
        const catMatch = content.match(/category:\s*['"\`](.+?)['"\`]/);
        const category = catMatch ? catMatch[1] : 'general';

        // Try to find subcommands
        const subCmdRegex = /\.addSubcommand\s*\([^=>]+=>[^.]+\.setName\(['"\`](.+?)['"\`]\)[\s\S]*?\.setDescription\(['"\`](.+?)['"\`]\)/g;
        let match;
        let foundSub = false;
        
        while ((match = subCmdRegex.exec(content)) !== null) {
            foundSub = true;
            commands.push({
                name: `${baseName} ${match[1]}`,
                description: match[2],
                category: category
            });
        }
        
        if (!foundSub && baseName) {
            const dMatch = content.match(/\.setDescription\(['"\`](.+?)['"\`]\)/);
            const dMatch2 = content.match(/description:\s*['"\`](.+?)['"\`]/);
            commands.push({
                name: baseName,
                description: dMatch ? dMatch[1] : (dMatch2 ? dMatch2[1] : ''),
                category: category
            });
        }
    }
    
    console.log(`Extracted ${commands.length} total commands including subcommands`);
    
    const grouped = {};
    commands.forEach(c => {
        if (!grouped[c.category]) grouped[c.category] = [];
        grouped[c.category].push(c);
    });
    
    let html = '';
    for (const [cat, cmds] of Object.entries(grouped)) {
        html += `\n<!-- ─── ${cat.charAt(0).toUpperCase() + cat.slice(1)} ───────────────────────────────── -->\n`;
        html += `<div class="cmd-section" data-category="${cat}">\n`;
        
        cmds.sort((a,b) => a.name.localeCompare(b.name));
        
        for (const cmd of cmds) {
            html += `
                    <div class="cmd-card" data-cmd="${cmd.name}" data-desc="${cmd.description.replace(/"/g, '&quot;')}" data-usage="/${cmd.name}" data-category-name="${cat.charAt(0).toUpperCase() + cat.slice(1)}" data-perms="None">
                        <div class="cmd-card-top">
                            <span class="cmd-card-name">${cmd.name}</span>
                            <button class="cmd-card-copy" title="Copy command" onclick="event.stopPropagation();copyCmd('/${cmd.name}',this)">
                                <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            </button>
                        </div>
                        <p class="cmd-card-desc">${cmd.description}</p>
                    </div>\n`;
        }
        html += `                </div>\n`;
    }
    
    const webDir = path.join(process.cwd(), '../Fade web');
    const cmdHtmlPath = path.join(webDir, 'commands.html');
    let cmdHtml = fs.readFileSync(cmdHtmlPath, 'utf-8');
    
    const startTag = '<div class="cmd-grid" id="cmdGrid">';
    const startIdx = cmdHtml.indexOf(startTag);
    const endTag = '</main>';
    const endIdx = cmdHtml.indexOf(endTag);
    
    if (startIdx !== -1 && endIdx !== -1) {
        const before = cmdHtml.substring(0, startIdx + startTag.length);
        const newContent = before + '\n' + html + '\n            </div>\n        ' + endTag + cmdHtml.substring(endIdx + endTag.length);
        
        fs.writeFileSync(cmdHtmlPath, newContent);
        console.log('Updated commands.html');
    }
    
    // Update index.html
    const envContent = fs.readFileSync('.env', 'utf-8');
    const tokenMatch = envContent.match(/DISCORD_TOKEN=(.+)/);
    let serverCount = 2500;
    if (tokenMatch) {
        serverCount = await fetchServerCount(tokenMatch[1].trim());
    }
    console.log(`Server count fetched: ${serverCount}`);
    
    const indexHtmlPath = path.join(webDir, 'index.html');
    let indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
    
    indexHtml = indexHtml.replace(/<span class="stat-num" data-count="\d+">\d*<\/span>\s*<span class="stat-label">Servers Protected<\/span>/, `<span class="stat-num" data-count="${serverCount}">0</span>\n                    <span class="stat-label">Servers Protected</span>`);
    indexHtml = indexHtml.replace(/<span class="stat-num" data-count="\d+">\d*<\/span>\s*<span class="stat-label">Commands<\/span>/, `<span class="stat-num" data-count="${commands.length}">0</span>\n                    <span class="stat-label">Commands</span>`);
    
    fs.writeFileSync(indexHtmlPath, indexHtml);
    console.log('Updated index.html');
}

main();

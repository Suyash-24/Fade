const fs = require('fs');
const path = require('path');

const dumpPath = path.join(__dirname, 'commands_dump.json');
const htmlPath = 'D:\\Suyash\\Fade Web\\commands.html';

const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

// Format category names properly
const formatName = (str) => {
    if (str === 'antinuke') return 'Anti-Nuke';
    if (str === 'antiraid') return 'Anti-Raid';
    if (str === 'automod') return 'AutoMod';
    if (str === 'tempvoice') return 'TempVoice';
    if (str === 'Reputation') return 'Reputation';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

const categories = Object.keys(dump).sort((a,b) => {
  // Reputation should be lowercase 'reputation' for data-category but wait, let's keep exact keys
  return a.localeCompare(b);
});

let mainHtml = '';

for (const cat of categories) {
    if (cat === 'developer') continue; 
    
    // Some categories in existing HTML are named differently
    let dataCat = cat.toLowerCase();
    const catName = formatName(cat);

    mainHtml += `\n<!-- ─── ${catName} ───────────────────────────────── -->\n`;
    mainHtml += `<div class="cmd-section" data-category="${dataCat}">\n`;

    const commands = dump[cat];
    // sort commands by name
    commands.sort((a, b) => a.name.localeCompare(b.name));
    
    for (const cmd of commands) {
        if (cmd.subcommands && cmd.subcommands.length > 0) {
            cmd.subcommands.sort((a, b) => a.name.localeCompare(b.name));
            for (const sub of cmd.subcommands) {
                const fullName = `${cmd.name} ${sub.name}`;
                const usage = `/${fullName}`;
                const descEscaped = sub.desc.replace(/"/g, '&quot;');
                
                mainHtml += `
    <div class="cmd-card" data-cmd="${fullName}" data-desc="${descEscaped}" data-usage="${usage}" data-category-name="${catName}" data-perms="None">
        <div class="cmd-card-top">
            <span class="cmd-card-name">${fullName}</span>
            <button class="cmd-card-copy" title="Copy command" onclick="event.stopPropagation();copyCmd('${usage}',this)">
                <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
        </div>
        <p class="cmd-card-desc">${sub.desc}</p>
    </div>`;
            }
        } else {
            const fullName = cmd.name;
            const usage = `/${fullName}`;
            const descEscaped = cmd.desc.replace(/"/g, '&quot;');
            mainHtml += `
    <div class="cmd-card" data-cmd="${fullName}" data-desc="${descEscaped}" data-usage="${usage}" data-category-name="${catName}" data-perms="None">
        <div class="cmd-card-top">
            <span class="cmd-card-name">${fullName}</span>
            <button class="cmd-card-copy" title="Copy command" onclick="event.stopPropagation();copyCmd('${usage}',this)">
                <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
        </div>
        <p class="cmd-card-desc">${cmd.desc}</p>
    </div>`;
        }
    }

    mainHtml += `\n</div>\n`;
}

let html = fs.readFileSync(htmlPath, 'utf8');

// Replace everything inside <div class="cmd-grid" id="cmdGrid"> ... </div> (until the end of cmd-main)
const startTag = '<div class="cmd-grid" id="cmdGrid">';
const startIndex = html.indexOf(startTag);

if (startIndex !== -1) {
    const startContent = startIndex + startTag.length;
    // Find where main ends
    const endIndex = html.indexOf('</main>', startContent);
    
    if (endIndex !== -1) {
        // The div cmd-grid is closed right before </main> or some wrapper. 
        // Let's just find the closing div of cmd-grid.
        // Or we can just use regex to replace between cmdGrid and </main>
        
        let before = html.substring(0, startContent);
        let after = html.substring(endIndex);
        
        // Wait, cmd-grid must be closed.
        let newHtml = before + '\n' + mainHtml + '\n            </div>\n        ' + after;
        fs.writeFileSync(htmlPath, newHtml);
        console.log('Successfully updated cmd-grid in commands.html');
    }
}

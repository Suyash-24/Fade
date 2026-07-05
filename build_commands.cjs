const fs = require('fs');
const path = require('path');

const dumpPath = path.join(__dirname, 'commands_dump.json');
const htmlPath = 'D:\\\\Suyash\\\\Fade Web\\\\commands.html';

const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

// Format category names properly
const formatName = (str) => {
    if (str === 'antinuke') return 'Anti-Nuke';
    if (str === 'antiraid') return 'Anti-Raid';
    if (str === 'automod') return 'AutoMod';
    if (str === 'tempvoice') return 'TempVoice';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

// Sort categories
const categories = Object.keys(dump).sort();

// We want to skip 'developer' usually, but let's keep it if it's in the dump.
// Let's build the HTML.

let sidebarHtml = `
<div class="cmd-sidebar-item active" data-filter="all">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
    All Commands
</div>
`;

let mainHtml = '';

for (const cat of categories) {
    if (cat === 'developer') continue; // hide developer commands from public site
    const catName = formatName(cat);
    
    // Icon logic could be added, using a generic terminal icon for all for now, or match existing
    sidebarHtml += `
<div class="cmd-sidebar-item" data-filter="${cat}">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 17l6-6-6-6M12 19h8"></path></svg>
    ${catName}
</div>
`;

    mainHtml += `<div class="cmd-section" data-category="${cat}">\n`;
    mainHtml += `    <div class="cmd-category-title">${catName}</div>\n`;
    mainHtml += `    <div class="cmd-category">\n`;

    const commands = dump[cat];
    // sort commands by name
    commands.sort((a, b) => a.name.localeCompare(b.name));
    
    for (const cmd of commands) {
        if (cmd.subcommands && cmd.subcommands.length > 0) {
            // It's a command group with subcommands
            cmd.subcommands.sort((a, b) => a.name.localeCompare(b.name));
            for (const sub of cmd.subcommands) {
                const fullName = `${cmd.name} ${sub.name}`;
                const usage = `/${fullName}`;
                mainHtml += `
        <div class="cmd-item" data-cmd="${fullName}" data-desc="${sub.desc.replace(/"/g, '&quot;')}" data-usage="${usage}" data-category-name="${catName}" data-perms="None">
            <div class="cmd-item-name">${fullName}</div>
            <div class="cmd-item-desc">${sub.desc}</div>
        </div>`;
            }
        } else {
            // It's a standard command
            const fullName = cmd.name;
            const usage = `/${fullName}`;
            mainHtml += `
        <div class="cmd-item" data-cmd="${fullName}" data-desc="${cmd.desc.replace(/"/g, '&quot;')}" data-usage="${usage}" data-category-name="${catName}" data-perms="None">
            <div class="cmd-item-name">${fullName}</div>
            <div class="cmd-item-desc">${cmd.desc}</div>
        </div>`;
        }
    }

    mainHtml += `    </div>\n</div>\n`;
}

// Now replace in commands.html
let html = fs.readFileSync(htmlPath, 'utf8');

// The HTML structure is:
// <div class="commands-layout">
//   <div class="cmd-sidebar" id="cmdSidebar">...</div>
//   <div class="cmd-main" id="cmdMain">...</div>
// </div>

html = html.replace(/<div class="cmd-sidebar" id="cmdSidebar">[\s\S]*?<\/div>\s*<div class="cmd-main" id="cmdMain">/, `<div class="cmd-sidebar" id="cmdSidebar">${sidebarHtml}</div>\n        <div class="cmd-main" id="cmdMain">`);

html = html.replace(/<div class="cmd-main" id="cmdMain">[\s\S]*?<!-- SEARCH MODAL -->/i, `<div class="cmd-main" id="cmdMain">\n${mainHtml}\n        </div>\n    </div>\n\n    <!-- SEARCH MODAL -->`);

fs.writeFileSync(htmlPath, html);
console.log('Successfully updated commands.html');

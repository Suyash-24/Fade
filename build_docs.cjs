const fs = require('fs');

const docsHtmlPath = 'D:\\\\Suyash\\\\Fade Web\\\\docs.html';
let currentHtml = fs.readFileSync(docsHtmlPath, 'utf8');

const navGroups = [
  {
    label: 'Overview',
    items: [
      { id: 'introduction', name: 'Introduction' },
      { id: 'getting-started', name: 'Getting Started' },
      { id: 'donator-perks', name: 'Donator Perks' },
      { id: 'customization', name: 'Customization' }
    ]
  },
  {
    label: 'Security',
    items: [
      { id: 'antinuke', name: 'Antinuke' },
      { id: 'antiraid', name: 'Anti-Raid' },
      { id: 'automod', name: 'AutoMod' },
      { id: 'fake-permissions', name: 'Fake Permissions' }
    ]
  },
  {
    label: 'Moderation & Logs',
    items: [
      { id: 'moderation', name: 'Moderation' },
      { id: 'logging', name: 'Logging' }
    ]
  },
  {
    label: 'Configuration',
    items: [
      { id: 'welcome', name: 'Welcome & Goodbye' },
      { id: 'roles', name: 'Role Systems' },
      { id: 'starboard', name: 'Starboard' },
      { id: 'tickets', name: 'Tickets' },
      { id: 'tempvoice', name: 'TempVoice' },
      { id: 'messages', name: 'Messages & Triggers' }
    ]
  },
  {
    label: 'Engagement',
    items: [
      { id: 'leveling', name: 'Leveling' },
      { id: 'economy', name: 'Economy' },
      { id: 'giveaways', name: 'Giveaways' },
      { id: 'bump-reminder', name: 'Bump Reminder' },
      { id: 'counters', name: 'Counters' },
      { id: 'stats', name: 'Activity Stats & Invites' }
    ]
  },
  {
    label: 'Utility & Fun',
    items: [
      { id: 'utility', name: 'Utility' },
      { id: 'music', name: 'Music' }
    ]
  }
];

// Generate Sidebar
let sidebarHtml = '';
navGroups.forEach(group => {
  sidebarHtml += `<div class="sidebar-group">\n`;
  sidebarHtml += `  <div class="sidebar-group-label">${group.label}</div>\n`;
  sidebarHtml += `  <nav class="sidebar-nav">\n`;
  group.items.forEach(item => {
    const active = item.id === 'introduction' ? ' active' : '';
    sidebarHtml += `    <a href="#${item.id}" class="sidebar-link${active}" data-section="${item.id}">${item.name}</a>\n`;
  });
  sidebarHtml += `  </nav>\n</div>\n`;
});

// Generate Content Sections
let flatItems = [];
navGroups.forEach(g => flatItems.push(...g.items));

const sectionsData = {
  'introduction': {
    category: 'Overview', title: 'Introduction',
    lead: 'Fade is a free, all-in-one Discord bot designed for absolute perfection.',
    content: `
      <h2>What is Fade?</h2>
      <p>Fade combines moderation, security, engagement, and utility into one fast, beautifully designed bot. You no longer need 10 different bots cluttering your server.</p>
      
      <h2>Core Features</h2>
      <div class="docs-card-grid">
          <div class="docs-feature-card">
              <span class="dfc-icon">🛡️</span>
              <div>
                  <h3 style="color:#fff;font-size:15px;margin-bottom:4px;">Enterprise Security</h3>
                  <p style="font-size:13px;color:#999;line-height:1.5;">Advanced Antinuke, Antiraid, and AutoMod systems to keep your server safe 24/7.</p>
              </div>
          </div>
          <div class="docs-feature-card">
              <span class="dfc-icon">⚙️</span>
              <div>
                  <h3 style="color:#fff;font-size:15px;margin-bottom:4px;">Deep Configuration</h3>
                  <p style="font-size:13px;color:#999;line-height:1.5;">Welcome cards, custom embeds, reaction roles, and ticket panels.</p>
              </div>
          </div>
          <div class="docs-feature-card">
              <span class="dfc-icon">🌟</span>
              <div>
                  <h3 style="color:#fff;font-size:15px;margin-bottom:4px;">Engagement</h3>
                  <p style="font-size:13px;color:#999;line-height:1.5;">Leveling, Economy, Starboard, and Giveaways to keep your community active.</p>
              </div>
          </div>
          <div class="docs-feature-card">
              <span class="dfc-icon">🎵</span>
              <div>
                  <h3 style="color:#fff;font-size:15px;margin-bottom:4px;">High-Quality Music</h3>
                  <p style="font-size:13px;color:#999;line-height:1.5;">Lag-free music playback with audio filters, lyrics, and 24/7 mode.</p>
              </div>
          </div>
      </div>
      
      <h2>Command Prefix</h2>
      <p>Fade uses Slash Commands (<code>/</code>) for everything, ensuring permissions are handled securely by Discord. It also supports the <code>f!</code> prefix for legacy text commands.</p>
    `
  },
  'getting-started': {
    category: 'Overview', title: 'Getting Started',
    lead: 'A step-by-step guide to setting up Fade in your server perfectly.',
    content: `
      <h2>Step 1: Invite and Role Position</h2>
      <p>Once you invite Fade, go to your Server Settings ➔ Roles. Drag the <strong>Fade</strong> role as high as possible. Fade cannot moderate anyone with a role higher than its own.</p>
      <div class="docs-callout callout-warn">
          <strong>Important:</strong> If Fade's role is below an admin, it cannot ban or kick them, and Antinuke cannot strip their permissions.
      </div>
      
      <h2>Step 2: Secure the Server (Antinuke & AutoMod)</h2>
      <p>Run <code>/antinuke toggle</code> to enable the antinuke. Then run <code>/antinuke admin</code> to give trusted co-owners access to configure it.</p>
      <p>Next, configure AutoMod by running <code>/automod toggle</code> and setting up your word blacklists with <code>/automod blacklist</code>.</p>
      
      <h2>Step 3: Set up Logging</h2>
      <p>Create a private staff channel (e.g., <code>#fade-logs</code>). Use <code>/logs setall</code> to send all moderation, message, and server logs to that channel.</p>
      
      <h2>Step 4: Engage the Community</h2>
      <p>Enable leveling with <code>/levelconfig toggle</code>, set up a starboard with <code>/starboard setup</code>, and design a beautiful welcome message with <code>/welcome build</code>.</p>
    `
  },
  'donator-perks': {
    category: 'Overview', title: 'Donator Perks',
    lead: 'Support Fade and unlock exclusive cosmetic features.',
    content: `
      <h2>Free Forever</h2>
      <p>All core functionality (Antinuke, Moderation, Logging, AutoMod, Tickets, Economy, Music) is 100% free and will always remain free.</p>
      
      <h2>Donator Benefits</h2>
      <ul class="docs-ol">
        <li><strong>Custom Welcome Cards:</strong> Upload custom background images for welcome/goodbye cards.</li>
        <li><strong>Higher Rate Limits:</strong> Increased limits for custom commands, playlists, and economy transactions.</li>
        <li><strong>Donator Badge:</strong> Exclusive badge on your <code>/userinfo</code> profile.</li>
        <li><strong>Priority Support:</strong> Access to a private support channel in our Discord.</li>
      </ul>
    `
  },
  'customization': {
    category: 'Overview', title: 'Customization',
    lead: 'Build custom embeds and use variables across the bot.',
    content: `
      <h2>Custom Embed Builder</h2>
      <p>Fade features a powerful scripting language for building embeds and cards.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>f!ce [#channel] &lt;script&gt;</code><span>Create a custom embed</span></div>
          <div class="cmd-row"><code>f!ce edit &lt;message_link&gt; &lt;script&gt;</code><span>Edit an existing embed</span></div>
      </div>
      
      <h2>Variables</h2>
      <p>You can use these variables in Welcome messages, Auto Responders, Custom Embeds, and more:</p>
      <div class="docs-table-wrap">
          <table class="docs-table">
              <thead><tr><th>Variable</th><th>Output</th></tr></thead>
              <tbody>
                  <tr><td><code>{user}</code></td><td>Mentions the user (@Suyash)</td></tr>
                  <tr><td><code>{username}</code></td><td>User's display name (Suyash)</td></tr>
                  <tr><td><code>{server}</code></td><td>Server name</td></tr>
                  <tr><td><code>{membercount}</code></td><td>Total members in the server</td></tr>
                  <tr><td><code>{channel}</code></td><td>Mentions the channel (#general)</td></tr>
                  <tr><td><code>{avatar}</code></td><td>URL of the user's avatar</td></tr>
              </tbody>
          </table>
      </div>
    `
  },
  'antinuke': {
    category: 'Security', title: 'Antinuke',
    lead: 'Advanced protection against rogue administrators and mass destruction.',
    content: `
      <h2>How it Works</h2>
      <p>Antinuke monitors moderation actions in real-time. If an admin exceeds the defined threshold within a time window, Fade instantly strips their roles, quarantines them, and reverses the damage.</p>
      
      <h2>Configuration</h2>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/antinuke toggle</code><span>Enable or disable the system</span></div>
          <div class="cmd-row"><code>/antinuke threshold</code><span>Set actions allowed per window</span></div>
          <div class="cmd-row"><code>/antinuke window</code><span>Set the time window (e.g. 10s, 1m)</span></div>
          <div class="cmd-row"><code>/antinuke logging</code><span>Set the alert channel</span></div>
      </div>
      
      <h2>Modules</h2>
      <p>You can toggle and configure punishments individually for:</p>
      <ul class="docs-ol">
        <li><strong>Bans:</strong> Triggers on mass banning.</li>
        <li><strong>Kicks:</strong> Triggers on mass kicking.</li>
        <li><strong>Channels:</strong> Triggers on mass channel creation/deletion.</li>
        <li><strong>Roles:</strong> Triggers on mass role creation/deletion/modification.</li>
        <li><strong>Webhooks:</strong> Triggers on webhook spam creation.</li>
      </ul>
      
      <div class="docs-callout callout-info">
          <strong>Tip:</strong> Use <code>/antinuke trust</code> to whitelist trusted admins (like yourself or bots) so they are ignored by the antinuke.
      </div>
    `
  },
  'antiraid': {
    category: 'Security', title: 'Anti-Raid',
    lead: 'Stop botting, mass joins, and raids before they happen.',
    content: `
      <h2>Raid Detection</h2>
      <p>Automatically lock down the server if too many accounts join simultaneously.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/antiraid threshold</code><span>Max joins per X seconds</span></div>
          <div class="cmd-row"><code>/antiraid action</code><span>Kick, Ban, or Lockdown channels</span></div>
      </div>
      
      <h2>Account Filtering</h2>
      <p>Prevent suspicious accounts from ever entering.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/antiraid accountage</code><span>Kick accounts younger than X days</span></div>
          <div class="cmd-row"><code>/antiraid avatarrequired</code><span>Kick members with default Discord avatars</span></div>
      </div>
      
      <h2>Manual Controls</h2>
      <p>If you're under attack, use <code>/antiraid state</code> to instantly lock everything down manually.</p>
    `
  },
  'automod': {
    category: 'Security', title: 'AutoMod',
    lead: 'Automated chat filtering and spam prevention.',
    content: `
      <h2>Rules & Filters</h2>
      <p>Fade's AutoMod operates on a rule-based system. Enable the rules you need:</p>
      <ul class="docs-ol">
        <li><strong>Anti-Spam:</strong> Prevents sending messages too fast.</li>
        <li><strong>Anti-Link:</strong> Deletes unauthorized links.</li>
        <li><strong>Anti-Invite:</strong> Deletes Discord server invites.</li>
        <li><strong>Anti-Caps:</strong> Deletes messages with excessive capital letters.</li>
        <li><strong>Anti-Ghostping:</strong> Alerts when someone pings and deletes.</li>
        <li><strong>Blacklist:</strong> Filters custom bad words and slurs.</li>
      </ul>
      
      <h2>Configuration</h2>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/automod rule</code><span>Enable a specific rule</span></div>
          <div class="cmd-row"><code>/automod punishment</code><span>Warn, Mute, Kick, or Ban violators</span></div>
          <div class="cmd-row"><code>/automod whitelist</code><span>Whitelist specific links (e.g. youtube.com)</span></div>
          <div class="cmd-row"><code>/automod ignorerole</code><span>Bypass AutoMod for certain roles</span></div>
      </div>
    `
  },
  'fake-permissions': {
    category: 'Security', title: 'Fake Permissions',
    lead: 'Grant moderation powers without risking your server.',
    content: `
      <h2>The Problem with Discord Permissions</h2>
      <p>If you give a moderator the native Discord "Ban Members" permission, they can ban anyone below them, anytime, bypassing your bot completely. This is a massive security risk.</p>
      
      <h2>The Solution</h2>
      <p>With Fade's Fake Permissions, you <strong>do not</strong> give the role native Discord permissions. Instead, you grant them permission <em>inside the bot</em>.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/fakeperms grant</code><span>Give a role permission to use Mod commands</span></div>
          <div class="cmd-row"><code>/fakeperms revoke</code><span>Remove permission from a role</span></div>
      </div>
      <p>Now, your mods can type <code>/ban</code> and Fade will execute the ban on their behalf. If their account gets hacked, the hacker cannot nuke the server via the Discord UI.</p>
    `
  },
  'moderation': {
    category: 'Moderation & Logs', title: 'Moderation',
    lead: 'Powerful, flexible moderation tools for your staff.',
    content: `
      <h2>Commands</h2>
      <p>All standard moderation commands support optional reasons and durations.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/ban &lt;user&gt; [reason] [duration]</code><span>Ban a user permanently or temporarily</span></div>
          <div class="cmd-row"><code>/kick &lt;user&gt; [reason]</code><span>Kick a user</span></div>
          <div class="cmd-row"><code>/mute &lt;user&gt; &lt;duration&gt;</code><span>Timeout a user</span></div>
          <div class="cmd-row"><code>/warn &lt;user&gt; &lt;reason&gt;</code><span>Issue a formal warning</span></div>
          <div class="cmd-row"><code>/purge &lt;amount&gt;</code><span>Bulk delete messages</span></div>
      </div>
      
      <h2>Case System</h2>
      <p>Every action generates a unique Case ID. You can review a user's entire history.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/modhistory &lt;user&gt;</code><span>View all past infractions</span></div>
          <div class="cmd-row"><code>/case &lt;id&gt;</code><span>Look up a specific case</span></div>
          <div class="cmd-row"><code>/reason &lt;id&gt; &lt;new reason&gt;</code><span>Update the reason for a past case</span></div>
      </div>
    `
  },
  'logging': {
    category: 'Moderation & Logs', title: 'Logging',
    lead: 'Keep track of everything happening in your server.',
    content: `
      <h2>Setup</h2>
      <p>You can send all logs to a single channel, or split them up by category.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/logs setall &lt;channel&gt;</code><span>Send EVERYTHING to one channel</span></div>
          <div class="cmd-row"><code>/logs set &lt;category&gt; &lt;channel&gt;</code><span>Route specific events</span></div>
      </div>
      
      <h2>Log Categories</h2>
      <ul class="docs-ol">
        <li><strong>Messages:</strong> Edits, deletes, bulk deletes.</li>
        <li><strong>Members:</strong> Joins, leaves, nickname changes, role updates.</li>
        <li><strong>Moderation:</strong> Bans, kicks, mutes, warnings.</li>
        <li><strong>Voice:</strong> Joins, leaves, moves, deafens.</li>
        <li><strong>Server:</strong> Channel changes, role changes, emoji updates.</li>
      </ul>
      
      <div class="docs-callout callout-tip">
          <strong>Tip:</strong> Use <code>/logs ignore</code> to stop logging actions in spam/private channels.
      </div>
    `
  },
  'welcome': {
    category: 'Configuration', title: 'Welcome & Goodbye',
    lead: 'Greet new members with beautiful, customizable messages and images.',
    content: `
      <h2>Interactive Builder</h2>
      <p>The easiest way to set up greetings is using the interactive builder inside Discord.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/welcome build</code><span>Opens the Welcome wizard</span></div>
          <div class="cmd-row"><code>/goodbye build</code><span>Opens the Goodbye wizard</span></div>
      </div>
      
      <h2>Styles</h2>
      <p>Fade offers two visual styles for welcome messages:</p>
      <ul class="docs-ol">
        <li><strong>Embed:</strong> A standard, clean Discord embed message.</li>
        <li><strong>Card:</strong> A high-quality image card with the user's avatar and name rendered onto it.</li>
      </ul>
      
      <h2>Auto-Roles</h2>
      <p>You can assign roles automatically when someone joins.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/welcome autorole &lt;role&gt;</code><span>Toggle giving this role on join</span></div>
      </div>
    `
  },
  'roles': {
    category: 'Configuration', title: 'Role Systems',
    lead: 'Automate role assignment through reactions, boosting, or vanity URLs.',
    content: `
      <h2>Reaction Roles</h2>
      <p>Allow users to self-assign roles by clicking buttons or select menus.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/reactionrole add</code><span>Attach a role button to a message</span></div>
          <div class="cmd-row"><code>/reactionrole remove</code><span>Remove a role from a message</span></div>
      </div>
      
      <h2>Booster Roles</h2>
      <p>Reward your Server Boosters by letting them create custom colored roles.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/boosterrole set</code><span>Set the base role hierarchy position</span></div>
          <div class="cmd-row"><code>/boosterrole create</code><span>(For Users) Create their custom role</span></div>
      </div>
      
      <h2>Vanity Roles & Server Tags</h2>
      <p>Reward users who advertise your server in their Discord Status or Username.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/vanity set &lt;keyword&gt;</code><span>Set the text to look for in statuses</span></div>
          <div class="cmd-row"><code>/servertag role</code><span>Reward users who put a tag in their username</span></div>
      </div>
    `
  },
  'starboard': {
    category: 'Configuration', title: 'Starboard',
    lead: 'Create a hall of fame for the best messages in your server.',
    content: `
      <h2>How it Works</h2>
      <p>When a message receives a certain number of reactions (like ⭐), it gets copied and immortalized in the starboard channel.</p>
      
      <h2>Configuration</h2>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/starboard setup</code><span>Set the channel and enable it</span></div>
          <div class="cmd-row"><code>/starboard threshold</code><span>Set the required reaction count</span></div>
          <div class="cmd-row"><code>/starboard emoji</code><span>Change from ⭐ to a custom emoji</span></div>
      </div>
      
      <h2>Clownboard</h2>
      <p>Fade also supports a secondary "Clownboard" (using 🤡 by default) for highlighting embarrassing or funny messages.</p>
    `
  },
  'tickets': {
    category: 'Configuration', title: 'Tickets',
    lead: 'Professional, private support channels for your members.',
    content: `
      <h2>Creating a Panel</h2>
      <p>A Ticket Panel is a message with buttons that users click to open a private channel with staff.</p>
      <ol class="docs-ol">
        <li>Create the panel: <code>/ticket create &lt;name&gt;</code></li>
        <li>Add a category button: <code>/ticket addtype</code></li>
        <li>Post it to a channel: <code>/ticket post</code></li>
      </ol>
      
      <h2>Forms & Modals</h2>
      <p>You can require users to answer questions <em>before</em> the ticket opens.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/ticket add &lt;panel&gt; &lt;type&gt;</code><span>Add a text input field to the ticket modal</span></div>
      </div>
    `
  },
  'tempvoice': {
    category: 'Configuration', title: 'TempVoice',
    lead: 'Join-To-Create dynamic voice channels.',
    content: `
      <h2>Setup</h2>
      <p>Run <code>/tempvoice setup</code> and select a voice channel. Whenever someone joins that channel, Fade instantly creates a private voice channel just for them, and deletes it when everyone leaves.</p>
      
      <h2>Voice Controls</h2>
      <p>The channel owner gets full control over their temporary channel:</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/vc name</code><span>Rename the channel</span></div>
          <div class="cmd-row"><code>/vc lock</code><span>Lock the channel from new joins</span></div>
          <div class="cmd-row"><code>/vc limit</code><span>Set max users</span></div>
          <div class="cmd-row"><code>/vc kick</code><span>Kick someone from the channel</span></div>
      </div>
      <p>You can also run <code>/tempvoice interface</code> to spawn a click-button control panel for users to manage their channels without typing commands.</p>
    `
  },
  'messages': {
    category: 'Configuration', title: 'Messages & Triggers',
    lead: 'Automate chat responses, sticky messages, and timers.',
    content: `
      <h2>Sticky Messages</h2>
      <p>A message that always stays at the bottom of a channel.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/sticky set</code><span>Create a sticky message</span></div>
      </div>
      
      <h2>Auto Responders</h2>
      <p>Make Fade reply to specific words or phrases.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/responder add &lt;trigger&gt; &lt;reply&gt;</code><span>Create a text responder</span></div>
      </div>
      
      <h2>Reaction Triggers</h2>
      <p>Make Fade react with an emoji to specific words.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/reactiontrigger add &lt;word&gt; &lt;emoji&gt;</code><span>Create a reaction trigger</span></div>
      </div>
      
      <h2>Auto Timers</h2>
      <p>Send a scheduled message repeatedly.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/timer add &lt;channel&gt; &lt;interval&gt;</code><span>Create a looping message</span></div>
      </div>
    `
  },
  'leveling': {
    category: 'Engagement', title: 'Leveling',
    lead: 'Reward active chatters with XP and roles.',
    content: `
      <h2>XP System</h2>
      <p>Users gain XP for sending messages. Voice chat XP is also tracked.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/levelconfig toggle</code><span>Enable the system</span></div>
          <div class="cmd-row"><code>/levelconfig xprate</code><span>Change how much XP is given per message</span></div>
          <div class="cmd-row"><code>/rank</code><span>Check your current level</span></div>
          <div class="cmd-row"><code>/leaderboard</code><span>View the server's top chatters</span></div>
      </div>
      
      <h2>Level Rewards</h2>
      <p>Automatically give roles when members reach specific levels.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/levelrewards add &lt;level&gt; &lt;role&gt;</code><span>Add a reward role</span></div>
      </div>
    `
  },
  'economy': {
    category: 'Engagement', title: 'Economy',
    lead: 'A global virtual economy with jobs, gambling, and items.',
    content: `
      <h2>Basics</h2>
      <p>Users earn coins by claiming dailies, working, or gambling. Coins are stored in a global wallet (meaning their balance carries over across all servers sharing Fade).</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/balance</code><span>Check wallet and bank</span></div>
          <div class="cmd-row"><code>/daily</code><span>Claim daily rewards</span></div>
          <div class="cmd-row"><code>/work</code><span>Work a job for coins</span></div>
      </div>
      
      <h2>Gambling & Crime</h2>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/gamble</code><span>Bet on a 50/50 roll</span></div>
          <div class="cmd-row"><code>/slots</code><span>Spin the slot machine</span></div>
          <div class="cmd-row"><code>/coinflip</code><span>Flip a coin</span></div>
          <div class="cmd-row"><code>/rob &lt;user&gt;</code><span>Attempt to steal from another user's wallet</span></div>
      </div>
      
      <div class="docs-callout callout-info">
          <strong>Tip:</strong> Users should use <code>/deposit</code> to move coins to their Bank, protecting them from robbers!
      </div>
    `
  },
  'giveaways': {
    category: 'Engagement', title: 'Giveaways',
    lead: 'Host events and give away prizes with ease.',
    content: `
      <h2>Hosting</h2>
      <p>Start a giveaway interactively.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/giveaway start</code><span>Interactive menu to start a giveaway</span></div>
          <div class="cmd-row"><code>/giveaway end</code><span>End early and pick winners now</span></div>
          <div class="cmd-row"><code>/giveaway reroll</code><span>Pick a new winner for an ended giveaway</span></div>
      </div>
      
      <h2>Requirements</h2>
      <p>You can restrict who can enter a giveaway.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/giveaway minlevel</code><span>Require a minimum level (requires Leveling)</span></div>
          <div class="cmd-row"><code>/giveaway requiredroles</code><span>Require specific roles to enter</span></div>
      </div>
    `
  },
  'bump-reminder': {
    category: 'Engagement', title: 'Bump Reminder',
    lead: 'Never miss a Disboard bump again.',
    content: `
      <h2>How it Works</h2>
      <p>Fade automatically detects when someone uses <code>/bump</code> via the Disboard bot. It waits exactly 2 hours, then pings your server to remind them to bump again.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/bumpreminder setup</code><span>Set the channel and role to ping</span></div>
          <div class="cmd-row"><code>/bumpreminder message</code><span>Customize the reminder text</span></div>
      </div>
    `
  },
  'counters': {
    category: 'Engagement', title: 'Counters',
    lead: 'Display live server statistics in voice channel names.',
    content: `
      <h2>Creating Counters</h2>
      <p>Counters automatically update every few minutes to reflect the current state of your server.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/counter create &lt;type&gt; &lt;name format&gt;</code><span>Create a new stat channel</span></div>
      </div>
      
      <h2>Available Types</h2>
      <ul class="docs-ol">
        <li><strong>Members:</strong> Total member count (including bots).</li>
        <li><strong>Humans:</strong> Total human count.</li>
        <li><strong>Bots:</strong> Total bot count.</li>
        <li><strong>Online:</strong> Total members currently online.</li>
      </ul>
    `
  },
  'stats': {
    category: 'Engagement', title: 'Activity Stats & Invites',
    lead: 'Track server activity, message counts, voice time, and invites with beautiful canvas cards.',
    content: `
      <h2>Overview</h2>
      <p>Fade tracks user activity (messages sent, voice time) and invites securely. Generate beautiful data visualizations using prefix commands.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>f!serverstats</code><span>Display a global dashboard of server activity</span></div>
          <div class="cmd-row"><code>f!messages [user]</code><span>Check your message count</span></div>
          <div class="cmd-row"><code>f!voicestats [user]</code><span>Check your voice chat time</span></div>
          <div class="cmd-row"><code>f!channelstats</code><span>View activity metrics for the current channel</span></div>
      </div>
      
      <h2>Leaderboards</h2>
      <p>Compete with other members for the top spots in your server.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>f!msglb</code><span>Message count leaderboard</span></div>
          <div class="cmd-row"><code>f!vclb</code><span>Voice time leaderboard</span></div>
          <div class="cmd-row"><code>f!invitelb</code><span>Top inviters leaderboard</span></div>
      </div>

      <h2>Invite Tracking</h2>
      <p>Fade tracks who invites whom, along with fake and left accounts.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>f!invites [user]</code><span>Check how many people you've invited</span></div>
          <div class="cmd-row"><code>f!inviter [user]</code><span>Check who invited a specific user</span></div>
          <div class="cmd-row"><code>f!invited [user]</code><span>List all users you have invited</span></div>
      </div>
      
      <div class="docs-callout callout-info">
          <strong>Tip:</strong> Server administrators can use <code>f!managestats</code> to blacklist specific channels (like staff chats or spam channels) from being tracked in activity stats.
      </div>
    `
  },
  'utility': {
    category: 'Utility & Fun', title: 'Utility',
    lead: 'Handy tools for daily server life.',
    content: `
      <h2>Sniping</h2>
      <p>Retrieve deleted or edited messages instantly.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/snipe</code><span>View the last deleted message</span></div>
          <div class="cmd-row"><code>/editsnipe</code><span>View the original text of an edited message</span></div>
      </div>
      
      <h2>Birthdays</h2>
      <p>Let users set their birthday and celebrate them automatically.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/birthday set</code><span>Set your birthday</span></div>
          <div class="cmd-row"><code>/birthday channel</code><span>Set where announcements go</span></div>
          <div class="cmd-row"><code>/birthday role</code><span>Role given for 24 hours</span></div>
      </div>
      
      <h2>Reminders & AFK</h2>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/remind set &lt;time&gt; &lt;reason&gt;</code><span>Set a personal reminder</span></div>
          <div class="cmd-row"><code>/afk &lt;status&gt;</code><span>Sets you to AFK. Fade will notify anyone who pings you.</span></div>
      </div>
    `
  },
  'music': {
    category: 'Utility & Fun', title: 'Music',
    lead: 'High-quality, lag-free music streaming for voice channels.',
    content: `
      <h2>Playback</h2>
      <p>Fade supports streaming from all major sources.</p>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/play &lt;query or URL&gt;</code><span>Add a song to the queue</span></div>
          <div class="cmd-row"><code>/skip</code><span>Skip the current track</span></div>
          <div class="cmd-row"><code>/queue</code><span>View upcoming songs</span></div>
          <div class="cmd-row"><code>/nowplaying</code><span>See track progress</span></div>
      </div>
      
      <h2>Advanced Features</h2>
      <div class="docs-cmd-block">
          <div class="cmd-row"><code>/filter</code><span>Apply 8D, Bassboost, Nightcore, etc.</span></div>
          <div class="cmd-row"><code>/lyrics</code><span>Pull lyrics for the current song</span></div>
          <div class="cmd-row"><code>/247</code><span>Keep the bot in VC permanently</span></div>
      </div>
    `
  }
};

let mainContentHtml = '';
flatItems.forEach((item, index) => {
  const data = sectionsData[item.id];
  if (!data) return;
  
  const isHidden = item.id === 'introduction' ? '' : ' hidden';
  const prev = index > 0 ? flatItems[index - 1] : null;
  const next = index < flatItems.length - 1 ? flatItems[index + 1] : null;
  
  mainContentHtml += `
<section class="docs-section${isHidden}" id="${item.id}">
    <div class="docs-breadcrumb">${data.category}</div>
    <h1 class="docs-title">${data.title}</h1>
    <p class="docs-lead">${data.lead}</p>
    
    ${data.content}
    
    <div class="docs-nav-footer">
        ${prev ? `<button class="docs-nav-btn" onclick="navigate('${prev.id}')">← ${prev.name}</button>` : `<div></div>`}
        ${next ? `<button class="docs-nav-btn" onclick="navigate('${next.id}')">${next.name} →</button>` : `<div></div>`}
    </div>
</section>
`;
});

// Update the HTML File
// Replace sidebar
currentHtml = currentHtml.replace(
  /<aside class="docs-sidebar" id="sidebar">[\s\S]*?<\/aside>/,
  `<aside class="docs-sidebar" id="sidebar">\n    <div class="sidebar-search">\n        <input type="text" placeholder="Search docs..." id="sidebarSearch" autocomplete="off">\n    </div>\n${sidebarHtml}</aside>`
);

// Replace main content
currentHtml = currentHtml.replace(
  /<main class="docs-main" id="docsMain">[\s\S]*?<\/main>/,
  `<main class="docs-main" id="docsMain">\n${mainContentHtml}</main>`
);

// Fix the `.grain` bug identified by researcher 
currentHtml = currentHtml.replace(/<div class="grain">[\s\S]*?<nav class="docs-header-nav"/, '<div class="grain"></div>\n    <nav class="docs-header-nav"');

fs.writeFileSync(docsHtmlPath, currentHtml);
console.log('Successfully rebuilt docs.html!');

// src/commands/fun/ship.ts
import {
    SlashCommandBuilder,
    AttachmentBuilder,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendMessage, FadeContainer, fadeReply } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';

function calculateShip(id1: string, id2: string): number {
    const ids = [id1, id2].sort();
    const date = new Date().toISOString().split('T')[0];
    const hash = [...(ids.join('') + date)].reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (hash * 13) % 101;
}

export default {
    data: new SlashCommandBuilder()
        .setName('ship')
        .setDescription('Calculate the romantic compatibility between two users')
        .addUserOption(o => o
            .setName('user1')
            .setDescription('First user')
            .setRequired(false)
        )
        .addUserOption(o => o
            .setName('user2')
            .setDescription('Second user')
            .setRequired(false)
        ),

    category:  'fun',
    guildOnly: true,
    cooldown:  5,

    async execute(interaction, client) {
        await interaction.deferReply();
        let user1 = interaction.options.getUser('user1');
        let user2 = interaction.options.getUser('user2');

        if (!user1 && !user2) {
            user1 = interaction.user;
            const members = interaction.guild?.members.cache.filter(m => !m.user.bot && m.user.id !== user1!.id);
            user2 = members && members.size > 0 ? members.random()!.user : interaction.user;
        } else if (user1 && !user2) {
            user2 = user1;
            user1 = interaction.user;
        }

        const percentage = calculateShip(user1!.id, user2!.id);
        const buffer = await generateShipCanvas(user1, user2, percentage);
        const attachment = new AttachmentBuilder(buffer, { name: 'ship.png' });

        let emoji = '💔';
        if (percentage >= 50) emoji = '💖';
        if (percentage >= 80) emoji = '🔥';

        const card = new FadeContainer(null)
            .text(`## ${emoji} Ship Compatibility\n**${user1!.username}** x **${user2!.username}**\n-# **${percentage}%** Match`)
            .gallery([{ url: 'attachment://ship.png' }])
            .build();

        await interaction.editReply({
            ...(fadeReply([card], false) as any),
            files: [attachment],
        });
    },

    async prefixExecute(message, args, client) {
        let user1 = message.author;
        let user2 = message.author;

        if (args.length === 0) {
            const members = message.guild?.members.cache.filter(m => !m.user.bot && m.user.id !== message.author.id);
            if (members && members.size > 0) {
                user2 = members.random()!.user;
            }
        } else if (args.length === 1) {
            const id1 = args[0].replace(/[<@!>]/g, '');
            const fetched = await client.users.fetch(id1).catch(() => null);
            if (fetched) {
                user1 = message.author;
                user2 = fetched;
            }
        } else if (args.length >= 2) {
            const id1 = args[0].replace(/[<@!>]/g, '');
            const id2 = args[1].replace(/[<@!>]/g, '');
            const f1 = await client.users.fetch(id1).catch(() => null);
            const f2 = await client.users.fetch(id2).catch(() => null);
            if (f1) user1 = f1;
            if (f2) user2 = f2;
        }

        const percentage = calculateShip(user1.id, user2.id);
        const buffer = await generateShipCanvas(user1, user2, percentage);
        const attachment = new AttachmentBuilder(buffer, { name: 'ship.png' });

        let emoji = '💔';
        if (percentage >= 50) emoji = '💖';
        if (percentage >= 80) emoji = '🔥';

        const card = new FadeContainer(null)
            .text(`## ${emoji} Ship Compatibility\n**${user1.username}** x **${user2.username}**\n-# **${percentage}%** Match`)
            .gallery([{ url: 'attachment://ship.png' }])
            .build();

        await message.reply({
            components: [card],
            flags: MessageFlags.IsComponentsV2,
            files: [attachment],
            allowedMentions: { parse: [] }
        } as any);
    },
} satisfies Command;

async function generateShipCanvas(user1: any, user2: any, percentage: number): Promise<Buffer> {
    const canvas = createCanvas(700, 300);
    const ctx = canvas.getContext('2d');

    // 1. Background (Sleek dark gradient)
    const gradient = ctx.createLinearGradient(0, 0, 700, 300);
    gradient.addColorStop(0, '#111114');
    gradient.addColorStop(1, '#1e1e24');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 700, 300);

    // Subtle glow in the middle based on percentage
    const glow = ctx.createRadialGradient(350, 150, 0, 350, 150, 300);
    if (percentage >= 50) {
        glow.addColorStop(0, 'rgba(255, 105, 180, 0.2)'); // Pink glow
    } else {
        glow.addColorStop(0, 'rgba(100, 100, 100, 0.2)'); // Sad gray glow
    }
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 700, 300);

    // 2. Load avatars
    const av1Url = user1.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    const av2Url = user2.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });

    const img1 = await loadImage(av1Url).catch(() => null);
    const img2 = await loadImage(av2Url).catch(() => null);

    // 3. Draw middle connection line
    ctx.beginPath();
    if (percentage >= 50) {
        ctx.strokeStyle = '#ff69b4'; // Solid pink
    } else {
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = '#555555'; // Dashed gray
    }
    ctx.lineWidth = 6;
    ctx.moveTo(250, 150);
    ctx.lineTo(450, 150);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Draw Avatars with circular clipping
    const drawAvatar = (img: any, x: number, y: number, size: number) => {
        if (!img) return;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(img, x, y, size, size);
        
        ctx.restore();

        // Draw a ring around the avatar
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
        ctx.strokeStyle = percentage >= 50 ? '#ff69b4' : '#555555';
        ctx.lineWidth = 6;
        ctx.stroke();
    };

    drawAvatar(img1, 50, 50, 200);
    drawAvatar(img2, 450, 50, 200);

    return canvas.toBuffer('image/png');
}

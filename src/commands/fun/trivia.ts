// src/commands/fun/trivia.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendResponse, sendMessage, updateResponse, FadeContainer, btn, ButtonStyle } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import type { MessageComponentInteraction } from 'discord.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TriviaQuestion {
    question:          string;
    correct_answer:    string;
    incorrect_answers: string[];
    category:          string;
    difficulty:        string;
}

interface TriviaGame {
    question:  string;
    answers:   string[];   // shuffled, index 0-3
    correct:   number;     // index of correct answer
    category:  string;
    difficulty: string;
    userId:    string;
    done:      boolean;
}

export const triviaGames = new Map<string, TriviaGame>();

const LABELS = ['A', 'B', 'C', 'D'];

// ── Fetch question from Open Trivia DB ────────────────────────────────────────

async function fetchQuestion(): Promise<TriviaQuestion | null> {
    try {
        const res  = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
        const data = await res.json() as { response_code: number; results: TriviaQuestion[] };
        if (data.response_code !== 0 || !data.results.length) return null;
        return data.results[0];
    } catch {
        return null;
    }
}

function decodeHtml(str: string): string {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"');
}

// ── Build card ────────────────────────────────────────────────────────────────

function buildTriviaCard(game: TriviaGame, result?: { correct: boolean; chosen: number }): import('discord.js').ContainerBuilder {
    const colour = !result
        ? Colours.NONE
        : result.correct ? Colours.SUCCESS : Colours.DANGER;

    let answerLines = game.answers
        .map((a, i) => {
            if (!result) return `**${LABELS[i]}.** ${a}`;
            if (i === game.correct) return `**${LABELS[i]}.** ${a} ${e('success')}`;
            if (i === result.chosen && !result.correct) return `**${LABELS[i]}.** ${a} ${e('error')}`;
            return `**${LABELS[i]}.** ${a}`;
        })
        .join('\n');

    let status = '';
    if (result) {
        status = result.correct
            ? `\n\n${e('success')} **Correct!**`
            : `\n\n${e('error')} **Wrong!** The answer was **${LABELS[game.correct]}**.`;
    }

    return new FadeContainer(colour)
        .text(
            `🧠 **Trivia** · ${game.category}\n` +
            `-# ${game.difficulty.charAt(0).toUpperCase() + game.difficulty.slice(1)}\n\n` +
            `${game.question}\n\n` +
            answerLines +
            status
        )
        .build();
}

function answerButtons(userId: string, disabled = false) {
    return LABELS.map((label, i) =>
        btn(`trivia_${i}_${userId}`, label, ButtonStyle.Secondary, disabled)
    );
}

// ── Start game ────────────────────────────────────────────────────────────────

async function startTrivia(userId: string): Promise<TriviaGame | null> {
    const q = await fetchQuestion();
    if (!q) return null;

    const all     = [q.correct_answer, ...q.incorrect_answers].map(decodeHtml);
    const shuffled = all.sort(() => Math.random() - 0.5);
    const correct  = shuffled.indexOf(decodeHtml(q.correct_answer));

    const game: TriviaGame = {
        question:   decodeHtml(q.question),
        answers:    shuffled,
        correct,
        category:   decodeHtml(q.category),
        difficulty: q.difficulty,
        userId,
        done: false,
    };
    triviaGames.set(userId, game);

    // Cleanup after 60 seconds to prevent memory leaks
    setTimeout(() => {
        const activeGame = triviaGames.get(userId);
        if (activeGame && activeGame === game && !activeGame.done) {
            triviaGames.delete(userId);
        }
    }, 60000);

    return game;
}

// ── Command ───────────────────────────────────────────────────────────────────

export default {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Answer a random trivia question'),

    category: 'fun',
    cooldown: 5,

    async execute(interaction) {
        await interaction.deferReply();
        const userId = interaction.user.id;
        const game   = await startTrivia(userId);

        if (!game) {
            await interaction.editReply({ content: `${e('error')} Could not fetch a trivia question. Try again later.` });
            return;
        }

        const card    = buildTriviaCard(game);
        const buttons = new FadeContainer(Colours.FADE).actionRow(...answerButtons(userId)).build();

        await interaction.editReply({
            components: [card, buttons],
            flags: 1 << 15,
        } as any);
    },

    async prefixExecute(message) {
        const userId = message.author.id;
        const game   = await startTrivia(userId);

        if (!game) {
            await message.reply(`${e('error')} Could not fetch a trivia question. Try again later.`);
            return;
        }

        const card    = buildTriviaCard(game);
        const buttons = new FadeContainer(Colours.FADE).actionRow(...answerButtons(userId)).build();

        await message.reply({
            components: [card, buttons],
            flags: 1 << 15,
            allowedMentions: { repliedUser: false },
        } as any);
    },

    aliases: ['quiz'],
} satisfies Command;

// ── Button handler ────────────────────────────────────────────────────────────

export async function handleTriviaButton(interaction: MessageComponentInteraction): Promise<void> {
    const parts = interaction.customId.split('_');
    const chosenStr = parts[1];
    const ownerId = parts[2];

    if (interaction.user.id !== ownerId) {
        await interaction.reply({ content: `${e('error')} This is not your trivia game!`, flags: 64 });
        return;
    }

    const userId = interaction.user.id;
    const game   = triviaGames.get(userId);

    if (!game || game.done) {
        await interaction.reply({ content: `${e('error')} No active trivia game. Use \`/trivia\` to start one.`, flags: 64 });
        return;
    }

    const chosen = parseInt(chosenStr, 10);
    if (isNaN(chosen) || chosen < 0 || chosen > 3) return;

    game.done = true;
    triviaGames.delete(userId);

    const correct = chosen === game.correct;
    const card    = buildTriviaCard(game, { correct, chosen });
    const disabled = new FadeContainer(Colours.FADE).actionRow(...answerButtons(userId, true)).build();

    try {
        await updateResponse(interaction, [card, disabled]);
    } catch (err: any) {
        if (err.code !== 10062) {
            throw err;
        }
    }
}

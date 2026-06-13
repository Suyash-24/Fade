// src/commands/fun/blackjack.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendResponse, sendMessage, updateResponse, FadeContainer, btn, ButtonStyle } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import type { MessageComponentInteraction } from 'discord.js';

// ── Card types ────────────────────────────────────────────────────────────────

type Card = { suit: string; rank: string; value: number };

const SUITS  = ['♠', '♥', '♦', '♣'];
const RANKS  = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const VALUES: Record<string, number> = {
    A: 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, J: 10, Q: 10, K: 10,
};

function makeDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS)
        for (const rank of RANKS)
            deck.push({ suit, rank, value: VALUES[rank] });
    return deck.sort(() => Math.random() - 0.5);
}

function handValue(hand: Card[]): number {
    let total = hand.reduce((s, c) => s + c.value, 0);
    let aces  = hand.filter(c => c.rank === 'A').length;
    while (total > 21 && aces-- > 0) total -= 10;
    return total;
}

function handStr(hand: Card[], hideSecond = false): string {
    return hand
        .map((c, i) => (hideSecond && i === 1 ? '🂠' : `${c.rank}${c.suit}`))
        .join('  ');
}

// ── In-memory game state ──────────────────────────────────────────────────────

export interface BJGame {
    deck:    Card[];
    player:  Card[];
    dealer:  Card[];
    userId:  string;
    done:    boolean;
}

export const bjGames = new Map<string, BJGame>();

// ── Build the game card ───────────────────────────────────────────────────────

export function buildBJCard(game: BJGame, result?: string): import('discord.js').ContainerBuilder {
    const pv = handValue(game.player);
    const dv = handValue(game.dealer);

    const colour = !result
        ? Colours.FADE
        : result === 'win' || result === 'blackjack'
            ? Colours.SUCCESS
            : result === 'push'
                ? Colours.WARNING
                : Colours.DANGER;

    let status = '';
    if (result === 'blackjack') status = `\n${e('star')} **Blackjack!** You win!`;
    else if (result === 'win')  status = `\n${e('success')} **You win!**`;
    else if (result === 'bust') status = `\n${e('error')} **Bust!** You went over 21.`;
    else if (result === 'lose') status = `\n${e('error')} **Dealer wins.**`;
    else if (result === 'push') status = `\n${e('warn')} **Push.** It's a tie.`;

    const dealerHand = game.done ? handStr(game.dealer) : handStr(game.dealer, true);
    const dealerVal  = game.done ? ` (${dv})` : '';

    return new FadeContainer(colour)
        .text(
            `🃏 **Blackjack**\n` +
            `\n**Dealer:** ${dealerHand}${dealerVal}` +
            `\n**You:** ${handStr(game.player)} (${pv})` +
            status
        )
        .build();
}

// ── Slash / prefix logic ──────────────────────────────────────────────────────

function startGame(userId: string): BJGame {
    const deck   = makeDeck();
    const player = [deck.pop()!, deck.pop()!];
    const dealer = [deck.pop()!, deck.pop()!];
    const game: BJGame = { deck, player, dealer, userId, done: false };
    bjGames.set(userId, game);
    return game;
}

function gameButtons(disabled = false) {
    return [
        btn('bj_hit',    'Hit',    ButtonStyle.Primary,   disabled),
        btn('bj_stand',  'Stand',  ButtonStyle.Secondary, disabled),
        btn('bj_double', 'Double', ButtonStyle.Success,   disabled),
    ];
}

export default {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Play a game of blackjack'),

    category: 'fun',
    cooldown: 5,

    async execute(interaction) {
        const userId = interaction.user.id;
        const game   = startGame(userId);
        const pv     = handValue(game.player);

        // Instant blackjack
        if (pv === 21) {
            game.done = true;
            bjGames.delete(userId);
            const card = buildBJCard(game, 'blackjack');
            await sendResponse(interaction, [card]);
            return;
        }

        const card = buildBJCard(game);
        const container = new FadeContainer(Colours.FADE)
            .actionRow(...gameButtons())
            .build();

        await interaction.reply({
            components: [card, container],
            flags: 64 | (1 << 15), // IsComponentsV2
        } as any);
    },

    async prefixExecute(message) {
        const userId = message.author.id;
        const game   = startGame(userId);
        const pv     = handValue(game.player);

        if (pv === 21) {
            game.done = true;
            bjGames.delete(userId);
            const card = buildBJCard(game, 'blackjack');
            await sendMessage(message, [card]);
            return;
        }

        const card = buildBJCard(game);
        const container = new FadeContainer(Colours.FADE)
            .actionRow(...gameButtons())
            .build();

        await message.reply({
            components: [card, container],
            flags: 1 << 15,
            allowedMentions: { repliedUser: false },
        } as any);
    },

    aliases: ['bj'],
} satisfies Command;

// ── Button handler (called from interactioncreate.ts) ─────────────────────────

export async function handleBJButton(interaction: MessageComponentInteraction): Promise<void> {
    const userId = interaction.user.id;
    const game   = bjGames.get(userId);

    if (!game || game.done) {
        await interaction.reply({ content: `${e('error')} No active blackjack game. Use \`/blackjack\` to start one.`, flags: 64 });
        return;
    }

    const id = interaction.customId;

    if (id === 'bj_hit' || id === 'bj_double') {
        game.player.push(game.deck.pop()!);
        const pv = handValue(game.player);

        if (id === 'bj_double') {
            // After doubling, stand immediately
            await resolveDealer(interaction, game, userId);
            return;
        }

        if (pv > 21) {
            game.done = true;
            bjGames.delete(userId);
            const card = buildBJCard(game, 'bust');
            const disabledRow = new FadeContainer(Colours.FADE).actionRow(...gameButtons(true)).build();
            await updateResponse(interaction, [card, disabledRow]);
            return;
        }

        if (pv === 21) {
            await resolveDealer(interaction, game, userId);
            return;
        }

        const card = buildBJCard(game);
        const container = new FadeContainer(Colours.FADE).actionRow(...gameButtons()).build();
        await updateResponse(interaction, [card, container]);
        return;
    }

    if (id === 'bj_stand') {
        await resolveDealer(interaction, game, userId);
    }
}

async function resolveDealer(interaction: MessageComponentInteraction, game: BJGame, userId: string): Promise<void> {
    // Dealer draws to 17
    while (handValue(game.dealer) < 17) {
        game.dealer.push(game.deck.pop()!);
    }

    const pv = handValue(game.player);
    const dv = handValue(game.dealer);

    let result: string;
    if (dv > 21 || pv > dv)      result = 'win';
    else if (pv === dv)           result = 'push';
    else                          result = 'lose';

    game.done = true;
    bjGames.delete(userId);

    const card = buildBJCard(game, result);
    const disabledRow = new FadeContainer(Colours.FADE).actionRow(...gameButtons(true)).build();
    await updateResponse(interaction, [card, disabledRow]);
}

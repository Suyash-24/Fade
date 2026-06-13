// src/db/queries/economy.ts
// All database operations for Fade's economy system.
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../index.js';
import {
    economyConfig,
    economyWallets,
    economyTransactions,
    economyShop,
    economyPurchases,
} from '../schema.js';
import { ensureGuild } from './guilds.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type EconomyConfig    = typeof economyConfig.$inferSelect;
export type EconomyWallet    = typeof economyWallets.$inferSelect;
export type EconomyShopItem  = typeof economyShop.$inferSelect;
export type EconomyPurchase  = typeof economyPurchases.$inferSelect & { item: EconomyShopItem };

// ── Config ────────────────────────────────────────────────────────────────────

export async function getEconomyConfig(guildId: string): Promise<EconomyConfig> {
    await ensureGuild(guildId);
    let config = await db.query.economyConfig.findFirst({
        where: eq(economyConfig.guildId, guildId),
    });
    if (!config) {
        [config] = await db.insert(economyConfig)
            .values({ guildId })
            .returning();
    }
    return config;
}

export async function updateEconomyConfig(
    guildId: string,
    values: Partial<typeof economyConfig.$inferInsert>,
) {
    await db.insert(economyConfig)
        .values({ guildId, ...values })
        .onConflictDoUpdate({
            target: economyConfig.guildId,
            set:    { ...values, updatedAt: new Date() },
        });
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export async function getWallet(guildId: string, userId: string): Promise<EconomyWallet> {
    await ensureGuild(guildId);
    let wallet = await db.query.economyWallets.findFirst({
        where: and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, userId)),
    });
    if (!wallet) {
        [wallet] = await db.insert(economyWallets)
            .values({ guildId, userId })
            .returning();
    }
    return wallet;
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function addTransaction(
    guildId: string,
    userId:  string,
    type:    string,
    amount:  number,
    note?:   string,
) {
    await db.insert(economyTransactions).values({ guildId, userId, type, amount, note });
}

// ── Balance operations ────────────────────────────────────────────────────────

// Adjust wallet balance (positive = add, negative = subtract). Records transaction.
export async function adjustBalance(
    guildId: string,
    userId:  string,
    amount:  number,
    type:    string,
    note?:   string,
): Promise<EconomyWallet> {
    const wallet = await getWallet(guildId, userId);
    const newBalance  = Math.max(0, wallet.balance + amount);
    const newEarned   = amount > 0 ? wallet.totalEarned + amount : wallet.totalEarned;

    const [updated] = await db.update(economyWallets)
        .set({ balance: newBalance, totalEarned: newEarned, updatedAt: new Date() })
        .where(and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, userId)))
        .returning();

    await addTransaction(guildId, userId, type, amount, note);
    return updated;
}

// Deposit balance → bank
export async function deposit(
    guildId: string,
    userId:  string,
    amount:  number,   // pass Infinity for "all"
): Promise<{ deposited: number; wallet: EconomyWallet }> {
    const wallet    = await getWallet(guildId, userId);
    const deposited = amount === Infinity ? wallet.balance : Math.min(amount, wallet.balance);
    if (deposited <= 0) return { deposited: 0, wallet };

    const [updated] = await db.update(economyWallets)
        .set({
            balance:   wallet.balance - deposited,
            bank:      wallet.bank + deposited,
            updatedAt: new Date(),
        })
        .where(and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, userId)))
        .returning();

    await addTransaction(guildId, userId, 'deposit', -deposited, `Deposited to bank`);
    return { deposited, wallet: updated };
}

// Withdraw bank → balance
export async function withdraw(
    guildId: string,
    userId:  string,
    amount:  number,   // pass Infinity for "all"
): Promise<{ withdrawn: number; wallet: EconomyWallet }> {
    const wallet    = await getWallet(guildId, userId);
    const withdrawn = amount === Infinity ? wallet.bank : Math.min(amount, wallet.bank);
    if (withdrawn <= 0) return { withdrawn: 0, wallet };

    const [updated] = await db.update(economyWallets)
        .set({
            bank:      wallet.bank - withdrawn,
            balance:   wallet.balance + withdrawn,
            updatedAt: new Date(),
        })
        .where(and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, userId)))
        .returning();

    await addTransaction(guildId, userId, 'withdraw', withdrawn, `Withdrew from bank`);
    return { withdrawn, wallet: updated };
}

// Transfer coins between users (wallet → wallet)
export async function transfer(
    guildId:  string,
    fromId:   string,
    toId:     string,
    amount:   number,
): Promise<{ from: EconomyWallet; to: EconomyWallet }> {
    const from = await getWallet(guildId, fromId);
    if (from.balance < amount) throw new Error('Insufficient balance');

    const [fromUpdated] = await db.update(economyWallets)
        .set({ balance: from.balance - amount, updatedAt: new Date() })
        .where(and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, fromId)))
        .returning();

    const to = await getWallet(guildId, toId);
    const [toUpdated] = await db.update(economyWallets)
        .set({ balance: to.balance + amount, totalEarned: to.totalEarned + amount, updatedAt: new Date() })
        .where(and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, toId)))
        .returning();

    await addTransaction(guildId, fromId, 'transfer', -amount, `Sent to <@${toId}>`);
    await addTransaction(guildId, toId,   'transfer',  amount, `Received from <@${fromId}>`);

    return { from: fromUpdated, to: toUpdated };
}

// ── Daily ─────────────────────────────────────────────────────────────────────

export interface DailyResult {
    amount:     number;
    streak:     number;
    nextStreak: number;
    wallet:     EconomyWallet;
    msUntilNext: number;
}

export async function claimDaily(
    guildId: string,
    userId:  string,
    config:  EconomyConfig,
): Promise<DailyResult | { cooldown: true; msRemaining: number }> {
    const wallet = await getWallet(guildId, userId);
    const now    = new Date();

    if (wallet.lastDaily) {
        const msSince = now.getTime() - wallet.lastDaily.getTime();
        const COOLDOWN_MS = 24 * 60 * 60 * 1000;
        if (msSince < COOLDOWN_MS) {
            return { cooldown: true, msRemaining: COOLDOWN_MS - msSince };
        }
    }

    // Streak logic: reset if > 48h gap
    const msSince48 = wallet.lastDaily
        ? now.getTime() - wallet.lastDaily.getTime()
        : Infinity;
    const STREAK_EXPIRE_MS = 48 * 60 * 60 * 1000;
    const newStreak = (msSince48 <= STREAK_EXPIRE_MS && wallet.dailyStreak > 0)
        ? wallet.dailyStreak + 1
        : 1;

    // Streak bonus tiers
    let amount = config.dailyAmount;
    if (config.streakBonus) {
        if      (newStreak >= 30) amount = 3000;
        else if (newStreak >= 14) amount = Math.round(config.dailyAmount * newStreak);
        else if (newStreak >= 7)  amount = Math.round(config.dailyAmount * newStreak);
        else                      amount = config.dailyAmount * newStreak;
    }

    const [updated] = await db.update(economyWallets)
        .set({
            balance:     wallet.balance + amount,
            totalEarned: wallet.totalEarned + amount,
            lastDaily:   now,
            dailyStreak: newStreak,
            updatedAt:   now,
        })
        .where(and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, userId)))
        .returning();

    await addTransaction(guildId, userId, 'daily', amount, `Daily reward (streak ${newStreak})`);

    // ms until next claim (24h from now)
    const msUntilNext = 24 * 60 * 60 * 1000;

    return { amount, streak: newStreak, nextStreak: newStreak + 1, wallet: updated, msUntilNext };
}

// ── Work ──────────────────────────────────────────────────────────────────────

export async function claimWork(
    guildId: string,
    userId:  string,
    config:  EconomyConfig,
): Promise<{ amount: number; wallet: EconomyWallet } | { cooldown: true; msRemaining: number }> {
    const wallet = await getWallet(guildId, userId);
    const now    = new Date();
    const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

    if (wallet.lastWork) {
        const msSince = now.getTime() - wallet.lastWork.getTime();
        if (msSince < COOLDOWN_MS) {
            return { cooldown: true, msRemaining: COOLDOWN_MS - msSince };
        }
    }

    const amount = Math.floor(Math.random() * (config.workMax - config.workMin + 1)) + config.workMin;

    const [updated] = await db.update(economyWallets)
        .set({
            balance:     wallet.balance + amount,
            totalEarned: wallet.totalEarned + amount,
            lastWork:    now,
            updatedAt:   now,
        })
        .where(and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, userId)))
        .returning();

    await addTransaction(guildId, userId, 'work', amount, `Work reward`);
    return { amount, wallet: updated };
}

// ── Rob ───────────────────────────────────────────────────────────────────────

export interface RobResult {
    success:  boolean;
    stolen?:  number;
    penalty?: number;
    robberWallet: EconomyWallet;
    victimWallet?: EconomyWallet;
}

export async function attemptRob(
    guildId:  string,
    robberId: string,
    victimId: string,
    config:   EconomyConfig,
): Promise<RobResult | { cooldown: true; msRemaining: number } | { error: string }> {
    const robber = await getWallet(guildId, robberId);
    const now    = new Date();
    const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

    if (robber.lastRob) {
        const msSince = now.getTime() - robber.lastRob.getTime();
        if (msSince < COOLDOWN_MS) {
            return { cooldown: true, msRemaining: COOLDOWN_MS - msSince };
        }
    }

    const victim = await getWallet(guildId, victimId);
    if (victim.balance < config.robMinBalance) {
        return { error: `Target doesn't have enough in their wallet (need at least **${config.robMinBalance.toLocaleString()} ${config.currencyEmoji}** in wallet, not bank).` };
    }

    const success = Math.random() * 100 < config.robSuccessRate;

    if (success) {
        // Steal 10-50% of victim's wallet balance
        const pct    = Math.random() * 0.4 + 0.1; // 10-50%
        const stolen = Math.max(1, Math.floor(victim.balance * pct));

        const [robberUpdated] = await db.update(economyWallets)
            .set({
                balance:     robber.balance + stolen,
                totalEarned: robber.totalEarned + stolen,
                lastRob:     now,
                updatedAt:   now,
            })
            .where(and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, robberId)))
            .returning();

        const [victimUpdated] = await db.update(economyWallets)
            .set({
                balance:   Math.max(0, victim.balance - stolen),
                updatedAt: now,
            })
            .where(and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, victimId)))
            .returning();

        await addTransaction(guildId, robberId, 'rob', +stolen, `Robbed <@${victimId}>`);
        await addTransaction(guildId, victimId, 'rob', -stolen, `Robbed by <@${robberId}>`);

        return { success: true, stolen, robberWallet: robberUpdated, victimWallet: victimUpdated };
    } else {
        // Penalty on fail
        const penalty = Math.min(config.robFailPenalty, robber.balance);

        const [robberUpdated] = await db.update(economyWallets)
            .set({
                balance:   Math.max(0, robber.balance - penalty),
                lastRob:   now,
                updatedAt: now,
            })
            .where(and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, robberId)))
            .returning();

        await addTransaction(guildId, robberId, 'rob', -penalty, `Failed to rob <@${victimId}>`);

        return { success: false, penalty, robberWallet: robberUpdated };
    }
}

// ── Gamble ────────────────────────────────────────────────────────────────────

export async function gamble(
    guildId: string,
    userId:  string,
    bet:     number,
    config:  EconomyConfig,
): Promise<{ won: boolean; amount: number; wallet: EconomyWallet } | { cooldown: true; msRemaining: number } | { error: string }> {
    const wallet = await getWallet(guildId, userId);
    const now    = new Date();
    const COOLDOWN_MS = 30 * 60 * 1000; // 30 min

    if (wallet.lastGamble) {
        const msSince = now.getTime() - wallet.lastGamble.getTime();
        if (msSince < COOLDOWN_MS) return { cooldown: true, msRemaining: COOLDOWN_MS - msSince };
    }

    if (config.maxBet > 0 && bet > config.maxBet)
        return { error: `Max bet is **${config.maxBet.toLocaleString()} ${config.currencyEmoji}**.` };
    if (bet > wallet.balance)
        return { error: `You only have **${wallet.balance.toLocaleString()} ${config.currencyEmoji}** in your wallet.` };

    const won = Math.random() < 0.5;
    const delta = won ? bet : -bet;

    const [updated] = await db.update(economyWallets)
        .set({
            balance:     wallet.balance + delta,
            totalEarned: won ? wallet.totalEarned + bet : wallet.totalEarned,
            lastGamble:  now,
            updatedAt:   now,
        })
        .where(and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, userId)))
        .returning();

    await addTransaction(guildId, userId, 'gamble', delta, won ? 'Gamble win' : 'Gamble loss');
    return { won, amount: bet, wallet: updated };
}

// ── Slots ─────────────────────────────────────────────────────────────────────

export const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
export const SLOT_WEIGHTS = [30, 25, 20, 15, 5, 3, 2]; // rarer = more weight at start, higher payout

function weightedSlot(): string {
    const total = SLOT_WEIGHTS.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < SLOT_SYMBOLS.length; i++) {
        r -= SLOT_WEIGHTS[i];
        if (r <= 0) return SLOT_SYMBOLS[i];
    }
    return SLOT_SYMBOLS[0];
}

export function spinSlots(): [string, string, string] {
    return [weightedSlot(), weightedSlot(), weightedSlot()];
}

// Returns multiplier: 0 = full loss
export function slotsMultiplier(reels: [string, string, string]): number {
    const [a, b, c] = reels;
    if (a === b && b === c) {
        if (a === '7️⃣') return 10;
        if (a === '💎') return 7;
        if (a === '🔔') return 5;
        return 3; // any 3 matching fruits
    }
    if (a === b || b === c || a === c) return 1.5; // 2 matching
    return 0;
}

export async function playSlots(
    guildId: string,
    userId:  string,
    bet:     number,
    config:  EconomyConfig,
): Promise<{
    reels: [string, string, string];
    multiplier: number;
    payout: number;
    wallet: EconomyWallet;
} | { cooldown: true; msRemaining: number } | { error: string }> {
    const wallet = await getWallet(guildId, userId);
    const now    = new Date();
    const COOLDOWN_MS = 15 * 60 * 1000; // 15 min

    if (wallet.lastSlots) {
        const msSince = now.getTime() - wallet.lastSlots.getTime();
        if (msSince < COOLDOWN_MS) return { cooldown: true, msRemaining: COOLDOWN_MS - msSince };
    }

    if (config.maxBet > 0 && bet > config.maxBet)
        return { error: `Max bet is **${config.maxBet.toLocaleString()} ${config.currencyEmoji}**.` };
    if (bet > wallet.balance)
        return { error: `You only have **${wallet.balance.toLocaleString()} ${config.currencyEmoji}** in your wallet.` };

    const reels      = spinSlots();
    const multiplier = slotsMultiplier(reels);
    const payout     = Math.floor(bet * multiplier);
    const delta      = payout - bet; // net gain (negative if lost)

    const [updated] = await db.update(economyWallets)
        .set({
            balance:     Math.max(0, wallet.balance + delta),
            totalEarned: delta > 0 ? wallet.totalEarned + delta : wallet.totalEarned,
            lastSlots:   now,
            updatedAt:   now,
        })
        .where(and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, userId)))
        .returning();

    await addTransaction(guildId, userId, 'slots', delta, `Slots: ${reels.join('')} (${multiplier}x)`);
    return { reels, multiplier, payout, wallet: updated };
}

// ── Coinflip ──────────────────────────────────────────────────────────────────

export async function coinflipEconomy(
    guildId: string,
    userId:  string,
    bet:     number,
    guess:   'heads' | 'tails',
    config:  EconomyConfig,
): Promise<{ won: boolean; result: string; payout: number; wallet: EconomyWallet } | { error: string }> {
    const wallet = await getWallet(guildId, userId);

    if (config.maxBet > 0 && bet > config.maxBet)
        return { error: `Max bet is **${config.maxBet.toLocaleString()} ${config.currencyEmoji}**.` };
    if (bet > wallet.balance)
        return { error: `You only have **${wallet.balance.toLocaleString()} ${config.currencyEmoji}** in your wallet.` };

    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won    = result === guess;
    const delta  = won ? bet : -bet;

    const [updated] = await db.update(economyWallets)
        .set({
            balance:     Math.max(0, wallet.balance + delta),
            totalEarned: won ? wallet.totalEarned + bet : wallet.totalEarned,
            updatedAt:   new Date(),
        })
        .where(and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, userId)))
        .returning();

    await addTransaction(guildId, userId, 'coinflip', delta, `Coinflip ${won ? 'win' : 'loss'}`);
    return { won, result, payout: bet, wallet: updated };
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export async function getEconomyLeaderboard(guildId: string, limit = 10) {
    return db.query.economyWallets.findMany({
        where:   eq(economyWallets.guildId, guildId),
        orderBy: [
            desc(sql`${economyWallets.balance} + ${economyWallets.bank}`),
        ],
        limit,
    });
}

// ── Shop ──────────────────────────────────────────────────────────────────────

export async function getShopItems(guildId: string): Promise<EconomyShopItem[]> {
    return db.query.economyShop.findMany({
        where:   and(eq(economyShop.guildId, guildId), eq(economyShop.enabled, true)),
        orderBy: [economyShop.price],
    });
}

export async function getShopItem(guildId: string, itemId: number): Promise<EconomyShopItem | undefined> {
    return db.query.economyShop.findFirst({
        where: and(eq(economyShop.guildId, guildId), eq(economyShop.id, itemId)),
    });
}

export async function addShopItem(
    guildId: string,
    item: Omit<typeof economyShop.$inferInsert, 'id' | 'guildId'>,
): Promise<EconomyShopItem> {
    const [row] = await db.insert(economyShop).values({ guildId, ...item }).returning();
    return row;
}

export async function removeShopItem(guildId: string, itemId: number): Promise<boolean> {
    const result = await db.delete(economyShop)
        .where(and(eq(economyShop.guildId, guildId), eq(economyShop.id, itemId)));
    return (result as any).rowCount > 0;
}

export async function purchaseItem(
    guildId: string,
    userId:  string,
    itemId:  number,
    config:  EconomyConfig,
): Promise<{ wallet: EconomyWallet; item: EconomyShopItem } | { error: string }> {
    const item = await getShopItem(guildId, itemId);
    if (!item || !item.enabled) return { error: 'Item not found or not available.' };
    if (item.stock === 0)       return { error: 'This item is out of stock.' };

    const wallet = await getWallet(guildId, userId);
    if (wallet.balance < item.price)
        return { error: `You need **${item.price.toLocaleString()} ${config.currencyEmoji}** but only have **${wallet.balance.toLocaleString()}**.` };

    // Deduct balance
    const [updated] = await db.update(economyWallets)
        .set({ balance: wallet.balance - item.price, updatedAt: new Date() })
        .where(and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, userId)))
        .returning();

    // Decrement stock if not unlimited
    if (item.stock > 0) {
        await db.update(economyShop)
            .set({ stock: item.stock - 1 })
            .where(eq(economyShop.id, itemId));
    }

    // Record purchase
    const existing = await db.query.economyPurchases.findFirst({
        where: and(
            eq(economyPurchases.guildId, guildId),
            eq(economyPurchases.userId, userId),
            eq(economyPurchases.itemId, itemId),
        ),
    });

    if (existing) {
        await db.update(economyPurchases)
            .set({ quantity: sql`${economyPurchases.quantity} + 1` })
            .where(eq(economyPurchases.id, existing.id));
    } else {
        await db.insert(economyPurchases).values({ guildId, userId, itemId });
    }

    await addTransaction(guildId, userId, 'shop', -item.price, `Bought: ${item.name}`);
    return { wallet: updated, item };
}

export async function getInventory(guildId: string, userId: string) {
    const purchases = await db.query.economyPurchases.findMany({
        where: and(eq(economyPurchases.guildId, guildId), eq(economyPurchases.userId, userId)),
    });

    // Attach item details
    const result = await Promise.all(
        purchases.map(async (p) => {
            const item = await db.query.economyShop.findFirst({
                where: eq(economyShop.id, p.itemId),
            });
            return { ...p, item };
        })
    );

    return result.filter(r => r.item) as (typeof economyPurchases.$inferSelect & { item: EconomyShopItem })[];
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function adminGive(
    guildId: string,
    userId:  string,
    amount:  number,
): Promise<EconomyWallet> {
    return adjustBalance(guildId, userId, amount, 'admin', `Admin grant`);
}

export async function adminTake(
    guildId: string,
    userId:  string,
    amount:  number,
): Promise<EconomyWallet> {
    return adjustBalance(guildId, userId, -amount, 'admin', `Admin deduct`);
}

export async function adminReset(guildId: string, userId: string): Promise<void> {
    await db.update(economyWallets)
        .set({ balance: 0, bank: 0, totalEarned: 0, dailyStreak: 0, lastDaily: null, updatedAt: new Date() })
        .where(and(eq(economyWallets.guildId, guildId), eq(economyWallets.userId, userId)));
    await addTransaction(guildId, userId, 'admin', 0, 'Wallet reset by admin');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatCooldown(ms: number): string {
    const totalSecs = Math.ceil(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

export function parseBetAmount(arg: string, balance: number): number | null {
    const lower = arg.toLowerCase().trim();
    if (lower === 'all' || lower === 'max') return balance;
    if (lower === 'half') return Math.floor(balance / 2);
    const n = parseInt(lower.replace(/,/g, ''), 10);
    if (isNaN(n) || n <= 0) return null;
    return n;
}

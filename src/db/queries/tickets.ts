// src/db/queries/tickets.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { ticketPanels, ticketOptions, tickets } from '../schema.js';
import { ensureGuild } from './guilds.js';

// ── Panels ────────────────────────────────────────────────────────────────────

export async function createPanel(guildId: string, channelId: string, label: string, description?: string, color?: number) {
    await ensureGuild(guildId);
    const [panel] = await db.insert(ticketPanels)
        .values({ guildId, channelId, label, description, color })
        .returning();
    return panel;
}

export async function getPanels(guildId: string) {
    return db.query.ticketPanels.findMany({
        where: eq(ticketPanels.guildId, guildId),
    });
}

export async function getPanel(panelId: number) {
    return db.query.ticketPanels.findFirst({
        where: eq(ticketPanels.id, panelId),
    });
}

export async function updatePanelMessage(panelId: number, messageId: string) {
    await db.update(ticketPanels)
        .set({ messageId })
        .where(eq(ticketPanels.id, panelId));
}

export async function deletePanel(panelId: number) {
    await db.delete(ticketPanels).where(eq(ticketPanels.id, panelId));
}

// ── Options (ticket types inside a panel) ─────────────────────────────────────

export async function addOption(
    panelId: number,
    guildId: string,
    label: string,
    opts: {
        emoji?:       string;
        categoryId?:  string;
        supportRoles?: string[];
        openMessage?: string;
        maxOpen?:     number;
    }
) {
    const [option] = await db.insert(ticketOptions)
        .values({
            panelId,
            guildId,
            label,
            emoji:        opts.emoji,
            categoryId:   opts.categoryId,
            supportRoles: opts.supportRoles ?? [],
            openMessage:  opts.openMessage,
            maxOpen:      opts.maxOpen ?? 1,
        })
        .returning();
    return option;
}

export async function getPanelOptions(panelId: number) {
    return db.query.ticketOptions.findMany({
        where: eq(ticketOptions.panelId, panelId),
    });
}

export async function getOption(optionId: number) {
    return db.query.ticketOptions.findFirst({
        where: eq(ticketOptions.id, optionId),
    });
}

export interface FormField {
    label:       string;
    placeholder?: string;
    required:    boolean;
    paragraph:   boolean; // true = paragraph, false = short text
}

export async function updateOptionFormFields(optionId: number, fields: FormField[]) {
    await db.update(ticketOptions)
        .set({ formFields: fields })
        .where(eq(ticketOptions.id, optionId));
}

// ── Tickets ───────────────────────────────────────────────────────────────────

export async function createTicket(
    guildId: string,
    channelId: string,
    userId: string,
    optionId?: number,
) {
    await ensureGuild(guildId);
    const [ticket] = await db.insert(tickets)
        .values({ guildId, channelId, userId, optionId, status: 'open' })
        .returning();
    return ticket;
}

export async function getTicket(channelId: string) {
    return db.query.tickets.findFirst({
        where: eq(tickets.channelId, channelId),
    });
}

export async function getTicketById(id: number) {
    return db.query.tickets.findFirst({
        where: eq(tickets.id, id),
    });
}

export async function getUserOpenTickets(guildId: string, userId: string, optionId?: number) {
    return db.query.tickets.findMany({
        where: and(
            eq(tickets.guildId, guildId),
            eq(tickets.userId, userId),
            eq(tickets.status, 'open'),
            ...(optionId ? [eq(tickets.optionId, optionId)] : []),
        ),
    });
}

export async function updateTicketStatus(
    channelId: string,
    status: 'open' | 'closed' | 'deleted',
    claimedBy?: string,
) {
    await db.update(tickets)
        .set({
            status,
            claimedBy,
            ...(status === 'closed' ? { closedAt: new Date() } : {}),
        })
        .where(eq(tickets.channelId, channelId));
}

export async function claimTicket(channelId: string, userId: string) {
    await db.update(tickets)
        .set({ claimedBy: userId })
        .where(eq(tickets.channelId, channelId));
}

export async function unclaimTicket(channelId: string) {
    await db.update(tickets)
        .set({ claimedBy: null })
        .where(eq(tickets.channelId, channelId));
}
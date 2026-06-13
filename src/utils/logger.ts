// src/utils/logger.ts
// Lightweight structured logger — no dependencies, colours via ANSI codes.
// Usage: logger.info('Ready', { guilds: 10 })

const RESET  = '\x1b[0m';
const GREY   = '\x1b[90m';
const CYAN   = '\x1b[96m';
const GREEN  = '\x1b[92m';
const YELLOW = '\x1b[93m';
const RED    = '\x1b[91m';
const BOLD   = '\x1b[1m';

type Meta = Record<string, unknown>;

function timestamp(): string {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function format(level: string, colour: string, msg: string, meta?: Meta): string {
    const ts   = `${GREY}${timestamp()}${RESET}`;
    const tag  = `${colour}${BOLD}${level.padEnd(5)}${RESET}`;
    const body = `${BOLD}${msg}${RESET}`;
    const extra = meta ? ` ${GREY}${JSON.stringify(meta)}${RESET}` : '';
    return `${ts}  ${tag}  ${body}${extra}`;
}

export const logger = {
    info(msg: string, meta?: Meta) {
        console.log(format('INFO', CYAN, msg, meta));
    },
    success(msg: string, meta?: Meta) {
        console.log(format('OK', GREEN, msg, meta));
    },
    warn(msg: string, meta?: Meta) {
        console.warn(format('WARN', YELLOW, msg, meta));
    },
    error(msg: string, error?: unknown, meta?: Meta) {
        const errStr = error instanceof Error
            ? `\n  ${RED}${error.stack ?? error.message}${RESET}`
            : error ? ` ${String(error)}` : '';
        console.error(format('ERROR', RED, msg, meta) + errStr);
    },
    debug(msg: string, meta?: Meta) {
        if (process.env.DEBUG === 'true') {
            console.log(format('DEBUG', GREY, msg, meta));
        }
    },
};
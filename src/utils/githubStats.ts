// src/utils/githubStats.ts
import { logger } from './logger.js';
import type { FadeClient } from '../client.js';

const REPO_OWNER = 'Suyash-24';
const REPO_NAME = 'FadeWeb';
const FILE_PATH = 'stats.json';
const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

let lastCount = -1;

export function startGithubStatsSync(client: FadeClient) {
    if (!process.env.GITHUB_TOKEN) {
        logger.warn('GITHUB_TOKEN not set in .env; GitHub stats sync disabled.');
        return;
    }

    const sync = async () => {
        try {
            const currentCount = client.guilds.cache.size;
            if (currentCount === lastCount) {
                return; // No change locally since last check
            }

            const token = process.env.GITHUB_TOKEN;
            const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

            // 1. Get current file SHA and data
            const getRes = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Fade-Discord-Bot',
                }
            });

            if (!getRes.ok && getRes.status !== 404) {
                logger.error(`Failed to fetch stats.json from GitHub: ${getRes.statusText}`);
                return;
            }

            let sha: string | undefined;
            if (getRes.ok) {
                const getData = await getRes.json();
                sha = getData.sha;
                
                // Parse existing content to see if it's already up to date on GitHub
                try {
                    const contentStr = Buffer.from(getData.content, 'base64').toString('utf8');
                    const existingData = JSON.parse(contentStr);
                    if (existingData.servers === currentCount) {
                        lastCount = currentCount; // Sync local cache
                        return; // Already accurate
                    }
                } catch {}
            }

            // 2. Prepare new content
            const newStats = {
                servers: currentCount,
                updated_at: new Date().toISOString()
            };
            const newContentBase64 = Buffer.from(JSON.stringify(newStats, null, 2)).toString('base64');

            // 3. Update the file
            const putRes = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Fade-Discord-Bot',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Auto-update stats.json: ${currentCount} servers`,
                    content: newContentBase64,
                    sha: sha // required if updating an existing file
                })
            });

            if (putRes.ok) {
                logger.success(`Successfully updated GitHub stats.json to ${currentCount} servers`);
                lastCount = currentCount;
            } else {
                const errData = await putRes.json().catch(() => ({}));
                logger.error(`Failed to update GitHub stats.json: ${putRes.statusText}`, errData as any);
            }
        } catch (err) {
            logger.error('Error during GitHub stats sync', err as any);
        }
    };

    // Run on startup
    sync();

    // Run every 30 mins
    setInterval(sync, INTERVAL_MS);
    logger.info('GitHub stats sync started (Interval: 30m)');
}

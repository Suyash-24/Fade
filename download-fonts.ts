import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const fonts = [
    { name: 'Roboto-Bold.ttf', url: 'https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf' },
    { name: 'Roboto-Regular.ttf', url: 'https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf' },
    { name: 'NotoSans-Regular.ttf', url: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf' },
    { name: 'NotoSansThai-Regular.ttf', url: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansThai/NotoSansThai-Regular.ttf' },
    { name: 'NotoSansJP-Regular.ttf', url: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansJP/NotoSansJP-Regular.ttf' },
    { name: 'NotoSansArabic-Regular.ttf', url: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf' },
    { name: 'NotoSansDevanagari-Regular.ttf', url: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf' },
    { name: 'NotoSansKR-Regular.ttf', url: 'https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf' },
    { name: 'NotoColorEmoji.ttf', url: 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/fonts/NotoColorEmoji.ttf' },
];

async function run() {
    const dir = join(process.cwd(), 'assets', 'fonts');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    for (const f of fonts) {
        console.log(`Downloading ${f.name}...`);
        try {
            const res = await fetch(f.url);
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const buf = Buffer.from(await res.arrayBuffer());
            writeFileSync(join(dir, f.name), buf);
            console.log(`✓ ${f.name} (${(buf.length / 1024).toFixed(0)} KB)`);
        } catch (err: any) {
            console.error(`✗ Failed ${f.name}: ${err.message}`);
        }
    }
}

run();

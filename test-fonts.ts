import { GlobalFonts } from '@napi-rs/canvas';
import { join } from 'path';

GlobalFonts.loadFontsFromDir(join(process.cwd(), 'assets', 'fonts'));

console.log(GlobalFonts.families.map(f => f.family).join(' | '));

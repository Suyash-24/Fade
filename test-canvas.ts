import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';

console.log('Available fonts before:', GlobalFonts.families);

const loaded = GlobalFonts.registerFromPath('C:\\Windows\\Fonts\\arial.ttf', 'Arial');
console.log('Loaded Arial?', loaded);

console.log('Available fonts after:', GlobalFonts.families);

const canvas = createCanvas(200, 200);
const ctx = canvas.getContext('2d');

ctx.fillStyle = '#000000';
ctx.fillRect(0, 0, 200, 200);

ctx.fillStyle = '#ffffff';
ctx.font = 'bold 40px Arial';
ctx.fillText('40%', 100, 100);

const buffer = canvas.toBuffer('image/png');
writeFileSync('test.png', buffer);
console.log('Done, wrote test.png. Size:', buffer.length);

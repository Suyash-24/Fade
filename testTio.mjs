import { TIO } from 'tio.js';

async function testTio() {
    try {
        const tio = new TIO();
        const code = `print("hello from try-it-online")`;
        const res = await tio.eval(code, 'python3');
        console.log("Success:");
        console.log(res);
    } catch (e) {
        console.error("Error:", e);
    }
}
testTio();

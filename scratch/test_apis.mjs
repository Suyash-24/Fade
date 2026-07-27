// Test embed proxy URLs - just check if they return valid HTML with og:video
async function test() {
    const tests = [
        { name: "vxtwitter", url: "https://vxtwitter.com/elonmusk/status/1674865731136020505" },
        { name: "fxtwitter", url: "https://fxtwitter.com/elonmusk/status/1674865731136020505" },
        { name: "vxtiktok", url: "https://vxtiktok.com/@mrbeast/video/7279140417936166186" },
        { name: "tfxktok", url: "https://tfxktok.com/@mrbeast/video/7279140417936166186" },
        { name: "tiktxk", url: "https://tiktxk.com/@mrbeast/video/7279140417936166186" },
        { name: "tnktok", url: "https://tnktok.com/@mrbeast/video/7279140417936166186" },
        { name: "ddinstagram", url: "https://ddinstagram.com/reel/DZ2quy8o6Xf" },
        { name: "instagramez", url: "https://instagramez.com/reel/DZ2quy8o6Xf" },
    ];

    for (const t of tests) {
        console.log(`\n=== ${t.name} ===`);
        try {
            const r = await fetch(t.url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0)' } });
            const html = await r.text();
            const ogVideo = html.match(/og:video[^>]*content="([^"]+)"/i);
            const ogImage = html.match(/og:image[^>]*content="([^"]+)"/i);
            console.log(`Status: ${r.status} | og:video: ${ogVideo ? ogVideo[1].substring(0,80) + '...' : 'NONE'}`);
            console.log(`og:image: ${ogImage ? ogImage[1].substring(0,80) + '...' : 'NONE'}`);
        } catch(e) {
            console.log(`FAIL: ${e.message}`);
        }
    }
}
test();

async function test() {
    try {
        const prompt = 'Hello';
        const res = await fetch('https://devtoolbox-api.devtoolbox-api.workers.dev/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!res.ok) {
            console.error('API Error Status:', res.status, res.statusText);
            console.error('Response body:', await res.text());
            return;
        }
        
        const answer = await res.text();
        console.log('Success:', answer);
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

test();

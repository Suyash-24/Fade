async function test() {
    try {
        const res = await fetch('https://text.pollinations.ai/openai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'openai',
                messages: [
                    { role: 'user', content: 'Hello!' }
                ],
            }),
        });

        if (!res.ok) {
            console.error('API Error Status:', res.status, res.statusText);
            console.error('Response body:', await res.text());
            return;
        }
        
        const data = await res.json();
        console.log('Success:', data.choices[0].message.content);
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

test();

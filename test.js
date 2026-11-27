
async function testUpdate() {

    const response = await fetch(
        'http://localhost:3000/api/tickets'
    );

    const tickets = await response.json();

    const ticket = tickets.find(
        t => t.status === 'waiting'
    );

    if (!ticket) {
        console.log('No waiting tickets');
        return;
    }

    const update = await fetch(
        `http://localhost:3000/api/tickets/${ticket.id}/status`,
        {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'serving'
            })
        }
    );

    const result = await update.json();

    console.log('HTTP Status:', update.status);
    console.log(result);
}

testUpdate().catch(console.error);

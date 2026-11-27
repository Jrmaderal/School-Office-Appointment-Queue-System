async function testLogin() {

    const response = await fetch(
        'http://127.0.0.1:3000/api/auth/login',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'student',
                password: 'student123'
            })
        }
    );

    const result = await response.json();

    console.log('HTTP Status:', response.status);
    console.log(result);
}

testLogin().catch(console.error);

const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(
    path.join(__dirname, 'school_queue.db'),
    (err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('Connected to SQLite database');
        }
    }
);

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            number TEXT NOT NULL,
            studentId TEXT NOT NULL,
            studentName TEXT NOT NULL,
            office TEXT NOT NULL,
            service TEXT NOT NULL,
            status TEXT DEFAULT 'waiting',
            createdAt TEXT NOT NULL,
            estimatedWait INTEGER DEFAULT 0
        )
    `, (err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('Tickets table is ready');
        }
    });
});


    
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('student', 'staff')),
            avatar TEXT,
            office TEXT
        )
    `, (err) => {

        if (err) {
            console.error(err.message);
            return;
        }

        console.log('Users table is ready');

        const demoAccounts = [
            {
                id: 'STU-1001',
                username: 'student',
                email: 'student@school.edu',
                name: 'Alex Rivera',
                password: 'student123',
                role: 'student',
                avatar: 'AR',
                office: null
            },
            {
                id: 'STF-2001',
                username: 'staff',
                email: 'staff@school.edu',
                name: 'Dr. Morgan',
                password: 'staff123',
                role: 'staff',
                avatar: 'DM',
                office: 'registrar'
            }
        ];

        demoAccounts.forEach(user => {

            const hashedPassword = bcrypt.hashSync(
                user.password, 10
            );

            db.run(`
                INSERT OR IGNORE INTO users
                (id, username, email, name, password, role, avatar, office)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                user.id,
                user.username,
                user.email,
                user.name,
                hashedPassword,
                user.role,
                user.avatar,
                user.office
            ], (err) => {

                if (err) {
                    console.error(err.message);
                } else {
                    console.log('Demo account ready:', user.username);
                }

            });
        });
    });



module.exports = db;

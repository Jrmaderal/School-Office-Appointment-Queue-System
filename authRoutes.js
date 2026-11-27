const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./database');

const router = express.Router();

router.post('/login', (req, res) => {

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Please enter username and password.'
        });
    }

    const sql = `
        SELECT * FROM users
        WHERE LOWER(username) = LOWER(?)
        OR LOWER(email) = LOWER(?)
    `;

    db.get(sql, [username.trim(), username.trim()], (err, user) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password.'
            });
        }

        const sessionUser = {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
            office: user.office
        };

        req.session.regenerate((err) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Session error.'
                });
            }

            req.session.user = sessionUser;

            res.json({
                success: true,
                user: sessionUser,
                redirect: user.role === 'staff'
                    ? 'staff.html'
                    : 'student.html'
            });
        });
    });
});

module.exports = router;

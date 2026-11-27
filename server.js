const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const db = require('./database');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    transports: ['websocket']
});

const PORT = 3000;

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

const authRoutes = require('./authRoutes');
app.use('/api/auth', authRoutes);

const queueRoutes = require('./queueRoutes');
app.use('/api/tickets', queueRoutes(io));

app.get('/api/test', (req, res) => {
    res.json({
        message: 'Backend is working!'
    });
});

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get(/^\/[a-zA-Z0-9-]+\.html$/, (req, res) => {
    res.sendFile(path.join(__dirname, req.path));
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log('Server running at http://localhost:3000');
});

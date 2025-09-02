const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const fs = require('fs');
const bcrypt = require('bcryptjs'); // switched from bcrypt to bcryptjs
const multer = require('multer');
const path = require('path');


const app = express();
const server = http.createServer(app);
// Prefer Render defaults and CORS passthrough (same-origin by default)
const io = new Server(server);

// Config
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change_me_in_env';
const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure upload dir exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// JSON helpers (non-blocking saves)
const writeJson = (file, data) => fs.promises.writeFile(file, JSON.stringify(data, null, 2));

// Load data (keep simple sync read at boot)
let users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : [];
let messages = fs.existsSync(MESSAGES_FILE) ? JSON.parse(fs.readFileSync(MESSAGES_FILE)) : [];

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1); // behind Render proxy

app.use(session({
    name: 'sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    }
}));

app.use(express.static('public'));

// Multer storage and safer constraints
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname).toLowerCase())
});
const allowedImageTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (allowedImageTypes.has(file.mimetype)) return cb(null, true);
        return cb(new Error('Invalid file type'));
    }
});

// Authentication
app.post('/register', async (req, res) => {
    try {
        let { username, password } = req.body;
        username = (username || '').trim();
        password = (password || '').trim();

        if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password required' });
        if (username.length < 3 || username.length > 30) return res.status(400).json({ success: false, message: 'Username must be 3-30 chars' });
        if (password.length < 6 || password.length > 72) return res.status(400).json({ success: false, message: 'Password must be 6-72 chars' });
        if (users.find(u => u.username === username)) return res.status(409).json({ success: false, message: 'User already exists' });

        const hash = await bcrypt.hash(password, 10);
        users.push({ username, password: hash });
        await writeJson(USERS_FILE, users);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/login', async (req, res) => {
    try {
        let { username, password } = req.body;
        username = (username || '').trim();
        password = (password || '').trim();

        const user = users.find(u => u.username === username);
        if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        req.session.user = username;
        res.json({ success: true, username });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/session', (req, res) => {
    if (req.session.user) res.json({ loggedIn: true, username: req.session.user });
    else res.json({ loggedIn: false });
});

// NEW: logout endpoint
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ success: false });
        res.clearCookie('sid', { path: '/' });
        res.json({ success: true });
    });
});

// Message edit/delete (only Serpentine)
app.post('/edit', (req, res) => {
    if (req.session.user !== 'Serpentine') return res.status(403).json({ success: false });
    const index = Number.parseInt(req.body.index, 10);
    const newText = (req.body.newText || '').toString().trim().slice(0, 200);
    if (!Number.isInteger(index) || index < 0 || index >= messages.length) return res.json({ success: false });

    messages[index].text = newText;
    writeJson(MESSAGES_FILE, messages).catch(() => {});
    io.emit('updateMessage', { index, newText });
    res.json({ success: true });
});

app.post('/delete', (req, res) => {
    if (req.session.user !== 'Serpentine') return res.status(403).json({ success: false });
    const index = Number.parseInt(req.body.index, 10);
    if (!Number.isInteger(index) || index < 0 || index >= messages.length) return res.json({ success: false });

    messages.splice(index, 1);
    writeJson(MESSAGES_FILE, messages).catch(() => {});
    io.emit('deleteMessage', { index });
    res.json({ success: true });
});

// File upload route (auth + safer errors)
app.post('/upload', (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
    upload.single('image')(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
        res.json({ success: true, path: '/uploads/' + req.file.filename });
    });
});

// Healthcheck for Render
app.get('/healthz', (_req, res) => res.send('ok'));

// Socket.IO
let onlineUsers = {};

io.on('connection', (socket) => {
    socket.on('join', (username) => {
        username = (username || '').toString().trim();
        if (!username) return;

        // Disconnect previous session with same username
        const existingId = onlineUsers[username];
        if (existingId && io.sockets.sockets.get(existingId)) {
            io.sockets.sockets.get(existingId).disconnect(true);
        }

        socket.username = username;
        onlineUsers[username] = socket.id;

        socket.emit('loadMessages', messages);
        io.emit('onlineUsers', Object.keys(onlineUsers));
    });

    // NEW: allow client to leave without disconnecting the socket
    socket.on('leave', () => {
        if (socket.username && onlineUsers[socket.username] === socket.id) {
            delete onlineUsers[socket.username];
            socket.username = null;
            io.emit('onlineUsers', Object.keys(onlineUsers));
        }
    });

    socket.on('chatMessage', (msg) => {
        const text = (msg?.text || '').toString().trim().slice(0, 200);
        const image = msg?.image || null;
        const to = (msg?.to || null);

        if (!socket.username) return;
        if (!text && !image) return; // ignore empty

        const message = {
            user: socket.username,
            text,
            image,
            to: to || null,
            ts: Date.now()
        };

        messages.push(message);
        writeJson(MESSAGES_FILE, messages).catch(() => {});

        const idx = messages.length - 1;
        if (to && onlineUsers[to]) {
            io.to(onlineUsers[to]).emit('message', message, idx);
            socket.emit('message', message, idx);
        } else {
            io.emit('message', message, idx);
        }
    });

    socket.on('disconnect', () => {
        if (socket.username && onlineUsers[socket.username] === socket.id) {
            delete onlineUsers[socket.username];
            io.emit('onlineUsers', Object.keys(onlineUsers));
        }
    });
});

// Use Render's PORT and bind to 0.0.0.0
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

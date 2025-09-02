const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = process.env.PORT || 3000;

// In-memory users (replace with DB in production)
let users = [];
let onlineUsers = {};

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true
}));

// Multer setup for image uploads
const storage = multer.diskStorage({
    destination: "./public/uploads/",
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Register
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || username.length > 30) {
        return res.json({ success: false, message: "Invalid username or password." });
    }
    if (users.find(u => u.username === username)) {
        return res.json({ success: false, message: "Username taken." });
    }
    const hash = await bcrypt.hash(password, 10);
    users.push({ username, password: hash });
    res.json({ success: true });
});

// Login
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (!user) return res.json({ success: false, message: "User not found." });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ success: false, message: "Wrong password." });

    req.session.username = username;
    res.json({ success: true, username });
});

// Image upload endpoint
app.post("/upload", upload.single("image"), (req, res) => {
    if (!req.file) return res.json({ success: false });
    res.json({ success: true, file: `/uploads/${req.file.filename}` });
});

// Serve index.html
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

// Socket.io
io.on("connection", socket => {
    console.log("New socket connected");

    socket.on("join", username => {
        socket.username = username;
        onlineUsers[username] = socket.id;
        io.emit("userlist", Object.keys(onlineUsers));
    });

    socket.on("chat", data => {
        // If private message
        if (data.to && onlineUsers[data.to]) {
            io.to(onlineUsers[data.to]).emit("chat", data);
            socket.emit("chat", data); // send back to sender
        } else {
            io.emit("chat", data);
        }
    });

    socket.on("disconnect", () => {
        delete onlineUsers[socket.username];
        io.emit("userlist", Object.keys(onlineUsers));
    });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

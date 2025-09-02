const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 👉 Serve files from /public folder
app.use(express.static(path.join(__dirname, "public")));

let users = {};

io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("login", (username) => {
        users[socket.id] = username;
        io.emit("userlist", Object.values(users));
    });

    socket.on("chat message", (msg) => {
        io.emit("chat message", {
            user: users[socket.id] || "Anonymous",
            text: msg,
        });
    });

    socket.on("disconnect", () => {
        delete users[socket.id];
        io.emit("userlist", Object.values(users));
        console.log("A user disconnected");
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

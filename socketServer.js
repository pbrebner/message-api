const http = require("http");
const { Server } = require("socket.io");

const User = require("./models/user");

function setSocketServer(app) {
    // Create http server
    // Create the Socket IO server on
    // the top of http server
    const server = http.createServer(app);
    const io = new Server(server, {
        cors: {
            origin: ["http://localhost:5173", "https://pbrebner.github.io"],
            methods: ["GET", "POST"],
        },
    });

    io.on("connection", (socket) => {
        console.log("A user connected");

        // Sets user status to online
        socket.on("online", async (data) => {
            console.log("User Online");
            socket.data.userId = data.userId;

            await User.findByIdAndUpdate(data.userId, { online: true });
            socket.join(data.userId);

            // TODO: Maybe create room with all friends instead
            socket.emit("receiveOnline");
            console.log(socket.rooms);
        });

        // Sets user status to offline
        socket.on("offline", async (data) => {
            console.log("User Offline");
            await User.findByIdAndUpdate(data.userId, { online: false });
            socket.leave(data.userId);
            console.log(socket.rooms);
        });

        // On socket disconnect
        socket.on("disconnect", async () => {
            console.log("User disconnected");
            await User.findByIdAndUpdate(socket.data.userId, { online: false });
            socket.leave(socket.data.userId);
            console.log(socket.rooms);
        });

        // Join Room (channel)
        socket.on("joinChannel", (data) => {
            socket.join(data.room);
            console.log(`Joined channel ${data.room}`);
            console.log(socket.rooms);
        });

        // Leave Room (channel)
        socket.on("leaveChannel", (data) => {
            socket.leave(data.room);
            console.log(`Left channel ${data.room}`);
            console.log(socket.rooms);
        });

        // Send message to channel
        socket.on("sendMessage", (data) => {
            console.log("Sending message");
            socket.to(data.room).emit("receiveMessage");
        });
    });

    return server;
}

module.exports = setSocketServer;

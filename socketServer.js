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
        // TODO: Need to check if logged in and set online status accordingly

        // After successful log in
        socket.on("loggedIn", async (data) => {
            socket.data.userId = data.userId;
            await User.findByIdAndUpdate(data.userId, { online: true });
        });

        socket.on("disconnect", async () => {
            console.log("user disconnected");
            await User.findByIdAndUpdate(socket.data.userId, { online: false });
        });

        // Join Room (channel)
        socket.on("joinChannel", (data) => {
            socket.join(data.room);
        });

        // Leave Room (channel)
        socket.on("leaveChannel", (data) => {
            socket.leave(data.room);
        });

        // Send message to channel
        socket.on("sendMessage", (data) => {
            socket.to(data.room).emit("receiveMessage");
        });
    });

    return server;
}

module.exports = setSocketServer;

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

            // TODO: Maybe create room with all friends instead to emit to
            io.to(data.userId).emit("receiveOnline");
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

        // Join Room (channel._id)
        socket.on("joinRoom", (data) => {
            socket.join(data.room);
            console.log(`Joined Room ${data.room}`);
            console.log(socket.rooms);
        });

        // Join Rooms to receive updates on channel
        socket.on("joinRooms", (data) => {
            socket.join(data.rooms);
            console.log(socket.rooms);
        });

        // Leave Room (channel._id)
        socket.on("leaveRoom", (data) => {
            socket.leave(data.room);
            console.log(`Left Room ${data.room}`);
            console.log(socket.rooms);
        });

        // Create Channel
        socket.on("createChannel", (data) => {
            console.log("Creating channel");

            // Emit to each user id
            data.users.forEach((userId) => {
                io.to(userId).emit("receiveChannelCreate");
            });
        });

        // Update Channel
        socket.on("updateChannel", (data) => {
            console.log("Updating channel");
            io.to(data.room).emit("receiveChannelUpdate");

            // If adding new users
            if (data.users) {
                // Emit to each user id
                data.users.forEach((userId) => {
                    io.to(userId).emit("receiveChannelCreate");
                });
            }
        });

        // Delete Channel
        socket.on("deleteChannel", (data) => {
            console.log("Deleting channel");
            io.to(data.room).emit("receiveChannelUpdate");

            // Make all socket instances leave the specified room
            io.socketsLeave(data.room);
        });

        // Update Message (Send, Update, Delete) in Channel
        socket.on("updateMessage", (data) => {
            console.log("Updating message");
            io.to(data.room).emit("receiveMessageUpdate");
        });
    });

    return server;
}

module.exports = setSocketServer;

const http = require("http");
const { Server } = require("socket.io");

const User = require("./models/user");
const Friend = require("./models/friend");

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

        // On socket disconnect
        socket.on("disconnect", async () => {
            if (socket.data.userId) {
                await User.findByIdAndUpdate(socket.data.userId, {
                    online: false,
                });

                // Emit to friends that you are offline
                const friends = await Friend.find({ user: data.userId });
                if (friends.length) {
                    friends.forEach((friend) => {
                        io.to(friend.targetUser.valueOf()).emit(
                            "receiveFriendOnline"
                        );
                    });
                }
            }
        });

        // Sets user status to online
        socket.on("online", async (data) => {
            socket.data.userId = data.userId;

            await User.findByIdAndUpdate(data.userId, { online: true });
            socket.join(data.userId);

            io.to(data.userId).emit("receiveOnline");

            // Emit to friends that you are online
            const friends = await Friend.find({ user: data.userId });
            if (friends.length) {
                friends.forEach((friend) => {
                    io.to(friend.targetUser.valueOf()).emit(
                        "receiveFriendOnline"
                    );
                });
            }
        });

        // Sets user status to offline
        socket.on("offline", async (data) => {
            await User.findByIdAndUpdate(data.userId, { online: false });

            // Emit to friends that you are offline
            const friends = await Friend.find({ user: data.userId });
            if (friends.length) {
                friends.forEach((friend) => {
                    io.to(friend.targetUser.valueOf()).emit(
                        "receiveFriendOnline"
                    );
                });
            }

            // Leave all rooms
            socket.rooms.forEach((room) => {
                if (room != socket.id) {
                    socket.leave(room);
                }
            });
        });

        // Join Rooms to receive updates on channel
        socket.on("joinRooms", (data) => {
            socket.join(data.rooms);
        });

        // Leave Room (channel._id)
        socket.on("leaveRoom", (data) => {
            socket.leave(data.room);
        });

        // Update Friends Status
        socket.on("updateFriend", (data) => {
            // Send to friend
            if (data.friends.length) {
                data.friends.forEach((friendUserId) => {
                    io.to(friendUserId).emit("receiveFriendUpdate");
                });
            }
        });

        // Create Channel
        socket.on("createChannel", (data) => {
            // Emit to each user id
            if (data.users.length) {
                data.users.forEach((userId) => {
                    io.to(userId).emit("receiveChannelCreate");
                });
            }
        });

        // Update Channel
        socket.on("updateChannel", (data) => {
            io.to(data.room).emit("receiveChannelUpdate");

            // If adding new users
            if (data.users && data.users.length) {
                // Emit to each user id
                data.users.forEach((userId) => {
                    io.to(userId).emit("receiveChannelCreate");
                });
            }
        });

        // Delete Channel
        socket.on("deleteChannel", (data) => {
            io.to(data.room).emit("receiveChannelUpdate");

            // Make all socket instances leave the specified room
            io.socketsLeave(data.room);
        });

        // Update Message (Send, Update, Delete) in Channel
        socket.on("updateMessage", (data) => {
            io.to(data.room).emit("receiveMessageUpdate");
        });
    });

    return server;
}

module.exports = setSocketServer;

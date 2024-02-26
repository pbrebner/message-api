const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const userController = require("../controllers/userController");
const friendController = require("../controllers/friendController");
const messageController = require("../controllers/messageController");
const channelController = require("../controllers/channelController");

/* GET home page. */
router.get("/", function (req, res, next) {
    res.send("API Test");
});

// AUTH ROUTES

router.post("/login", authController.login);

router.post("/refresh", authController.refresh);

router.post("/logout", authController.logout);

// USER ROUTES

router.get("/users", authController.verifyToken, userController.getAllUsers);

router.post("/users", userController.createUser);

router.get(
    "/users/:userId",
    authController.verifyToken,
    userController.getUser
);

router.put(
    "users/:userId",
    authController.verifyToken,
    userController.updateUser
);

router.delete(
    "users/:userId",
    authController.verifyToken,
    userController.deleteUser
);

// FRIEND ROUTES

router.get(
    "/users/:userId/friends",
    authController.verifyToken,
    friendController.getAllUserFriends
);

router.post(
    "/users/:userId/friends",
    authController.verifyToken,
    friendController.createFriend
);

router.get(
    "/users/:userId/friends/:friendId",
    authController.verifyToken,
    friendController.getFriend
);

router.put(
    "/users/:userId/friends/:friendId",
    authController.verifyToken,
    friendController.updateFriend
);

router.delete(
    "/users/:userId/friends/:friendId",
    authController.verifyToken,
    friendController.deleteFriend
);

// CHANNEL ROUTES

router.get(
    "/channels",
    authController.verifyToken,
    channelController.getAllUserChannels
);

router.post(
    "/channels",
    authController.verifyToken,
    channelController.createChannel
);

router.get(
    "/channels/:channelId",
    authController.verifyToken,
    channelController.getChannel
);

router.put(
    "/channels/:channelId",
    authController.verifyToken,
    channelController.updateChannel
);

router.delete(
    "/channels/:channelId",
    authController.verifyToken,
    channelController.deleteChannel
);

// MESSAGE ROUTES

router.get(
    "/channels/:channelId/messages",
    authController.verifyToken,
    messageController.getAllChannelMessages
);

router.post(
    "/channels/:channelId/messages",
    authController.verifyToken,
    messageController.createMessage
);

router.get(
    "/channels/:channelId/messages/:messageId",
    authController.verifyToken,
    messageController.getMessage
);

router.put(
    "/channels/:channelId/messages/:messageId",
    authController.verifyToken,
    messageController.updateMessage
);

router.delete(
    "/channels/:channelId/messages/:messageId",
    authController.verifyToken,
    messageController.deleteMessage
);

module.exports = router;

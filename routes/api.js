const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const userController = require("../controllers/userController");
const messageController = require("../controllers/messageController");
const channelController = require("../controllers/channelController");

/* GET home page. */
router.get("/", function (req, res, next) {
    res.send("API Test");
});

// AUTH ROUTES

router.post("/login", authController.login);

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

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

router.get("/users", userController.getAllUsers);

router.post("/users", userController.createUser);

router.get("/users/:userId", userController.getUser);

router.put("users/:userId", userController.updateUser);

router.delete("users/:userId", userController.deleteUser);

// CHANNEL ROUTES

router.get("/channels", channelController.getAllUserChannels);

router.post("/channels", channelController.createChannel);

router.get("/channels/:channelId", channelController.getChannel);

router.put("/channels/:channelId", channelController.updateChannel);

router.delete("/channels/:channelId", channelController.deleteChannel);

// MESSAGE ROUTES

router.get(
    "/channels/:channelId/messages",
    messageController.getAllChannelMessages
);

router.post("/channels/:channelId/messages", messageController.createMessage);

router.get(
    "/channels/:channelId/messages/:messageId",
    messageController.getMessage
);

router.put(
    "/channels/:channelId/messages/:messageId",
    messageController.updateMessage
);

router.delete(
    "/channels/:channelId/messages/:messageId",
    messageController.deleteMessage
);

module.exports = router;

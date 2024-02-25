const Message = require("../models/message");
const Channel = require("../models/channel");
const { getSignedURL } = require("../controllers/s3Controller");

const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");

exports.getAllChannelMessages = asyncHandler(async (req, res, next) => {
    const channel = await Channel.findById(
        req.params.channelId,
        "users"
    ).exec();

    if (channel.users.includes(req.user._id)) {
        const messages = await Message.find(
            { channel: req.params.channelId },
            "content user likes timeStamp"
        )
            .populate("user", { name: 1, avatar: 1, timeStamp: 1 })
            .sort({ timeStamp: 1 })
            .exec();

        // Get url for uers avatar image
        for (let message of messages) {
            if (message.user.avatar == "") {
                message.user.avatarURL = process.env.DEFAULT_AVATAR;
            } else {
                message.user.avatarURL = await getSignedURL(user.avatar);
            }
        }

        res.json(messages);
    } else {
        res.status(401).json({ error: "Not authorized to view this data." });
    }
});

// TODO: Content can only be text right now. Need to adjust based on model (Images etc.)
// Maybe create an image attribute to message that can be added.
exports.createMessage = [
    body("content", "Message has to be between 1 and 600 characters.")
        .trim()
        .isLength({ min: 1, max: 600 })
        .blacklist("<>"),

    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            res.status(400).json({
                content: req.body.content,
                errors: errors.array(),
            });
            return;
        } else {
            const channel = await Channel.findById(
                req.params.channelId,
                "users"
            ).exec();

            if (channel.users.includes(req.user._id)) {
                const message = new Message({
                    content: req.body.content,
                    user: req.user._id,
                    channel: req.params.channelId,
                });

                await message.save();

                //Add message to channel
                await Channel.findByIdAndUpdate(req.params.channelId, {
                    $push: { messages: message },
                }).exec();

                res.json({
                    messageId: message._id,
                    message: "Message saved successfully.",
                });
            } else {
                res.status(401).json({
                    error: "Not authorized for this action.",
                });
            }
        }
    }),
];

exports.getMessage = asyncHandler(async (req, res, next) => {
    const message = await Message.findOne({ _id: req.params.messageId })
        .populate("user", { name: 1, avatar: 1, timeStamp: 1 })
        .exec();

    if (!message) {
        res.status(404).json({ error: "No entries found in database" });
    } else {
        // Get url for uers avatar image
        if (message.user.avatar == "") {
            message.user.avatarURL = process.env.DEFAULT_AVATAR;
        } else {
            message.user.avatarURL = await getSignedURL(user.avatar);
        }

        res.json(message);
    }
});

// Only likes are capable of being updated at the moment.
exports.updateMessage = [
    body("likes").optional(),
    asyncHandler(async (req, res, next) => {
        const message = await Message.findByIdAndUpdate(req.params.messageId, {
            likes: req.body.likes,
        }).exec();

        if (!message) {
            return res.status(404).json({
                error: `No message with id ${req.params.messageId} exists.`,
            });
        } else {
            res.json({
                messageId: message._id,
                message: "Message likes updated successfully.",
            });
        }
    }),
];

exports.deleteMessage = asyncHandler(async (req, res, next) => {
    const message = await Message.findOne({ _id: req.params.messageId }, "user")
        .populate("user", { name: 1 })
        .exec();

    if (!message) {
        return res.status(404).json({
            error: `No message with id ${req.params.messageId} exists.`,
        });
    }

    // Only the message creator can delete their own message
    if (message.user._id == req.user._id) {
        const message = await Message.findByIdAndDelete(
            req.params.messageId
        ).exec();

        await Channel.findByIdAndUpdate(req.params.channelId, {
            $pull: { messages: message._id },
        }).exec();

        res.json({
            message: "Message deleted successfully.",
            messageId: message._id,
        });
    } else {
        res.status(401).json({ error: "Not authorized for this action." });
    }
});

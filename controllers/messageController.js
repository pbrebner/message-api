const Message = require("../models/message");
const Channel = require("../models/channel");

const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");

exports.getAllChannelMessages = asyncHandler(async (req, res, next) => {
    const messages = await Message.find(
        { channel: req.params.channelId },
        "content user likes timeStamp"
    )
        .populate("user", { name: 1 })
        .sort({ timeStamp: 1 })
        .exec();

    if (!messages) {
        res.status(404).json({ error: "No entries found in database" });
    } else {
        res.json(messages);
    }
});

// TODO: Content can only be text right now. Need to adjust based on model (Images etc.)
// Maybe create an image attribute to message that can be added.
exports.createMessage = [
    body("content", "Message has to be between 1 and 280 characters.")
        .trim()
        .isLength({ min: 1, max: 280 })
        .blacklist("<>"),

    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        const message = new Message({
            content: req.body.content,
            user: req.user._id,
            channel: req.params.channelId,
        });

        if (!errors.isEmpty()) {
            res.status(400).json({
                content: req.body.content,
                errors: errors.array(),
            });
            return;
        } else {
            await message.save();
            //Add message to channel
            await Channel.findByIdAndUpdate(req.params.channelId, {
                $push: { messages: message },
            });
            res.json({ message: "Message saved successfully." });
        }
    }),
];

exports.getMessage = asyncHandler(async (req, res, next) => {
    const message = await Message.findOne({ _id: req.params.messageId })
        .populate("user", { name: 1 })
        .exec();

    if (!message) {
        res.status(404).json({ error: "No entries found in database" });
    } else {
        res.json(message);
    }
});

exports.updateMessage = [
    // Only likes are capable of being updated.
    body("likes").optional(),

    asyncHandler(async (req, res, next) => {
        const message = await Message.findByIdAndUpdate(req.params.messageId, {
            likes: req.body.likes,
        });

        if (!message) {
            return res.status(404).json({
                error: `No message with id ${req.params.messageId} exists.`,
            });
        } else {
            res.json({
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
        const message = await Message.findByIdAndDelete(req.params.messageId);
        await Channel.findByIdAndUpdate(req.params.channelId, {
            $pull: { messages: message._id },
        });

        res.json({
            message: "Message deleted successfully.",
            message: message,
        });
    } else {
        res.status(401).json({ error: "Not authorized for this action." });
    }
});

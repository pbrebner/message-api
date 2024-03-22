const Message = require("../models/message");
const Channel = require("../models/channel");
const {
    uploadFileS3,
    getSignedURL,
    deleteFileS3,
} = require("../controllers/s3Controller");

const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");

// Set up multer to handle file uploads
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const sharp = require("sharp");

exports.getAllChannelMessages = asyncHandler(async (req, res, next) => {
    const channel = await Channel.findById(
        req.params.channelId,
        "users"
    ).exec();

    if (channel.users.includes(req.user._id)) {
        const messages = await Message.find(
            { channel: req.params.channelId, posted: true },
            "content image inResponseTo likes user timeStamp"
        )
            .populate({
                path: "inResponseTo",
                select: "content",
                populate: { path: "user", select: "name" },
            })
            .populate("user", { name: 1, avatar: 1, timeStamp: 1 })
            .sort({ timeStamp: 1 })
            .lean()
            .exec();

        // Get url for for message images
        for (let message of messages) {
            if (message.image != "") {
                message["imageURL"] = await getSignedURL(message.image);
            }

            if (message.user.avatar == "") {
                message.user["avatarURL"] = process.env.DEFAULT_AVATAR;
            } else {
                message.user["avatarURL"] = await getSignedURL(
                    message.user.avatar
                );
            }
        }

        res.json(messages);
    } else {
        res.status(403).json({ error: "Not authorized to view this data." });
    }
});

exports.createMessage = [
    upload.single("image"),
    body("content", "Message text can't be more than 600 characters.")
        .trim()
        .optional()
        .isLength({ max: 600 })
        .blacklist("<>"),
    body("image")
        .trim()
        .optional()
        .custom((value, { req }) => {
            const file = req.file;
            const allowedFileTypes = [
                "image/png",
                "image/jpeg",
                "image/jpg",
                "image/gif",
            ];
            const allowedSize = 10;

            if (!allowedFileTypes.includes(file.mimetype)) {
                throw new Error(
                    "You can only send png, jpeg, jpg or gif file formats."
                );
            } else if (file.size / (1024 * 1024) > allowedSize) {
                throw new Error("File size is too large. 5MB maximum.");
            }
        }),
    body("inResponseTo")
        .trim()
        .optional()
        .custom(async (value) => {
            const message = await Message.findById(value);

            if (!message) {
                throw new Error("Invalid reply target.");
            }
        }),
    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        const channel = await Channel.findById(
            req.params.channelId,
            "users"
        ).exec();

        if (!channel.users.includes(req.user._id)) {
            res.status(403).json({
                error: "Not authorized for this action.",
            });
            return;
        } else if (!errors.isEmpty()) {
            res.status(400).json({
                errors: errors.array(),
            });
            return;
        } else if (!req.body.content && !req.file) {
            res.status(400).json({
                errors: [{ msg: "Can't send empty message." }],
            });
            return;
        } else {
            let content = "";
            let fileName = "";
            let messageImageURL = "";
            let posted = true;

            if (req.body.content) {
                content = req.body.content;
            }

            // Handles resizing the image and uploading to S3
            // Sets posted to false in order to create new message but not post
            // Populates messageImageURL to pass to front-end for image preview
            if (req.file) {
                // Change the size of the image
                //const fileBuffer = await sharp(req.file.buffer)
                //    .resize({ height: 1440, width: 2560, fit: "contain" })
                //    .toBuffer();

                fileName = await uploadFileS3(req.file, req.file.buffer);
                messageImageURL = await getSignedURL(fileName);
                posted = false;
            }

            if (req.body.inResponseTo) {
                // Create Message
                const message = new Message({
                    content: content,
                    image: fileName,
                    inResponseTo: req.body.inResponseTo,
                    posted: posted,
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
                    messageImageURL: messageImageURL,
                    message: "Message saved successfully.",
                });
            } else {
                // Create Message
                const message = new Message({
                    content: content,
                    image: fileName,
                    posted: posted,
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
                    messageImageURL: messageImageURL,
                    message: "Message saved successfully.",
                });
            }
        }
    }),
];

exports.getMessage = asyncHandler(async (req, res, next) => {
    const message = await Message.findOne({ _id: req.params.messageId })
        .populate({
            path: "inResponseTo",
            select: "content",
            populate: { path: "user", select: "name" },
        })
        .populate("user", { name: 1, avatar: 1, timeStamp: 1 })
        .lean()
        .exec();

    if (!message) {
        return res.status(404).json({ error: "No entries found in database" });
    } else {
        if (message.image != "") {
            message["imageURL"] = await getSignedURL(message.image);
        }

        // Get url for uers avatar image
        if (message.user.avatar == "") {
            message.user["avatarURL"] = process.env.DEFAULT_AVATAR;
        } else {
            message.user["avatarURL"] = await getSignedURL(message.user.avatar);
        }

        res.json(message);
    }
});

exports.updateMessage = [
    body("content", "Message text can't be more than 600 characters.")
        .trim()
        .optional()
        .isLength({ max: 600 })
        .blacklist("<>"),
    body("inResponseTo")
        .trim()
        .optional()
        .custom(async (value) => {
            const message = await Message.findById(value);

            if (!message) {
                throw new Error("Invalid reply target.");
            }
        }),
    body("likes", "Invalid input.").optional().isNumeric(),
    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        const channel = await Channel.findById(
            req.params.channelId,
            "users"
        ).exec();
        const message = await Message.findById(req.params.messageId).exec();

        if (!channel.users.includes(req.user._id)) {
            res.status(403).json({
                error: "Not authorized for this action.",
            });
            return;
        } else if (!message) {
            res.status(404).json({
                error: `No message with id ${req.params.messageId} exists.`,
            });
            return;
        } else if (!errors.isEmpty()) {
            res.status(400).json({
                errors: errors.array(),
            });
            return;
        } else if (!req.body.content && !message.content && !message.image) {
            res.status(400).json({
                errors: [{ msg: "Can't send empty message." }],
            });
            return;
        } else {
            let content = "";
            if (req.body.content) {
                content = req.body.content;
            }

            if (req.body.inResponseTo) {
                await Message.findByIdAndUpdate(req.params.messageId, {
                    content: content,
                    inResponseTo: req.body.inResponseTo,
                    likes: req.body.likes || message.likes,
                    posted: true,
                }).exec();
            } else {
                await Message.findByIdAndUpdate(req.params.messageId, {
                    content: content,
                    likes: req.body.likes || message.likes,
                    posted: true,
                }).exec();
            }

            res.json({
                messageId: message._id,
                message: "Message updated successfully.",
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

        // Delete image off s3 bucket if not empty
        if (message.image != "") {
            await deleteFileS3(message.image);
        }

        await Channel.findByIdAndUpdate(req.params.channelId, {
            $pull: { messages: message._id },
        }).exec();

        res.json({
            message: "Message deleted successfully.",
            messageId: message._id,
        });
    } else {
        res.status(403).json({ error: "Not authorized for this action." });
    }
});

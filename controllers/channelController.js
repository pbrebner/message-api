const Channel = require("../models/channel");
const User = require("../models/user");
const Message = require("../models/message");

const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");

exports.getAllUserChannels = asyncHandler(async (req, res, next) => {
    const channels = await Channel.find(
        { users: { $in: req.user._id } },
        "title users timeStamp"
    )
        .populate("users", { name: 1 })
        .exec();

    if (!channels) {
        res.status(404).json({ error: "No entries found in database" });
    } else {
        res.json(channels);
    }
});

// TODO: Maybe add custom validator to confirm users are all valid ObjectId
// TODO: Decide if I want to add current user to userList on frontend or push from backend (below)
// TODO: Need to figure out what I'm passing back for the users
exports.createChannel = [
    body("title", "Title can't be more than 30 characters.")
        .trim()
        .isLength({ max: 30 })
        .optional()
        .blacklist("<>"),
    body("users", "At least one user is required.").trim().notEmpty(),
    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        const userList = req.body.users;
        userList.push(req.user._id);

        const channel = new Channel({
            title: req.body.title || "",
            users: userList,
        });

        if (!errors.isEmpty()) {
            // Inform client post had errors
            res.status(400).json({
                channel: channel,
                errors: errors.array(),
            });
            return;
        } else {
            await channel.save();

            //Add channel to all users
            userList.forEach(async (element) => {
                await User.findByIdAndUpdate(element, {
                    $push: { channels: channel },
                });
            });

            // Inform client post was saved
            res.json({ message: "Channel successfully created." });
        }
    }),
];

exports.getChannel = asyncHandler(async (req, res, next) => {
    const channel = await Channel.findOne(
        { _id: req.params.channelId },
        "title users timeStamp"
    )
        .populate("users", { name: 1, bio: 1, avatar: 1, timeStamp: 1 })
        .exec();

    if (!channel) {
        // Inform client that no channel was found
        res.status(404).json({ error: "Channel not found" });
    } else {
        res.json(channel);
    }
});

// TODO: Add way to add or remove users (Limit the users somehow)
exports.updateChannel = [
    body("title", "Title can't be more than 30 characters.")
        .trim()
        .isLength({ max: 30 })
        .optional()
        .blacklist("<>"),
    body("users", "At least one user is required.").trim().notEmpty(),
    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        const channel = await Channel.findOne(
            { _id: req.params.channelId },
            "users"
        ).exec();

        if (!channel) {
            return res.status(404).json({
                error: `No channel with id ${req.params.channelId} exists.`,
            });
        }

        // TEST TO SEE WHAT CHANNEL.USERS LOOKS LIKE
        res.json({ message: "test test test", users: channel.users });

        // Can only be updated by channel users
        if (channel.users.includes(req.user._id)) {
            if (!errors.isEmpty()) {
                // Inform client channel update had errors
                res.status(400).json({
                    channel: {
                        title: req.body.title || channel.title,
                    },
                    errors: errors.array(),
                });
                return;
            } else {
                const updatedChannel = await Channel.findByIdAndUpdate(
                    req.params.channelId,
                    {
                        title: req.body.title || channel.title,
                        users: req.body.users || channel.users,
                    }
                );

                res.json({
                    message: "Channel updated successfully.",
                    chanel: updatedChannel,
                });
            }
        } else {
            res.status(401).json({
                error: "Not authorized for this action.",
            });
        }
    }),
];

exports.deleteChannel = asyncHandler(async (req, res, next) => {
    const channel = await Channel.findOne(
        { _id: req.params.channelId },
        "users"
    ).exec();

    if (!channel) {
        return res.status(404).json({
            error: `No channel with id ${req.params.channelId} exists`,
        });
    }

    if (channel.users.includes(req.user._id)) {
        const channel = await Channel.findByIdAndDelete(req.params.channelId);

        // Delete all channel messages (Delete only users?)
        await Message.deleteMany({
            channel: req.params.channelId,
        });

        // TODO: Decide if I want to delete channel from all users?
        // Currentl deletes from all users
        channel.users.forEach(async (element) => {
            await User.findByIdAndUpdate(element, {
                $pull: { channels: req.params.channelId },
            });
        });

        res.json({ message: "Channel deleted successfully", channel: channel });
    } else {
        res.status(401).json({
            error: "Not authorized for this action.",
        });
    }
});

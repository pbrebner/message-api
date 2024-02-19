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
        .populate("users", { name: 1, avatar: 1, timeStamp: 1 })
        .exec();

    if (!channels) {
        res.status(404).json({ error: "No entries found in database" });
    } else {
        res.json(channels);
    }
});

exports.createChannel = [
    body("title", "Title can't be more than 30 characters.")
        .trim()
        .isLength({ max: 30 })
        .optional()
        .blacklist("<>"),
    body("users", "Must be between 1 and 9 users.")
        .isArray({ min: 1, max: 9 })
        .custom(async (users, { req }) => {
            req.body.userList = [];
            const currentUser = await User.findById(req.user._id).exec();

            users.forEach(async (value) => {
                const user = await User.find({ name: value }).exec();

                if (!user) {
                    throw new Error(`No user with ${value} exists.`);
                } else if (!currentUser.friends.includes(user._id)) {
                    throw new Error(
                        `You can only send Direct Messages to friends. Please remove ${value}.`
                    );
                } else {
                    req.body.userList.push(user._id);
                }
            });
            req.body.userList.push(req.user._id);
        }),
    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            // Inform client post had errors
            res.status(400).json({
                errors: errors.array(),
            });
            return;
        } else {
            const userList = req.body.userList;

            // Check if channel with these users already exists
            const channelCheck = await Channel.find({
                $and: [
                    { users: { $all: userList } },
                    { users: { $size: userList.length } },
                ],
            }).exec();

            if (channelCheck) {
                // Inform client Channel already Exists
                res.json({
                    channelId: channelCheck._id,
                    message: "Redirecting to Existing Channel.",
                });
            }

            // If channel doesn't already exist
            const channel = new Channel({
                title: req.body.title || "",
                users: userList,
            });

            await channel.save();

            //Add channel to all users
            userList.forEach(async (element) => {
                await User.findByIdAndUpdate(element, {
                    $push: { channels: channel },
                }).exec();
            });

            // Inform client channel was saved
            res.json({
                channelId: channel._id,
                message: "Channel successfully created.",
            });
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

exports.updateChannel = [
    body("title", "Title can't be more than 30 characters.")
        .trim()
        .isLength({ max: 30 })
        .optional()
        .blacklist("<>"),
    body("users", "Can't update more than one channel user.")
        .isArray({ max: 1 })
        .custom(async (users, { req }) => {
            const currentUser = await User.findById(req.user._id).exec();

            users.forEach(async (value) => {
                const user = await User.find({ name: value }).exec();

                if (!user) {
                    throw new Error(`No user with ${value} exists.`);
                } else if (!currentUser.friends.includes(user._id)) {
                    throw new Error(
                        `You can only send Direct Messages to friends.`
                    );
                } else {
                    req.body.userUpdate = user._id;
                }
            });
        })
        .optional(),
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

        // Can only be updated by channel users
        if (channel.users.includes(req.user._id)) {
            if (!errors.isEmpty()) {
                // Inform client channel update had errors
                res.status(400).json({
                    errors: errors.array(),
                });
                return;
            } else {
                const userList = channel.users;

                // Prepares the userList and sends status 400 errors if userList is too long or short
                if (req.body.users) {
                    if (userList.includes(req.body.userUpdate)) {
                        userList = userList.filter(
                            (user) => user != req.body.userUpdate
                        );
                    } else {
                        userList.push(req.body.userUpdate);
                    }

                    if (userList.length > 10) {
                        res.status(400).json({
                            errors: ["Can't have more than 10 channel users."],
                        });
                    }

                    if (userList.length < 2) {
                        res.status(400).json({
                            errors: ["Can't have less than 2 channel users."],
                        });
                    }
                }

                const updatedChannel = await Channel.findByIdAndUpdate(
                    req.params.channelId,
                    {
                        title: req.body.title || channel.title,
                        users: userList,
                    }
                ).exec();

                res.json({
                    message: "Channel updated successfully.",
                    channelId: updatedChannel._id,
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
        const channel = await Channel.findByIdAndDelete(
            req.params.channelId
        ).exec();

        // Delete all channel messages
        await Message.deleteMany({
            channel: req.params.channelId,
        }).exec();

        // TODO: Decide if I want to delete channel from all users?
        // Currently deletes from all users
        channel.users.forEach(async (element) => {
            await User.findByIdAndUpdate(element, {
                $pull: { channels: req.params.channelId },
            }).exec();
        });

        res.json({
            message: "Channel deleted successfully",
            channelId: channel._id,
        });
    } else {
        res.status(401).json({
            error: "Not authorized for this action.",
        });
    }
});

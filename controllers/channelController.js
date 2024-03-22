const Channel = require("../models/channel");
const User = require("../models/user");
const Friend = require("../models/friend");
const Message = require("../models/message");
const { getSignedURL } = require("../controllers/s3Controller");

const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");

exports.getAllUserChannels = asyncHandler(async (req, res, next) => {
    const channels = await Channel.find(
        { users: { $in: req.user._id } },
        "title users timeStamp"
    )
        .populate("users", { name: 1, avatar: 1, timeStamp: 1 })
        .lean()
        .exec();

    // Get url for uers avatar image
    for (let channel of channels) {
        for (let user of channel.users) {
            if (user.avatar == "") {
                user["avatarURL"] = process.env.DEFAULT_AVATAR;
            } else {
                user["avatarURL"] = await getSignedURL(user.avatar);
            }
        }
    }

    res.json(channels);
});

exports.createChannel = [
    body("title", "Title can't be more than 30 characters.")
        .trim()
        .isLength({ max: 30 })
        .optional()
        .blacklist("<>"),
    body("users", "Must be between 1 and 5 users.").isArray({ min: 1, max: 5 }),
    body("users.*").custom(async (value, { req }) => {
        const user = await User.findById(value).exec();
        const friend = await Friend.findOne({
            user: req.user._id,
            targetUser: user && user._id,
        }).exec();

        if (!user) {
            throw new Error(`User does not exist.`);
        } else if (!friend || friend.status != 3) {
            throw new Error(
                `You can only initiate Direct Messages with friends.`
            );
        }
    }),
    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            // Inform client post had errors
            return res.status(400).json({
                errors: errors.array(),
            });
        } else {
            // Get userList and add current user
            const userList = req.body.users;
            userList.push(req.user._id);

            // Check if channel with these users already exists
            // TODO: Check if channel title is different
            const channelCheck = await Channel.findOne({
                $and: [
                    { users: { $all: userList } },
                    { users: { $size: userList.length } },
                ],
            }).exec();

            if (channelCheck) {
                // Inform client Channel already Exists
                res.json({
                    channelId: channelCheck._id,
                    newChannel: false,
                    message: "Redirecting to Existing Channel.",
                });
                return;
            } else {
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
                    newChannel: true,
                    message: "Channel successfully created.",
                });
            }
        }
    }),
];

exports.getChannel = asyncHandler(async (req, res, next) => {
    const channel = await Channel.findOne(
        { _id: req.params.channelId },
        "title users timeStamp"
    )
        .populate("users", { name: 1, bio: 1, avatar: 1, timeStamp: 1 })
        .lean()
        .exec();

    if (!channel) {
        // Inform client that no channel was found
        return res.status(404).json({ error: "Channel not found" });
    } else {
        // Get url for uers avatar image
        for (let user of channel.users) {
            if (user.avatar == "") {
                user["avatarURL"] = process.env.DEFAULT_AVATAR;
            } else {
                user["avatarURL"] = await getSignedURL(user.avatar);
            }
        }

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
        .optional(),
    body("users.*")
        .custom(async (value, { req }) => {
            const user = await User.findById(value).exec();
            const friend = await Friend.findOne({
                user: req.user._id,
                targetUser: user && user._id,
            }).exec();

            if (!user) {
                throw new Error(`User does not exist.`);
            } else if (!friend || friend.status != 3) {
                throw new Error(
                    `You can only send Direct Messages with friends.`
                );
            }
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
                return res.status(400).json({
                    errors: errors.array(),
                });
            } else {
                const userList = channel.users;

                // Prepares the userList and sends status 400 errors if userList is too long or short
                if (req.body.users) {
                    if (userList.includes(req.body.users[0])) {
                        userList = userList.filter(
                            (user) => user != req.body.users[0]
                        );
                    } else {
                        userList.push(req.body.users[0]);
                    }

                    if (userList.length > 6) {
                        return res.status(400).json({
                            errors: [
                                {
                                    msg: "Can't have more than 6 channel users.",
                                },
                            ],
                        });
                    }

                    if (userList.length < 2) {
                        return res.status(400).json({
                            errors: [
                                {
                                    msg: "Can't have less than 2 channel users.",
                                },
                            ],
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
            res.status(403).json({
                error: "Not authorized for this action.",
            });
        }
    }),
];

exports.deleteChannel = asyncHandler(async (req, res, next) => {
    const channel = await Channel.findById(
        req.params.channelId,
        "users"
    ).exec();

    if (!channel) {
        return res.status(404).json({
            error: `No channel with id ${req.params.channelId} exists`,
        });
    }

    // Can only be deleted by channel user
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
        res.status(403).json({
            error: "Not authorized for this action.",
        });
    }
});

const Friend = require("../models/friend");
const User = require("../models/user");

const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");

exports.getAllUserFriends = asyncHandler(async (req, res, next) => {
    if (req.user._id === req.params.userId) {
        const friends = await Friend.find({ _id: req.user._id })
            .populate("requester", { name: 1, avatar: 1, timeStamp: 1 })
            .populate("recipient", { name: 1, avatar: 1, timeStamp: 1 })
            .exec();

        if (!friends) {
            res.status(404).json({ error: "No entries found in database." });
        } else {
            res.json(friends);
        }
    } else {
        res.status(401).json({
            error: "Not authorized for this action.",
        });
    }
});

exports.createFriend = [
    body("recipient", "Have to specify a user")
        .trim()
        .notEmpty()
        .custom(async (value, { req }) => {
            const user = await User.find({ name: value }).exec();

            if (!user) {
                throw new Error(`No user with ${value} exists.`);
            } else {
                req.body.recipientId = user._id;
            }
        }),

    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        if (req.user._id === req.params.userId) {
            if (!errors.isEmpty()) {
                res.status(400).json({
                    errors: errors.array(),
                });
            } else {
                //Create friend object with data
                const friend = new Friend({
                    requester: req.user._id,
                    recipient: req.body.recipientId,
                    status: req.body.status,
                });

                await friend.save();

                // Update users with friend object
                await User.findByIdAndUpdate(friend.requester, {
                    $push: { friends: friend },
                }).exec();
                await User.findByIdAndUpdate(friend.recipient, {
                    $push: { friends: friend },
                }).exec();

                res.json({
                    friendId: friend._id,
                    message: "Friend successfully created.",
                });
            }
        } else {
            res.status(401).json({
                error: "Not authorized for this action.",
            });
        }
    }),
];

exports.getFriend = asyncHandler(async (req, res, next) => {
    if (req.user._id === req.params.userId) {
        const friend = await Friend.findById(req.params.friendId).exec();

        if (!friend) {
            // Inform client that friend was not found
            res.status(404).json({ error: "Friend not found." });
        } else {
            res.json({ friend: friend });
        }
    } else {
        res.status(401).json({
            error: "Not authorized for this action.",
        });
    }
});

exports.updateFriend = [
    body("status").trim(),
    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        if (req.user._id === req.params.userId) {
            if (!errors.isEmpty()) {
                res.status(400).json({
                    errors: errors.array(),
                });
            } else {
                res.json({
                    friendId: friend._id,
                    message: "Friend successfully updated.",
                });
            }
        } else {
            res.status(401).json({
                error: "Not authorized for this action.",
            });
        }
    }),
];

exports.deleteFriend = asyncHandler(async (req, res, next) => {
    if (req.user._id === req.params.userId) {
        const friend = await Friend.findByIdAndDelete(req.params.friendId);

        if (!friend) {
            return res.status(404).json({ error: `Friend doesn't exists` });
        } else {
            await User.findByIdAndUpdate(friend.requester, {
                $pull: { friends: friend._id },
            });
            await User.findByIdAndUpdate(friend.recipient, {
                $pull: { friends: friend._id },
            });
        }
    } else {
        res.status(401).json({ error: "Not authorized for this action." });
    }
});

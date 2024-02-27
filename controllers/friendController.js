const Friend = require("../models/friend");
const User = require("../models/user");
const { getSignedURL } = require("../controllers/s3Controller");

const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");

exports.getAllUserFriends = asyncHandler(async (req, res, next) => {
    if (req.user._id === req.params.userId) {
        const friends = await Friend.find({ user: req.user._id })
            .populate("targetUser", {
                name: 1,
                avatar: 1,
                online: 1,
                timeStamp: 1,
            })
            .lean()
            .exec();

        // Get url for uers avatar image
        for (let friend of friends) {
            if (friend.targetUser.avatar == "") {
                friend.targetUser["avatarURL"] = process.env.DEFAULT_AVATAR;
            } else {
                friend.targetUser["avatarURL"] = await getSignedURL(
                    friend.targetUser.avatar
                );
            }
        }

        res.json(friends);
    } else {
        res.status(401).json({
            error: "Not authorized for this action.",
        });
    }
});

exports.createFriend = [
    body("targetUser", "Have to specify a user.")
        .trim()
        .notEmpty()
        .custom(async (value, { req }) => {
            const user = await User.find({ name: value }).exec();
            const friend = await Friend.find({
                user: req.user._id,
                targetUser: user._id || "",
            }).exec();

            if (!user) {
                throw new Error(`No user with ${value} exists.`);
            } else if (friend && friend.status == 3) {
                throw new Error("You are already friends with this user.");
            } else if (friend && friend.status == 2) {
                throw new Error(
                    "This user has already sent you a friend request."
                );
            } else if (friend && friend.status == 1) {
                throw new Error(
                    "You have already sent this user a friend request."
                );
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
                //Create both friend objects with data
                const friendRequester = new Friend({
                    user: req.user._id,
                    targetUser: req.body.recipientId,
                    status: 1,
                });
                await friendRequester.save();

                const friendReceiver = new Friend({
                    user: req.body.recipientId,
                    targetUser: req.user._id,
                    status: 2,
                });
                await friendReceiver.save();

                // Update users with their respective friend object
                await User.findByIdAndUpdate(req.user._id, {
                    $push: { friends: friendRequester._id },
                }).exec();
                await User.findByIdAndUpdate(req.body.recipientId, {
                    $push: { friends: friendReceiver._id },
                }).exec();

                res.json({
                    friendId: friendRequester._id,
                    message: "Friend Request successfully sent.",
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
        const friend = await Friend.findById(req.params.friendId)
            .populate("targetUser", {
                name: 1,
                bio: 1,
                avatar: 1,
                online: 1,
                timeStamp: 1,
            })
            .lean()
            .exec();

        if (!friend) {
            // Inform client that friend was not found
            return res.status(404).json({ error: "Friend not found." });
        } else {
            // Get url for uers avatar image
            if (friend.targetUser.avatar == "") {
                friend.targetUser["avatarURL"] = process.env.DEFAULT_AVATAR;
            } else {
                friend.targetUser["avatarURL"] = await getSignedURL(
                    friend.targetUser.avatar
                );
            }

            res.json({ friend: friend });
        }
    } else {
        res.status(401).json({
            error: "Not authorized for this action.",
        });
    }
});

exports.updateFriend = asyncHandler(async (req, res, next) => {
    if (req.user._id === req.params.userId) {
        const friendA = await Friend.findByIdAndUpdate(req.params.friendId, {
            $set: { status: 3 },
        }).exec();

        if (!friendA) {
            // Inform client that friend was not found
            return res.status(404).json({ error: "Friend not found." });
        } else {
            const friendB = await Friend.findByIdAndUpdate(friendA.targetUser, {
                $set: { status: 3 },
            }).exec();

            res.json({
                friendId: friendA._id,
                message: "Friend successfully updated.",
            });
        }
    } else {
        res.status(401).json({
            error: "Not authorized for this action.",
        });
    }
});

exports.deleteFriend = asyncHandler(async (req, res, next) => {
    if (req.user._id === req.params.userId) {
        const friendA = await Friend.findByIdAndDelete(
            req.params.friendId
        ).exec();

        if (!friendA) {
            return res.status(404).json({ error: "Error finding Friend" });
        } else {
            const friendB = await Friend.findByIdAndDelete(
                friendA.targetUser
            ).exec();

            await User.findByIdAndUpdate(friendA.user, {
                $pull: { friends: friendA._id },
            }).exec();
            await User.findByIdAndUpdate(friendB.user, {
                $pull: { friends: friendB._id },
            }).exec();
        }
    } else {
        res.status(401).json({ error: "Not authorized for this action." });
    }
});

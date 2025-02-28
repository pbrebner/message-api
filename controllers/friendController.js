const Friend = require("../models/friend");
const User = require("../models/user");
const { getSignedURL } = require("../controllers/s3Controller");

const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");

exports.getAllUserFriends = asyncHandler(async (req, res, next) => {
    // Checks if users token id matches params id
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

        // Get url for users avatar image
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
        res.status(403).json({
            error: "Not authorized for this action.",
        });
    }
});

exports.createFriend = [
    body("targetUser", "Have to specify a users name.")
        .trim()
        .notEmpty()
        .custom(async (value, { req }) => {
            const user = await User.findOne({ name: value }).exec();

            if (!user) {
                throw new Error(`No user with name "${value}" exists.`);
            } else {
                // Checks if a friend request already exists and what the status is
                const friend = await Friend.findOne({
                    user: req.user._id,
                    targetUser: user._id,
                }).exec();

                if (friend && friend.status == 3) {
                    throw new Error(`You are already friends with ${value}.`);
                } else if (friend && friend.status == 2) {
                    throw new Error(
                        `${value} has already sent you a friend request.`
                    );
                } else if (friend && friend.status == 1) {
                    throw new Error(
                        `You have already sent ${value} a friend request.`
                    );
                } else {
                    // If no existing friend request, save recipient Id for friend creation
                    req.body.recipientId = user._id;
                }
            }
        }),

    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        // Checks if users token id matches params id
        if (req.user._id === req.params.userId) {
            if (!errors.isEmpty()) {
                res.status(400).json({
                    errors: errors.array(),
                });
                return;
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
                    targetUser: req.body.recipientId,
                    message: "Friend Request successfully sent.",
                });
            }
        } else {
            res.status(403).json({
                error: "Not authorized for this action.",
            });
        }
    }),
];

exports.getFriend = asyncHandler(async (req, res, next) => {
    // Checks if users token id matches params id
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
        res.status(403).json({
            error: "Not authorized for this action.",
        });
    }
});

exports.updateFriend = asyncHandler(async (req, res, next) => {
    // Checks if users token id matches params id
    if (req.user._id === req.params.userId) {
        // Get both friend database entries
        const friendA = await Friend.findById(req.params.friendId).exec();

        if (!friendA) {
            // Inform client that friend was not found
            return res.status(404).json({ error: "Friend not found." });
        } else {
            const friendB = await Friend.findOne({
                user: friendA.targetUser,
                targetUser: friendA.user,
            }).exec();

            if (!friendB) {
                // If friendB doesn't exist then friendA is removed as it doesn't have a match
                await Friend.findByIdAndDelete(req.params.friendId).exec();

                return res.status(404).json({ error: "Friend not found." });
            } else {
                // Updates both friend entries with status of 3 (friends)
                await Friend.findByIdAndUpdate(friendA._id, {
                    $set: { status: 3 },
                }).exec();

                await Friend.findByIdAndUpdate(friendB._id, {
                    $set: { status: 3 },
                }).exec();

                res.json({
                    friendId: friendA._id,
                    targetUser: friendA.targetUser,
                    message: "Friend successfully updated.",
                });
            }
        }
    } else {
        res.status(403).json({
            error: "Not authorized for this action.",
        });
    }
});

exports.deleteFriend = asyncHandler(async (req, res, next) => {
    // Checks if users token id matches params id
    if (req.user._id === req.params.userId) {
        const friendA = await Friend.findByIdAndDelete(
            req.params.friendId
        ).exec();

        if (!friendA) {
            return res.status(404).json({ error: "Error finding Friend" });
        } else {
            // Delete the opposite friend entry and update both users involved
            const friendB = await Friend.findOneAndDelete({
                user: friendA.targetUser,
                targetUser: friendA.user,
            }).exec();

            await User.findByIdAndUpdate(friendA.user, {
                $pull: { friends: friendA._id },
            }).exec();
            await User.findByIdAndUpdate(friendB.user, {
                $pull: { friends: friendB._id },
            }).exec();

            res.json({
                message: "Friend deleted successfully.",
                friendId: friendA._id,
                targetUser: friendA.targetUser,
            });
        }
    } else {
        res.status(403).json({ error: "Not authorized for this action." });
    }
});

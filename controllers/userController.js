const User = require("../models/user");
const Channel = require("../models/channel");
const Message = require("../models/message");

const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");

exports.getAllUsers = asyncHandler(async (req, res, next) => {
    const users = await User.find(
        {},
        "name avatar memberStatus timeStamp"
    ).exec();

    if (!users) {
        res.status(404).json({ error: "No entries found in database." });
    } else {
        res.json(users);
    }
});

exports.createUser = [
    body("name", "Name must not be between 1 and 30 characters.")
        .trim()
        .isLength({ min: 1, max: 30 })
        .custom(async (value) => {
            const user = await User.find({ name: value }).exec();
            if (user.length > 0) {
                throw new Error(
                    "Name is already in use, please use a different one."
                );
            }
        })
        .escape(),
    body("email")
        .trim()
        .isLength({ min: 1 })
        .withMessage("Email must not be empty.")
        .isEmail()
        .withMessage("Email is not proper email format.")
        .custom(async (value) => {
            const user = await User.find({ username: value }).exec();
            if (user.length > 0) {
                throw new Error(
                    "Email is already in use, please use a different one."
                );
            }
        })
        .escape(),
    body("password", "Password must be a minimum of 6 characters.")
        .trim()
        .isLength({ min: 6 })
        .escape(),
    body("passwordConfirm", "Passwords must match.")
        .trim()
        .custom((value, { req }) => {
            return value === req.body.password;
        })
        .escape(),
    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        bcrypt.hash(req.body.password, 10, async (err, hashedPassword) => {
            if (err) {
                return next(err);
            } else {
                //Create User object with data
                const user = new User({
                    name: req.body.name,
                    email: req.body.email,
                    password: hashedPassword,
                    memberStatus: true,
                });

                if (!errors.isEmpty()) {
                    res.status(400).json({
                        user: { name: user.name, email: user.email },
                        errors: errors.array(),
                    });
                } else {
                    await user.save();
                    res.json({ message: "User successfully created." });
                }
            }
        });
    }),
];

exports.getUser = asyncHandler(async (req, res, next) => {
    if (req.user._id === req.params.userId) {
        // Get the users info of the supplied access token
        const user = await User.findOne(
            { _id: req.user._id },
            "name email bio avatar memberStatus friends channels timeStamp"
        )
            .populate("friends", { name: 1, bio: 1, avatar: 1, online: 1 })
            .populate("channels")
            .exec();

        if (!user) {
            // Inform client that not user was found
            res.status(404).json({ error: "User not found." });
        } else {
            res.json({ user: user, usersProfile: true });
        }
    } else {
        // Get the other users info from the parameters
        const user = await User.findOne(
            { _id: req.params.userId },
            "name bio avatar memberStatus timeStamp"
        ).exec();

        if (!user) {
            // Inform client that not user was found
            res.status(404).json({ error: "User not found." });
        } else {
            res.json({ user: user, usersProfile: false });
        }
    }
});

exports.updateUser = [
    body("name", "Name must not be between 1 and 30 characters.")
        .trim()
        .isLength({ min: 1, max: 30 })
        .custom(async (value, { req }) => {
            const currentUser = await User.findById(req.user._id).exec();
            const user = await User.find({ name: value }).exec();

            if (user.length > 0) {
                // Check if name is users own
                if (currentUser.name != value) {
                    throw new Error(
                        "Name is already in use, please use a different one."
                    );
                }
            }
        })
        .optional()
        .escape(),
    body("email", "Email must not be empty.")
        .trim()
        .isLength({ min: 1 })
        .isEmail()
        .withMessage("Email is not proper email format.")
        .custom(async (value, { req }) => {
            const currentUser = await User.findById(req.user._id).exec();
            const user = await User.find({ username: value }).exec();

            if (user.length > 0) {
                // Check if email is users own
                if (currentUser.username != value) {
                    throw new Error(
                        "Email is already in use, please use a different one."
                    );
                }
            }
        })
        .optional()
        .escape(),
    body("bio", "Bio must be less than 300 characters.")
        .trim()
        .isLength({ max: 300 })
        .optional()
        .blacklist("<>"),
    body("avatar").optional().trim(),
    body("friends", "Have to specify a user")
        .notEmpty()
        .optional()
        .custom(async (value, { req }) => {
            const user = await User.find({ name: value }).exec();

            if (!user) {
                throw new Error(`No user with ${value} exists.`);
            } else {
                req.body.friendUpdate = user._id;
            }
        }),
    body("online").optional(),
    asyncHandler(async (req, res, next) => {
        //Confirm user is updating their own account
        if (req.user._id === req.params.userId) {
            const errors = validationResult(req);

            const user = await User.findById(req.user._id).exec();

            if (!errors.isEmpty()) {
                res.status(400).json({
                    user: {
                        name: req.body.name || user.name,
                        email: req.body.email || user.email,
                        bio: req.body.bio || user.bio,
                    },
                    errors: errors.array(),
                });
            } else {
                const friendList = user.friends;

                // Prepare friendList if required and update friendUpdate's friends
                if (req.body.friends) {
                    if (friendList.includes(req.body.friendUpdate)) {
                        // Remove friend
                        friendList = friendList.filter(
                            (friend) => friend != req.body.friendUpdate
                        );
                        await User.findByIdAndUpdate(req.body.friendUpdate, {
                            $pull: { friends: req.user._id },
                        });
                    } else {
                        // Add friend
                        friendList.push(req.body.friendUpdate);
                        await User.findByIdAndUpdate(req.body.friendUpdate, {
                            $push: { friends: req.user._id },
                        });
                    }
                }

                // Update User
                const updatedUser = await User.findByIdAndUpdate(req.user._id, {
                    name: req.body.name || user.name,
                    email: req.body.email || user.email,
                    bio: req.body.bio || user.bio,
                    avatar: req.body.avatar || user.avatar,
                    friends: friendList,
                    online: req.body.online || user.online,
                });

                res.json({
                    userId: updatedUser._id,
                    message: "User updated successfully.",
                });
            }
        } else {
            res.status(401).json({
                error: "Not authorized for this action.",
            });
        }
    }),
];

// Deletes the user, channel (if less than 2 users), and all user messages
exports.deleteUser = asyncHandler(async (req, res, next) => {
    //Confirm user is deleting their own account
    if (req.user._id === req.params.userId) {
        const user = await User.findByIdAndDelete(req.user._id);

        if (!user) {
            return res
                .status(404)
                .json({ error: `No user with id ${req.user._id} exists` });
        } else {
            const channels = await Channel.find(
                { users: { $in: req.user._id } },
                "users"
            );

            // Delete channel if user was one of two users
            channels.forEach(async (channel) => {
                if (channel.users.length == 2) {
                    await Channel.findByIdAndDelete(channel._id);
                } else {
                    await Channel.findByIdAndUpdate(channel._id, {
                        $pull: {
                            users: req.user._id,
                            messages: { user: req.user._id },
                        },
                    });
                }
            });

            // Delete all messages
            const messages = await Message.deleteMany({ user: req.user._id });

            res.json({
                message: "User deleted successfully.",
                userId: user._id,
                // channels: channels,
                // messages: messages,
            });
        }
    } else {
        res.status(401).json({ error: "Not authorized for this action." });
    }
});

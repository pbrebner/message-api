const User = require("../models/user");
const Friend = require("../models/friend");
const Channel = require("../models/channel");
const Message = require("../models/message");
const {
    uploadFileS3,
    getSignedURL,
    deleteFileS3,
} = require("../controllers/s3Controller");

const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");

// Set up multer to handle file uploads
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const sharp = require("sharp");

exports.getAllUsers = asyncHandler(async (req, res, next) => {
    const users = await User.find({}, "name avatar memberStatus timeStamp")
        .lean()
        .exec();

    // Get url for avatar image
    for (let user of users) {
        if (user.avatar == "") {
            user["avatarURL"] = process.env.DEFAULT_AVATAR;
        } else {
            user["avatarURL"] = await getSignedURL(user.avatar);
        }
    }

    res.json(users);
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
            const user = await User.find({ email: value }).exec();
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
                    res.json({
                        userId: user._id,
                        message: "User successfully created.",
                    });
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
            .populate("friends", { targetUser: 1, status: 1, timeStamp: 1 })
            .populate("channels")
            .lean()
            .exec();

        if (!user) {
            // Inform client that not user was found
            res.status(404).json({ error: "User not found." });
        } else {
            // Get url for avatar image
            if (user.avatar == "") {
                user["avatarURL"] = process.env.DEFAULT_AVATAR;
            } else {
                user["avatarURL"] = await getSignedURL(user.avatar);
            }

            res.json({ user: user, usersProfile: true });
        }
    } else {
        // Get the other users info from the parameters
        const user = await User.findOne(
            { _id: req.params.userId },
            "name bio avatar memberStatus timeStamp"
        )
            .lean()
            .exec();

        if (!user) {
            // Inform client that not user was found
            res.status(404).json({ error: "User not found." });
        } else {
            // Get url for avatar image
            if (user.avatar == "") {
                user["avatarURL"] = process.env.DEFAULT_AVATAR;
            } else {
                user["avatarURL"] = await getSignedURL(user.avatar);
            }

            res.json({ user: user, usersProfile: false });
        }
    }
});

exports.updateUser = [
    upload.single("avatar"),
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
            const user = await User.find({ email: value }).exec();

            if (user.length > 0) {
                // Check if email is users own
                if (currentUser.email != value) {
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
    body("avatar")
        .trim()
        .optional()
        .custom(async (value, { req }) => {
            const file = req.file;
            const allowedFileTypes = ["image/png", "image/jpeg", "image/jpg"];
            const allowedSize = 2;

            if (!allowedFileTypes.includes(file.mimetype)) {
                throw new Error(
                    "Avatar can only be png, jpeg or jpg file formats."
                );
            }

            if (file.size / (1024 * 1024) > allowedSize) {
                throw new Error("File size is too large. 2MB maximum.");
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
                // Handle avatar upload
                if (req.file) {
                    // Change the size of the avatar
                    const fileBuffer = await sharp(req.file.buffer)
                        .resize({ height: 1080, width: 1080, fit: "contain" })
                        .toBuffer();

                    const fileName = await uploadFileS3(req.file, fileBuffer);

                    // Update User
                    const updatedUser = await User.findByIdAndUpdate(
                        req.user._id,
                        {
                            name: req.body.name || user.name,
                            email: req.body.email || user.email,
                            bio: req.body.bio || user.bio,
                            avatar: fileName,
                            online: req.body.online || user.online,
                        }
                    ).exec();

                    res.json({
                        userId: updatedUser._id,
                        avatar: fileName,
                        message: "User updated successfully.",
                    });
                } else {
                    // Update User
                    const updatedUser = await User.findByIdAndUpdate(
                        req.user._id,
                        {
                            name: req.body.name || user.name,
                            email: req.body.email || user.email,
                            bio: req.body.bio || user.bio,
                            online: req.body.online || user.online,
                        }
                    ).exec();

                    res.json({
                        userId: updatedUser._id,
                        avatar: user.avatar,
                        message: "User updated successfully.",
                    });
                }
            }
        } else {
            res.status(403).json({
                error: "Not authorized for this action.",
            });
        }
    }),
];

// Deletes the user, channel (if less than 2 users), and all user messages
exports.deleteUser = asyncHandler(async (req, res, next) => {
    //Confirm user is deleting their own account
    if (req.user._id === req.params.userId) {
        const user = await User.findByIdAndDelete(req.user._id).exec();

        if (!user) {
            return res
                .status(404)
                .json({ error: `No user with id ${req.user._id} exists` });
        } else {
            // Delete avatar off s3 bucket if not default
            if (user.avatar != "") {
                await deleteFileS3(user.avatar);
            }

            // Delete Friends
            await Friend.deleteMany({ user: req.user._id });
            const friends = await Friend.deleteMany({
                userTarget: req.user._id,
            }).exec();

            friends.forEach(async (friend) => {
                await User.findByIdAndUpdate(friend.user, {
                    $pull: { friends: friend._id },
                }).exec();
            });

            // Delete channels if user was one of two users
            const channels = await Channel.find(
                { users: { $in: req.user._id } },
                "users"
            ).exec();
            channels.forEach(async (channel) => {
                if (channel.users.length == 2) {
                    await Channel.findByIdAndDelete(channel._id).exec();
                } else {
                    await Channel.findByIdAndUpdate(channel._id, {
                        $pull: {
                            users: req.user._id,
                            messages: { user: req.user._id },
                        },
                    }).exec();
                }
            });

            // Delete all messages
            await Message.deleteMany({
                user: req.user._id,
            }).exec();

            res.json({
                message: "User deleted successfully.",
                userId: user._id,
                // channels: channels,
                // messages: messages,
            });
        }
    } else {
        res.status(403).json({ error: "Not authorized for this action." });
    }
});

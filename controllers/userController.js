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
    const users = await User.find(
        {},
        "name avatar memberStatus online timeStamp"
    )
        .lean()
        .exec();

    // Get signed url for avatar image
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
    body("name", "Name must be between 1 and 30 characters.")
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
        .blacklist("<>"),
    body("email")
        .trim()
        .isLength({ min: 1 })
        .withMessage("Email must not be empty.")
        .isEmail()
        .withMessage("Email is not proper email format.")
        .custom(async (value) => {
            // Check for characters not allowed and throw error if found
            const errorValues = ["<", ">", "&", "'", '"', "/"];
            let error = false;
            errorValues.forEach((errorValue) => {
                if (value.includes(errorValue)) {
                    error = true;
                }
            });

            if (error) {
                throw new Error(
                    "Email can't contain the following values: <, >, &, ', \", /."
                );
            }

            const user = await User.find({ email: value }).exec();
            if (user.length > 0) {
                throw new Error(
                    "Email is already in use, please use a different one."
                );
            }
        }),
    body("password", "Password must be a minimum of 6 characters.")
        .trim()
        .isLength({ min: 6 })
        .custom((value) => {
            // Check for characters not allowed and throw error if found
            const errorValues = ["<", ">", "&", "'", '"', "/"];
            let error = false;
            errorValues.forEach((errorValue) => {
                if (value.includes(errorValue)) {
                    error = true;
                }
            });

            if (error) {
                throw new Error(
                    "Password can't contain the following values: <, >, &, ', \", /."
                );
            }
        }),
    body("passwordConfirm", "Passwords must match.")
        .trim()
        .custom((value, { req }) => {
            return value === req.body.password;
        }),
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
        // Provide users own details as token id matched params id (Clicked on own account)
        const user = await User.findOne(
            { _id: req.user._id },
            "name email bio avatar memberStatus friends channels online timeStamp"
        )
            .populate("friends", { targetUser: 1, status: 1, timeStamp: 1 })
            .populate("channels")
            .lean()
            .exec();

        if (!user) {
            // Inform client that not user was found
            res.status(404).json({ error: "User not found." });
        } else {
            // Get url for avatar
            if (user.avatar == "") {
                user["avatarURL"] = process.env.DEFAULT_AVATAR;
            } else {
                user["avatarURL"] = await getSignedURL(user.avatar);
            }

            // If guest account, sets guest profile as true
            if (user.email == "sarawilson@example.com") {
                res.json({
                    user: user,
                    guestProfile: true,
                    usersProfile: true,
                });
            } else {
                res.json({
                    user: user,
                    guestProfile: false,
                    usersProfile: true,
                });
            }
        }
    } else {
        // Provide other users details (Clicked on someone elses account)
        const user = await User.findOne(
            { _id: req.params.userId },
            "name bio avatar memberStatus online timeStamp"
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

            res.json({ user: user, guestProfile: false, usersProfile: false });
        }
    }
});

exports.updateUser = [
    upload.single("avatar"),
    body("name", "Name must be between 1 and 30 characters.")
        .trim()
        .isLength({ min: 1, max: 30 })
        .custom(async (value, { req }) => {
            const currentUser = await User.findById(req.user._id).exec();
            const user = await User.find({ name: value }).exec();

            // Check if name is taken by another user
            if (user.length > 0 && currentUser.name != value) {
                throw new Error(
                    "Name is already in use, please use a different one."
                );
            }
        })
        .optional()
        .blacklist("<>"),
    body("email", "Email must not be empty.")
        .trim()
        .isLength({ min: 1 })
        .isEmail()
        .withMessage("Email is not proper email format.")
        .custom(async (value, { req }) => {
            // Check for characters not allowed and throw error if found
            const errorValues = ["<", ">", "&", "'", '"', "/"];
            let error = false;
            errorValues.forEach((errorValue) => {
                if (value.includes(errorValue)) {
                    error = true;
                }
            });

            if (error) {
                throw new Error(
                    "Email can't contain the following values: <, >, &, ', \", /."
                );
            }

            const currentUser = await User.findById(req.user._id).exec();
            const user = await User.find({ email: value }).exec();

            // Check if email is taken by another user
            if (user.length > 0 && currentUser.email != value) {
                throw new Error(
                    "Email is already in use, please use a different one."
                );
            }
        })
        .optional(),
    body("bio", "Bio must be less than 300 characters.")
        .trim()
        .isLength({ max: 300 })
        .optional()
        .blacklist("<>"),
    body("avatar")
        .trim()
        .optional()
        .custom(async (value, { req }) => {
            // Verifies file type and size contraints
            const file = req.file;
            const allowedFileTypes = ["image/png", "image/jpeg", "image/jpg"];
            const allowedSize = 5;

            if (!allowedFileTypes.includes(file.mimetype)) {
                throw new Error(
                    "Avatar can only be png, jpeg or jpg file formats."
                );
            } else if (file.size / (1024 * 1024) > allowedSize) {
                throw new Error("File size is too large. 5MB maximum.");
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
                let fileName = "";

                if (req.file) {
                    // Change the size of the avatar image if provided
                    const fileBuffer = await sharp(req.file.buffer)
                        .resize({ height: 1080, width: 1080, fit: "cover" })
                        .toBuffer();

                    fileName = await uploadFileS3(req.file, fileBuffer);
                }

                if (user.email == "sarawilson@example.com") {
                    // Update Guest User (except Email which can't be changed for log in purposes)
                    const updatedUser = await User.findByIdAndUpdate(
                        req.user._id,
                        {
                            name: req.body.name || user.name,
                            email: user.email,
                            bio: req.body.bio || user.bio,
                            avatar: fileName || user.avatar,
                            online: req.body.online || user.online,
                        }
                    ).exec();

                    res.json({
                        userId: updatedUser._id,
                        message: "User and avatar updated successfully.",
                    });
                } else {
                    // Update User
                    const updatedUser = await User.findByIdAndUpdate(
                        req.user._id,
                        {
                            name: req.body.name || user.name,
                            email: req.body.email || user.email,
                            bio: req.body.bio || user.bio,
                            avatar: fileName || user.avatar,
                            online: req.body.online || user.online,
                        }
                    ).exec();

                    res.json({
                        userId: updatedUser._id,
                        message: "User and avatar updated successfully.",
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
        const user = await User.findById(req.user._id).exec();

        if (!user) {
            return res
                .status(404)
                .json({ error: `No user with id ${req.user._id} exists` });
        } else if (user.email == "sarawilson@example.com") {
            // This is the guest account and can't be deleted
            return res
                .status(405)
                .json({ error: `Deleting guest account not allowed` });
        } else {
            // Delete the user
            await User.findByIdAndDelete(req.user._id).exec();

            // Delete avatar off s3 bucket if not default
            if (user.avatar != "") {
                await deleteFileS3(user.avatar);
            }

            // Delete Friends and update users linked contacts
            await Friend.deleteMany({ user: req.user._id });
            const friends = await Friend.deleteMany({
                userTarget: req.user._id,
            }).exec();

            if (friends.length > 0) {
                friends.forEach(async (friend) => {
                    await User.findByIdAndUpdate(friend.user, {
                        $pull: { friends: friend._id },
                    }).exec();
                });
            }

            // Delete channels if user was one of only two users
            const channels = await Channel.find(
                { users: { $in: req.user._id } },
                "users"
            ).exec();

            if (channels.length > 0) {
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
            }

            // Delete all user messages
            await Message.deleteMany({
                user: req.user._id,
            }).exec();

            res.json({
                message: "User deleted successfully.",
                userId: user._id,
            });
        }
    } else {
        res.status(403).json({ error: "Not authorized for this action." });
    }
});

const Friend = require("../models/friend");
const User = require("../models/user");

const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");

exports.getAllUserFriends = asyncHandler(async (req, res, next) => {
    const friends = await Friend.find({ _id: req.user._id }).exec();

    if (!friends) {
        res.status(404).json({ error: "No entries found in database." });
    } else {
        res.json(friends);
    }
});

exports.createFriend = [
    body("requester").trim(),
    body("recipient").trim(),
    body("status").trim(),

    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);
    }),
];

exports.getFriend = asyncHandler(async (req, res, next) => {
    console.log("Not implemented yet");
});

exports.updateFriend = asyncHandler(async (req, res, next) => {
    console.log("Not implemented yet");
});

exports.deleteFriend = asyncHandler(async (req, res, next) => {
    console.log("Not implemented yet");
});

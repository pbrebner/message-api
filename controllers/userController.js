const User = require("../models/user");

const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");

exports.getAllUsers = asyncHandler(async (req, res, next) => {
    const users = await User.find({}, "name memberStatus timeStamp").exec();

    if (!users) {
        res.status(404).json({ error: "No entries found in database." });
    } else {
        res.json(users);
    }
});

exports.createUser = asyncHandler(async (req, res, next) => {
    res.json("Not implemented yet");
});

exports.getUser = asyncHandler(async (req, res, next) => {
    res.json("Not implemented yet");
});

exports.updateUser = asyncHandler(async (req, res, next) => {
    res.json("Not implemented yet");
});

exports.deleteUser = asyncHandler(async (req, res, next) => {
    res.json("Not implemented yet");
});

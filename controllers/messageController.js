const Message = require("../models/message");

const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");

exports.createMessage = asyncHandler(async (req, res, next) => {
    res.json("Not implemented Yet");
});

exports.getMessage = asyncHandler(async (req, res, next) => {
    res.json("Not implemented Yet");
});

exports.updateMessage = asyncHandler(async (req, res, next) => {
    res.json("Not implemented Yet");
});

exports.deleteMessage = asyncHandler(async (req, res, next) => {
    res.json("Not implemented Yet");
});

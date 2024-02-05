const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");

/* GET home page. */
router.get("/", function (req, res, next) {
    res.send("API Test");
});

// AUTH ROUTES

router.post("/login", authController.login);

// USER ROUTES

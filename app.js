require("dotenv").config();

const createError = require("http-errors");
const express = require("express");
const path = require("path");
const passport = require("passport");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const setSocketServer = require("./socketServer");
const cors = require("cors");

const indexRouter = require("./routes/index");
const apiRouter = require("./routes/api");

const app = express();

app.use(
    cors({
        origin: ["http://localhost:5173", "https://pbrebner.github.io"],
    })
);

// Set up mongoose connection
const mongoose = require("mongoose");
mongoose.set("strictQuery", false);
const mongoDB = process.env.MONGODB_URI;

main().catch((err) => console.log(err));
async function main() {
    await mongoose.connect(mongoDB);
}

// Get server and set up socket io
const server = setSocketServer(app);

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(passport.initialize());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/api", apiRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};

    // return the error
    res.status(err.status || 500);
    res.json({ status: err.status, errMessage: err.message });
});

module.exports = { app: app, server: server };

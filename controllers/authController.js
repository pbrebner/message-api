const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/user");

// Set up passport to authenticate login
passport.use(
    new LocalStrategy(
        {
            usernameField: "email",
            passwordField: "password",
        },
        async (email, password, done) => {
            try {
                const user = await User.findOne({ email: email });

                if (!user) {
                    return done(null, false, {
                        message: "Incorrect email or password.",
                    });
                }
                const match = await bcrypt.compare(password, user.password);
                if (!match) {
                    // passwords do not match!
                    return done(null, false, {
                        message: "Incorrect email or password.",
                    });
                }
                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }
    )
);

// Function to verify token
exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token == null) {
        return res.status(401).json({ message: "No token." });
    }

    req.token = token;

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "Invalid Token." });
        }

        req.user = decoded.user;
        next();
    });
};

exports.login = (req, res) => {
    passport.authenticate(
        "local",
        { session: false },
        async (err, user, options) => {
            if (!user) {
                // Credentials are wrong, respond with error message
                console.log(options.message); // Prints the reason of the failure
                res.status(400).json({ errors: options.message });
            } else {
                // Credentials are correct
                console.log("User Authenticated.");

                const user = await User.findOne(
                    { email: req.body.email },
                    "name email memberStatus"
                ).exec();

                // Create Token
                const token = jwt.sign(
                    { user: user },
                    process.env.ACCESS_TOKEN_SECRET
                );
                res.json({ body: user, token: token });
            }
        }
    )(req, res);
};

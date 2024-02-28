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

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        /*
        if (err) {
            if (err.name == "TokenExpiredError") {
                
                    err = {
                        name: 'TokenExpiredError',
                        message: 'jwt expired',
                        expiredAt: 1408621000
                    }
                

                if (req.cookies?.jwt) {
                    // Destructuring refreshToken from cookie
                    const refreshToken = req.cookies.jwt;

                    // Verifying refresh token
                    jwt.verify(
                        refreshToken,
                        process.env.REFRESH_TOKEN_SECRET,
                        (err, decoded) => {
                            if (err) {
                                // Wrong Refesh Token
                                return res
                                    .status(403)
                                    .json({ message: "Invalid Token." });
                            } else {
                                // Correct token we send a new access token
                                const accessToken = jwt.sign(
                                    { user: decoded.user },
                                    process.env.ACCESS_TOKEN_SECRET,
                                    { expiresIn: "20m" }
                                );
                                //return res.json({ accessToken });
                                req.accessToken = accessToken;
                            }
                        }
                    );
                } else {
                    return res
                        .status(401)
                        .json({ message: "No token/token expired." });
                }
            } else {
                return res.status(403).json({ message: "Invalid Token." });
            }
        }
        */

        if (err) {
            return res.status(401).json({ message: "Invalid Token." });
        }

        req.user = decoded.user;
        next();
    });
};

exports.refresh = (req, res, next) => {
    if (req.cookies?.jwt) {
        // Destructuring refreshToken from cookie
        const refreshToken = req.cookies.jwt;

        // Verifying refresh token
        jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET,
            (err, decoded) => {
                if (err) {
                    // Wrong Refesh Token
                    return res.status(401).json({ message: "Invalid Token." });
                } else {
                    // Correct token we send a new access token
                    const accessToken = jwt.sign(
                        { user: decoded.user },
                        process.env.ACCESS_TOKEN_SECRET,
                        { expiresIn: "20m" }
                    );
                    return res.json({ accessToken });
                }
            }
        );
    } else {
        return res.status(401).json({ message: "No token." });
    }
};

exports.login = (req, res) => {
    passport.authenticate(
        "local",
        { session: false },
        async (err, user, options) => {
            if (!user) {
                // Credentials are wrong, respond with error message
                console.log(options.message); // Prints the reason of the failure
                return res.status(400).json({ errors: options.message });
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
                    process.env.ACCESS_TOKEN_SECRET,
                    { expiresIn: "20m" }
                );

                //Create Refresh token
                const refreshToken = jwt.sign(
                    { user: user },
                    process.env.REFRESH_TOKEN_SECRET,
                    { expiresIn: "1d" }
                );

                // Assigning refresh token in http-only cookie
                res.cookie("jwt", refreshToken, {
                    httpOnly: true,
                    sameSite: "None",
                    secure: true,
                    maxAge: 24 * 60 * 60 * 1000,
                });

                return res.json({ body: user, token: token });
            }
        }
    )(req, res);
};

exports.logout = (req, res, next) => {
    res.clearCookie("jwt");
    return res.json({ message: "LogOut successful" });
};

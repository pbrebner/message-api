const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    bio: { type: String, default: "" },
    avatar: {
        type: String,
        default: "",
    },
    memberStatus: { type: Boolean, default: false },
    friends: [{ type: Schema.Types.ObjectId, ref: "Friend" }],
    channels: [{ type: Schema.Types.ObjectId, ref: "Channel" }],
    online: { type: Boolean, default: false },
    timeStamp: { type: Date, default: Date.now, required: true },
});

// Export model
module.exports = mongoose.model("User", userSchema);

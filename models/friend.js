const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const friendSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User" },
    targetUser: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
        type: Number,
        enum: [
            0, //add friend
            1, //request sent
            2, //pending response
            3, //friends
        ],
    },
    timeStamp: { type: Date, default: Date.now, required: true },
});

// Export model
module.exports = mongoose.model("Friend", friendSchema);

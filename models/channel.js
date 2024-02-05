const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const channelSchema = new Schema({
    title: { type: String, default: "", required: true },
    users: [{ type: Schema.Types.ObjectId, ref: "User" }],
    messages: [{ type: Schema.Types.ObjectId, ref: "Message" }],
    timeStamp: { type: Date, default: Date.now, required: true },
});

channelSchema.virtual("url").get(function () {
    return `/api/messages/${this._id}`;
});

// Export model
module.exports = mongoose.model("Channel", channelSchema);
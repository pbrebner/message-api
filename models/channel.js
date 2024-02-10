const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const channelSchema = new Schema({
    title: { type: String, default: "" },
    users: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    messages: [{ type: Schema.Types.ObjectId, ref: "Message" }],
    timeStamp: { type: Date, default: Date.now, required: true },
});

// Export model
module.exports = mongoose.model("Channel", channelSchema);

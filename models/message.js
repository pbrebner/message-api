const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    content: { type: String, default: "" },
    image: {
        type: String,
        default: "",
    },
    inResponseTo: { type: Schema.Types.ObjectId, ref: "Message" },
    likes: { type: Number, default: 0 },
    posted: { type: Boolean, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    channel: { type: Schema.Types.ObjectId, ref: "Channel", required: true },
    timeStamp: { type: Date, default: Date.now, required: true },
});

// Export model
module.exports = mongoose.model("Message", messageSchema);

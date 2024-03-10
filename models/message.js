const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    content: { type: String, required: true },
    image: {
        type: String,
        default: "",
    },
    likes: { type: Number, default: 0 },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    channel: { type: Schema.Types.ObjectId, ref: "Channel", required: true },
    timeStamp: { type: Date, default: Date.now, required: true },
});

// Export model
module.exports = mongoose.model("Message", messageSchema);

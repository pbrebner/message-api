const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    content: { type: String, required: true },
    likes: { type: Number, default: 0 },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    timeStamp: { type: Date, default: Date.now, required: true },
});

messageSchema.virtual("url").get(function () {
    return `/api/messages/${this._id}`;
});

// Export model
module.exports = mongoose.model("Message", messageSchema);

const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  code: { type: String, default: "// Start coding..." },
  users: [{
    socketId: String,
    username: String,
    joinedAt: { type: Date, default: Date.now }
  }],
  messages: [{
    username: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }],
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Room", RoomSchema);

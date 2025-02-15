const mongoose = require("mongoose");

const EditorSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  language: { type: String, default: 'javascript' },
  code: { type: String, default: "// Start coding..." },
  createdAt: { type: Date, default: Date.now }
});

const RoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  editors: [EditorSchema],
  activeUsers: [{
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

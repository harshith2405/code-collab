const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
const Room = require("./models/Room");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000", // Replace with your frontend URL
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json());

// Add some validation
if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is not defined in environment variables");
  process.exit(1);
}

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("MongoDB Connected Successfully");
  console.log("Database:", mongoose.connection.name);
})
.catch((err) => {
  console.error("MongoDB Connection Error:", err);
  process.exit(1);
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  
  socket.on("disconnect", (reason) => {
    console.log("Client disconnected:", socket.id, "Reason:", reason);
  });

  socket.on("join-room", async ({ roomId, username }) => {
    try {
      socket.join(roomId);
      console.log(`User ${username} (${socket.id}) joined room: ${roomId}`);

      let room = await Room.findOne({ roomId });
      
      if (room) {
        // Add user to room
        room.users.push({ socketId: socket.id, username });
        await room.save();
        
        socket.emit("load-code", room.code);
        socket.emit("load-messages", room.messages);
      } else {
        room = new Room({ 
          roomId, 
          code: "// Start coding...",
          users: [{ socketId: socket.id, username }],
          messages: []
        });
        await room.save();
        socket.emit("load-code", room.code);
      }

      // Broadcast updated user list to all clients in the room
      const users = room.users.map(u => ({ socketId: u.socketId, username: u.username }));
      io.to(roomId).emit("update-users", users);
      
      // Notify others that a new user joined
      socket.to(roomId).emit("user-joined", { socketId: socket.id, username });
    } catch (error) {
      console.error("Error in join-room:", error);
      socket.emit("error", "Failed to join room: " + error.message);
    }
  });

  socket.on("send-message", async ({ roomId, message, username }) => {
    try {
      const newMessage = { username, text: message, timestamp: new Date() };
      
      await Room.findOneAndUpdate(
        { roomId },
        { $push: { messages: newMessage } }
      );

      io.to(roomId).emit("new-message", newMessage);
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("error", "Failed to send message");
    }
  });

  socket.on("disconnect", async () => {
    try {
      // Find all rooms where this socket was a user
      const rooms = await Room.find({ "users.socketId": socket.id });
      
      for (const room of rooms) {
        // Remove user from room
        room.users = room.users.filter(u => u.socketId !== socket.id);
        await room.save();
        
        // Broadcast updated user list
        const users = room.users.map(u => ({ socketId: u.socketId, username: u.username }));
        io.to(room.roomId).emit("update-users", users);
        io.to(room.roomId).emit("user-left", socket.id);
      }
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  });

  socket.on("code-change", async ({ roomId, code }) => {
    try {
      // Broadcast code changes to other users in the room
      socket.to(roomId).emit("code-update", code);

      // Save the latest code to MongoDB with timestamp
      await Room.findOneAndUpdate(
        { roomId },
        { 
          code,
          lastUpdated: new Date(),
        },
        { upsert: true }
      );
    } catch (error) {
      console.error("Error in code-change:", error);
      socket.emit("error", "Failed to save code");
    }
  });
});

app.get("/", (req, res) => {
  res.send("Code Collaboration Hub Backend Running...");
});

app.get("/api/room/:roomId", async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

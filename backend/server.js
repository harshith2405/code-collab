require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
const Room = require("./models/Room");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("MongoDB Connected Successfully");
  console.log("Database Name:", mongoose.connection.name);
})
.catch((err) => {
  console.error("MongoDB Connection Error:", err);
  process.exit(1); // Exit the process if MongoDB connection fails
});

// Add this to check for disconnections
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", async (roomId) => {
    try {
      socket.join(roomId);
      console.log(`User ${socket.id} joined room: ${roomId}`);

      // Load previous code from database
      let room = await Room.findOne({ roomId });
      console.log("Found room:", room); // Debug log

      if (room) {
        console.log("Emitting existing code for room:", roomId);
        socket.emit("load-code", room.code);
      } else {
        console.log("Creating new room:", roomId);
        try {
          room = new Room({ 
            roomId, 
            code: "// Start coding...",
            lastUpdated: new Date(),
            createdAt: new Date()
          });
          await room.save();
          console.log("New room created successfully");
          socket.emit("load-code", room.code);
        } catch (saveError) {
          console.error("Error saving new room:", saveError);
          throw saveError;
        }
      }

      // Notify other users that someone joined
      socket.to(roomId).emit("user-joined", socket.id);
    } catch (error) {
      console.error("Detailed error in join-room:", {
        error: error.message,
        stack: error.stack,
        roomId: roomId
      });
      socket.emit("error", "Failed to join room: " + error.message);
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

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
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

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

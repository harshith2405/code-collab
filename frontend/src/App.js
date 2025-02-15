import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import io from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import './App.css';

// Move socket initialization inside useEffect to avoid potential issues
function App() {
  const [code, setCode] = useState("// Start coding...");
  const [roomId, setRoomId] = useState("");
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState("connecting...");
  const [error, setError] = useState(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    // Generate unique room ID or get from URL
    let id = window.location.pathname.split("/")[1] || uuidv4();
    setRoomId(id);

    // Update URL if needed
    if (!window.location.pathname.split("/")[1]) {
      window.history.pushState({}, "", `/${id}`);
    }

    // Clean up socket connection on component unmount
    return () => newSocket.disconnect();
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Join room and set up event listeners after socket is initialized
    socket.emit("join-room", roomId);

    socket.on("connect", () => {
      setStatus("connected");
      setError(null);
    });

    socket.on("disconnect", () => {
      setStatus("disconnected");
    });

    socket.on("error", (errorMessage) => {
      console.error("Socket error:", errorMessage);
      setError(errorMessage);
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (socket) {
          console.log("Attempting to rejoin room...");
          socket.emit("join-room", roomId);
        }
      }, 3000);
    });

    socket.on("load-code", (savedCode) => {
      setCode(savedCode);
    });

    socket.on("code-update", (newCode) => {
      setCode(newCode);
    });

    socket.on("user-joined", (userId) => {
      console.log(`User ${userId} joined the room`);
      // You could add a notification here
    });

    // Clean up event listeners
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("error");
      socket.off("load-code");
      socket.off("code-update");
      socket.off("user-joined");
    };
  }, [socket, roomId]);

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (socket && socket.connected) {
      socket.emit("code-change", { roomId, code: newCode });
    }
  };

  return (
    <div className="container">
      <h1>Code Collaboration Hub</h1>
      <div className="status-bar">
        <p>Room ID: {roomId}</p>
        <p>Status: {status}</p>
        {error && <p className="error">Error: {error}</p>}
      </div>
      <p>Share this link: {window.location.origin}/{roomId}</p>
      <Editor
        height="60vh"
        defaultLanguage="javascript"
        value={code}
        onChange={handleCodeChange}
        options={{
          minimap: { enabled: false },
          automaticLayout: true,
          fontSize: 14,
          wordWrap: "on",
          lineNumbers: "on",
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true
        }}
      />
    </div>
  );
}

export default App;

import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import io from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import './App.css';

function App() {
  const [code, setCode] = useState("// Start coding...");
  const [roomId, setRoomId] = useState("");
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState("connecting...");
  const [error, setError] = useState(null);
  const [username, setUsername] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const newSocket = io("http://localhost:5000", {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    let id = window.location.pathname.split("/")[1] || uuidv4();
    setRoomId(id);

    if (!window.location.pathname.split("/")[1]) {
      window.history.pushState({}, "", `/${id}`);
    }

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      setStatus("connected");
      setSocket(newSocket);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setStatus("connection failed");
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setStatus("disconnected");
    });

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket || !isJoined || !roomId || !username) return;

    console.log("Joining room with:", { roomId, username });

    socket.on("connect", () => {
      setStatus("connected");
      setError(null);
    });

    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("error", setError);
    socket.on("load-code", setCode);
    socket.on("code-update", setCode);
    socket.on("update-users", setUsers);
    socket.on("load-messages", setMessages);
    socket.on("new-message", (msg) => setMessages(prev => [...prev, msg]));

    socket.emit("join-room", { roomId, username });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("error");
      socket.off("load-code");
      socket.off("code-update");
      socket.off("update-users");
      socket.off("load-messages");
      socket.off("new-message");
    };
  }, [socket, isJoined, roomId, username]);

  useEffect(() => {
    console.log("Current socket state:", socket?.connected);
    console.log("Current connection status:", status);
  }, [socket, status]);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (username.trim()) {
      setIsJoined(true);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && socket) {
      socket.emit("send-message", { roomId, message: newMessage, username });
      setNewMessage("");
    }
  };

  if (!isJoined) {
    return (
      <div className="username-prompt">
        <form onSubmit={handleJoinRoom}>
          <h2>Enter your username to join</h2>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
          />
          <button type="submit">Join Room</button>
        </form>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Code Collaboration Hub</h1>
      <div className="status-bar">
        <p>Room ID: {roomId}</p>
        <p>Status: {status}</p>
        {error && <p className="error">Error: {error}</p>}
      </div>
      <p>Share this link: {window.location.origin}/{roomId}</p>
      
      <div className="main-content">
        <div className="editor-container">
          <Editor
            height="70vh"
            defaultLanguage="javascript"
            value={code}
            onChange={(newCode) => {
              setCode(newCode);
              if (socket?.connected) {
                socket.emit("code-change", { roomId, code: newCode });
              }
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: "on",
              lineNumbers: "on",
              roundedSelection: false,
              scrollBeyondLastLine: false,
              automaticLayout: true
            }}
          />
        </div>

        <div className="sidebar">
          <div className="active-users">
            <h3>Active Users</h3>
            <ul>
              {users.map(user => (
                <li key={user.socketId}>
                  {user.username} {user.socketId === socket.id ? '(You)' : ''}
                </li>
              ))}
            </ul>
          </div>

          <div className="chat-container">
            <div className="chat-messages" ref={chatContainerRef}>
              {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.username === username ? 'own-message' : ''}`}>
                  <span className="message-username">{msg.username}</span>
                  <span className="message-text">{msg.text}</span>
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="chat-input">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
              />
              <button type="submit">Send</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

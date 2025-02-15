import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import io from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import { Plus, X, Sun, Moon, Copy, Check } from 'react-feather';
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
  const [editors, setEditors] = useState([
    { 
      id: 'main', 
      name: 'Main Editor', 
      language: 'javascript', 
      code: '// Start coding...' 
    }
  ]);
  const [activeEditor, setActiveEditor] = useState('main');
  const [newEditorName, setNewEditorName] = useState('');
  const [showNewEditorModal, setShowNewEditorModal] = useState(false);
  const [editingName, setEditingName] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

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
    socket.on("error", (err) => {
      console.error("Socket error:", err);
      setError(err);
    });
    
    socket.on("load-editors", (loadedEditors) => {
      console.log("Received editors:", loadedEditors);
      if (Array.isArray(loadedEditors) && loadedEditors.length > 0) {
        setEditors(loadedEditors);
        setActiveEditor(loadedEditors[0].id);
      }
    });

    socket.on("editor-added", (newEditor) => {
      setEditors(prev => [...prev, newEditor]);
    });

    socket.on("editor-removed", (editorId) => {
      setEditors(prev => {
        const filtered = prev.filter(editor => editor.id !== editorId);
        if (activeEditor === editorId && filtered.length > 0) {
          setActiveEditor(filtered[0].id);
        }
        return filtered;
      });
    });

    socket.on("code-update", ({ editorId, code }) => {
      setEditors(prev => prev.map(editor => 
        editor.id === editorId ? { ...editor, code } : editor
      ));
    });

    socket.on("update-users", (updatedUsers) => {
      if (Array.isArray(updatedUsers)) {
        setUsers(updatedUsers);
      }
    });

    socket.on("load-messages", (loadedMessages) => {
      if (Array.isArray(loadedMessages)) {
        setMessages(loadedMessages);
      }
    });

    socket.on("new-message", (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on("editor-renamed", ({ editorId, name }) => {
      setEditors(prev => prev.map(editor => 
        editor.id === editorId ? { ...editor, name } : editor
      ));
    });

    socket.emit("join-room", { roomId, username });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("error");
      socket.off("load-editors");
      socket.off("editor-added");
      socket.off("editor-removed");
      socket.off("code-update");
      socket.off("update-users");
      socket.off("load-messages");
      socket.off("new-message");
      socket.off("editor-renamed");
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

  const handleCodeChange = (newCode, editorId) => {
    setEditors(prev => prev.map(editor => 
      editor.id === editorId ? { ...editor, code: newCode } : editor
    ));
    
    if (socket?.connected) {
      socket.emit("code-change", { roomId, editorId, code: newCode });
    }
  };

  const handleAddEditor = (e) => {
    e.preventDefault();
    if (newEditorName.trim()) {
      const newEditor = {
        id: uuidv4(),
        name: newEditorName.trim(),
        language: 'javascript',
        code: '// Start coding...'
      };
      
      setEditors(prev => [...prev, newEditor]);
      setActiveEditor(newEditor.id);
      setNewEditorName('');
      setShowNewEditorModal(false);
      
      if (socket?.connected) {
        socket.emit("add-editor", { roomId, editor: newEditor });
      }
    }
  };

  const handleRemoveEditor = (editorId) => {
    if (editors.length > 1) {
      setEditors(prev => prev.filter(editor => editor.id !== editorId));
      if (activeEditor === editorId) {
        setActiveEditor(editors[0].id);
      }
      
      if (socket?.connected) {
        socket.emit("remove-editor", { roomId, editorId });
      }
    }
  };

  const handleRenameEditor = (editorId, newName) => {
    if (newName.trim()) {
      setEditors(prev => prev.map(editor => 
        editor.id === editorId ? { ...editor, name: newName.trim() } : editor
      ));
      setEditingName(null);
      
      if (socket?.connected) {
        socket.emit("rename-editor", { roomId, editorId, name: newName.trim() });
      }
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.body.classList.toggle('dark-mode');
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
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
    <div className={`container ${isDarkMode ? 'dark-mode' : ''}`}>
      <div className="header">
        <h1>Code Collaboration Hub</h1>
        <button 
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
      
      <div className="status-bar">
        <p>Room ID: {roomId}</p>
        <p>Status: {status}</p>
        {error && <p className="error">Error: {error}</p>}
      </div>

      <div className="share-link-bar">
        <p>Share this link: {window.location.origin}/{roomId}</p>
        <button 
          className={`copy-link-btn ${copySuccess ? 'success' : ''}`}
          onClick={handleCopyLink}
          title="Copy link to clipboard"
        >
          {copySuccess ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>

      <button 
        className="new-editor-btn"
        onClick={() => setShowNewEditorModal(true)}
      >
        <Plus size={16} /> New Editor
      </button>

      <div className="main-content">
        <div className="editors-sidebar">
          <h3>Editors</h3>
          <div className="editors-list">
            {editors.map(editor => (
              <div 
                key={editor.id}
                className={`editor-item ${activeEditor === editor.id ? 'active' : ''}`}
              >
                {editingName === editor.id ? (
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRenameEditor(editor.id, e.target.elements.name.value);
                    }}
                    className="rename-form"
                  >
                    <input
                      name="name"
                      defaultValue={editor.name}
                      autoFocus
                      onBlur={(e) => handleRenameEditor(editor.id, e.target.value)}
                    />
                  </form>
                ) : (
                  <div className="editor-item-content">
                    <span 
                      className="editor-name"
                      onClick={() => setActiveEditor(editor.id)}
                      onDoubleClick={() => setEditingName(editor.id)}
                    >
                      {editor.name}
                    </span>
                    {editors.length > 1 && (
                      <X 
                        size={14}
                        onClick={() => handleRemoveEditor(editor.id)}
                        className="remove-editor"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="workspace">
          <div className="editor-container">
            {editors.map(editor => (
              <div 
                key={editor.id}
                style={{ display: activeEditor === editor.id ? 'block' : 'none' }}
              >
                <Editor
                  height="70vh"
                  defaultLanguage={editor.language}
                  value={editor.code}
                  onChange={(newCode) => handleCodeChange(newCode, editor.id)}
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
            ))}
          </div>
        </div>

        <div className="chat-sidebar">
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

      {showNewEditorModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add New Editor</h3>
            <form onSubmit={handleAddEditor}>
              <input
                type="text"
                value={newEditorName}
                onChange={(e) => setNewEditorName(e.target.value)}
                placeholder="Editor Name"
                required
              />
              <div className="modal-buttons">
                <button type="submit">Add</button>
                <button type="button" onClick={() => setShowNewEditorModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

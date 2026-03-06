import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
import "./App.css";

const socket = io("https://chat-app-mpeh.onrender.com");

function App() {

  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [joined, setJoined] = useState(false);

  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [users, setUsers] = useState([]);

  const [typingUser, setTypingUser] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");

  const [showEmoji, setShowEmoji] = useState(false);

  const chatEndRef = useRef(null);

  /* ---------------- SOCKET EVENTS ---------------- */

  useEffect(() => {

    const handleMessage = (data) => {

      if (data.user !== username && data.user !== "System") {
        const audio = new Audio("/message.mp3");
        audio.play().catch(() => {});
      }

      setChat((prev) => [...prev, data]);
    };

    const handleHistory = (messages) => {
      setChat(messages);
    };

    const handleUsers = (userList) => {
      setUsers(userList);
    };

    const handleTyping = (user) => {
      setTypingUser(user);
    };

    const handleStopTyping = () => {
      setTypingUser("");
    };

    socket.on("receive_message", handleMessage);
    socket.on("chat_history", handleHistory);
    socket.on("room_users", handleUsers);
    socket.on("typing", handleTyping);
    socket.on("stop_typing", handleStopTyping);

    return () => {
      socket.off("receive_message", handleMessage);
      socket.off("chat_history", handleHistory);
      socket.off("room_users", handleUsers);
      socket.off("typing", handleTyping);
      socket.off("stop_typing", handleStopTyping);
    };

  }, [username]);

  /* ---------------- AUTO SCROLL ---------------- */

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  /* ---------------- JOIN CHAT ---------------- */

  const joinChat = () => {

    if (!username || !room) return;

    socket.emit("join_room", { room, user: username });

    setJoined(true);
  };

  /* ---------------- SEND MESSAGE ---------------- */

  const sendMessage = () => {

    if (!message.trim()) return;

    if (selectedUser) {

      socket.emit("private_message", {
        room,
        user: username,
        toUser: selectedUser,
        message
      });

    } else {

      socket.emit("send_message", {
        user: username,
        room,
        message
      });

    }

    socket.emit("stop_typing", { room });

    setMessage("");
  };

  /* ---------------- JOIN SCREEN ---------------- */

  if (!joined) {

    return (
      <div className="join-page">

        <div className="join-card">

          <h1>Realtime Chat</h1>
          <p>Connect instantly with friends</p>

          <form onSubmit={(e) => {
            e.preventDefault();
            joinChat();
          }}>

            <input
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <input
              placeholder="Enter room name"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />

            <button type="submit">Enter Chat</button>

          </form>

        </div>

      </div>
    );

  }

  /* ---------------- CHAT SCREEN ---------------- */

  return (

    <div className={darkMode ? "chat-layout dark" : "chat-layout"}>

      {/* SIDEBAR */}

      <div className="sidebar">

        <h3>Online Users</h3>

        {users.map((u, index) => (
          <div key={index} className="user">{u}</div>
        ))}

      </div>

      {/* CHAT AREA */}

      <div className="chat-container">

        <div className="chat-header">

          <h2>Realtime Chat</h2>

          <button
            className="dark-toggle"
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? "☀ Light" : "🌙 Dark"}
          </button>

        </div>

        {/* MESSAGES */}

        <div className="chat-box">

          {chat.map((msg, index) => {

            const isPrivate =
              msg.private &&
              (msg.user === username || msg.toUser === username);

            if (msg.private && !isPrivate) return null;

            return (

              <div
                key={index}
                className={
                  msg.user === "System"
                    ? "system-message"
                    : msg.user === username
                    ? "my-message"
                    : "message"
                }
              >

                {msg.user !== "System" && (

                  <div className="msg-header">

                    <img
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${msg.user}`}
                      className="avatar"
                      alt="avatar"
                    />

                    <b>{msg.user}</b>

                  </div>

                )}

                {msg.private
                  ? `(private) ${msg.message}`
                  : msg.message}

                <span className="time">
                  {msg.time
                    ? new Date(msg.time).toLocaleTimeString()
                    : ""}
                </span>

              </div>

            );

          })}

          <div ref={chatEndRef} />

        </div>

        {/* TYPING */}

        {typingUser && typingUser !== username && (
          <div className="typing">
            {typingUser} is typing...
          </div>
        )}

        {/* PRIVATE MESSAGE SELECT */}

        <div className="message-controls">

          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
          >

            <option value="">Public</option>

            {users
              .filter((u) => u !== username)
              .map((u) => (
                <option key={u} value={u}>
                  Private → {u}
                </option>
              ))}

          </select>

        </div>

        {/* EMOJI PICKER */}

        {showEmoji && (
          <EmojiPicker
            onEmojiClick={(emoji) =>
              setMessage((prev) => prev + emoji.emoji)
            }
          />
        )}

        {/* INPUT */}

        <div className="input-area">

          <button onClick={() => setShowEmoji(!showEmoji)}>
            😊
          </button>

          <input
            value={message}
            onChange={(e) => {

              setMessage(e.target.value);

              socket.emit("typing", {
                room,
                user: username
              });

            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder="Type message..."
          />

          <button onClick={sendMessage}>Send</button>

        </div>

      </div>

    </div>

  );

}

export default App;
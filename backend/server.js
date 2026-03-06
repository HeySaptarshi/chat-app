const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const Message = require("./models/Message");

const app = express();
app.use(cors({
  origin: "https://chat-app-orcin-seven-15.vercel.app/",
  methods: ["GET", "POST"]
}));

/* ---------------- MongoDB Connection ---------------- */

mongoose.connect("mongodb://127.0.0.1:27017/chatapp");

mongoose.connection.once("open", () => {
  console.log("MongoDB connected");
});

/* ---------------- Server Setup ---------------- */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

/* -------- Store users -------- */

const usersInRooms = {}; 
const userSocketMap = {}; 
// { username: socketId }

/* ---------------- Socket Connection ---------------- */

io.on("connection", (socket) => {

  console.log("User connected");

  /* -------- Join Room -------- */

  socket.on("join_room", async ({ room, user }) => {

    socket.join(room);
    socket.room = room;
    socket.user = user;

    userSocketMap[user] = socket.id;

    console.log(`${user} joined room: ${room}`);

    if (!usersInRooms[room]) {
      usersInRooms[room] = [];
    }

    if (!usersInRooms[room].includes(user)) {
      usersInRooms[room].push(user);
    }

    io.to(room).emit("room_users", usersInRooms[room]);

    // System join message
    io.to(room).emit("receive_message", {
      user: "System",
      message: `${user} joined the chat`,
      time: new Date()
    });

    const messages = await Message.find({ room }).sort({ time: 1 });

    socket.emit("chat_history", messages);
  });

  /* -------- Send Message -------- */

  socket.on("send_message", async (data) => {

    const messageData = {
      user: data.user,
      room: data.room,
      message: data.message,
      time: new Date()
    };

    const newMessage = new Message(messageData);
    await newMessage.save();

    io.to(data.room).emit("receive_message", messageData);
  });

  /* -------- Private Message -------- */

socket.on("private_message", ({ room, user, toUser, message }) => {

  const messageData = {
    user,
    toUser,
    room,
    message,
    private: true,
    time: new Date()
  };

  const receiverSocket = userSocketMap[toUser];

  // send to receiver
  if (receiverSocket) {
    io.to(receiverSocket).emit("receive_message", messageData);
  }

  // send back to sender
  socket.emit("receive_message", messageData);

});

  /* -------- Typing Indicator -------- */

  socket.on("typing", ({ room, user }) => {
    socket.to(room).emit("typing", user);
  });

  socket.on("stop_typing", ({ room }) => {
    socket.to(room).emit("stop_typing");
  });

  /* -------- Disconnect -------- */

  socket.on("disconnect", () => {

    const room = socket.room;
    const user = socket.user;

    delete userSocketMap[user];

    if (room && usersInRooms[room]) {

      usersInRooms[room] =
        usersInRooms[room].filter(u => u !== user);

      io.to(room).emit("room_users", usersInRooms[room]);

      io.to(room).emit("receive_message", {
        user: "System",
        message: `${user} left the chat`,
        time: new Date()
      });
    }

    console.log("User disconnected");
  });

});

/* ---------------- Server Listen ---------------- */

server.listen(5000, () => {
  console.log("Server running on port 5000");
});
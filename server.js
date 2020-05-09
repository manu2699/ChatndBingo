const express = require("express");
const path = require("path");

const app = express();

// const redis = require("redis");
// let redisClient;
// if (process.env.REDIS_URL) {
//   redisClient = redis.createClient(process.env.REDIS_URL)
// } else {
//   redisClient = redis.createClient()
// }

if (process.env.NODE_ENV === "production") {
  // Serve any static files
  app.use(express.static(path.join(__dirname, "client/build")));
  // Handle React routing, return all requests to React app
  app.get("*", function (req, res) {
    res.sendFile(path.join(__dirname, "client", "build", "index.html"));
  });
}

const port = process.env.PORT || 5000;
const serveHost = process.env.YOUR_HOST || "0.0.0.0";

var server = app.listen(port, serveHost, () => {
  console.log(`Server running on ${port}`);
});

// var io = require("socket.io")(server);
// io.on("connection", socket => {

//   socket.on('CreateRoom', ({ user, id }) => {
//     let roomName = Math.floor((Math.random() * 9999))

//     socket.join(roomName, () => {

//       redisClient.hset(roomName, user, 0, (error, reply) => {
//         console.log(`New ${roomName} created`, error, reply)
//       })

//       io.to(roomName).emit('CreatedRoom', { user, roomName });
//     });

//   });

//   socket.on('JoinRoom', ({ user, room, id, type }) => {

//     redisClient.hgetall(room, (error, reply) => {
//       console.log(error, reply)
//       if (reply == null) {
//         io.emit(`NoRoom/${id}`, { user, room })
//       }
//       if (reply != null && reply != undefined) {
//         let len = Object.keys(reply).length;
//         if (len <= 3 && len > 0) {

//           socket.join(room, () => {
//             if (type == "creator") {
//             }
//             else {
//               redisClient.hset(room, user, 0, (error, reply) => {
//                 console.log(`New ${room} created`, error, reply)
//               })
//             }
//             io.to(room).emit('JoinedRoom', { user, room })
//           })

//         }
//         else {
//           io.emit(`FullRoom/${id}`, { user, room })
//         }
//       }
//     })

//   })

//   socket.on('CheckRoom', ({ roomId, id }) => {
//     redisClient.hgetall(roomId, (error, reply) => {
//       console.log(error, reply)
//       if (reply == null) {
//         io.emit(`NoRoom/${id}`, { roomId })
//       }
//       if (reply != null && reply != undefined) {
//         let len = Object.keys(reply).length;
//         if (len <= 3 && len > 0) {
//           io.emit(`Available/${id}`, { roomId })
//         }
//         else {
//           io.emit(`FullRoom/${id}`, { roomId })
//         }
//       }
//     })
//   })

//   socket.on('GetUsers', ({ room }) => {
//     redisClient.hgetall(room, (error, reply) => {
//       let keys = Object.keys(reply), vals = Object.values(reply), arr = [], tot = 0;
//       for (let i = 0; i < keys.length; i++) {
//         arr = [...arr, keys[i], vals[i]]
//         tot += Number(vals[i]);
//       }
//       if (tot == keys.length && tot >= 1) {
//         io.to(room).emit("CanPlay", true)
//       }
//       io.to(room).emit("Users", arr)
//     })
//   })

//   socket.on('Msg', ({ user, room, msg }) => {
//     io.to(room).emit("Msg", { user, room, msg })
//   })

//   socket.on("Ready", ({ user, room }) => {
//     redisClient.hset(room, user, 1, (error, reply) => {
//       io.to(room).emit("Ready", ({ user }))
//     })
//   })

//   socket.on('GameStart', ({ user, room }) => {
//     redisClient.hgetall(room, (error, reply) => {
//       let keys = Object.keys(reply);
//       for (let i = 0; i < keys.length; i++) {
//         redisClient.lpush(`Game/${room}/list`, keys[i], (e, r) => { });
//       }
//       redisClient.setex(`Game/${room}/cntr`, 1000, -1, (e, r) => { })
//       io.to(room).emit('GameStart', { len: keys.length, next: keys[0] })
//     })
//   })

//   socket.on('Cuts', ({ user, room, val, len }) => {
//     redisClient.incr(`Game/${room}/cntr`, (e, r) => {
//       let index = r % len;
//       redisClient.lindex(`Game/${room}/list`, index, (e, r) => {
//         let nextUser = r;
//         // console.log(nextUser, index, len)
//         io.to(room).emit('MadeCut', { user, room, val, nextUser })
//       })
//     })
//   })

//   socket.on("Win", ({ name, room }) => {
//     console.log("name", name)
//     io.to(room).emit("Won", name)
//   })

//   socket.on('PlayAgain', ({ room }) => {
//     redisClient.hgetall(room, (error, reply) => {
//       let users = Object.keys(reply);
//       for (let i = 0; i < users.length; i++) {
//         redisClient.hset(room, users[i], 0, (error, reply) => {
//           // console.log(users[i], reply)
//         })
//       }
//       io.to(room).emit("Reset", { room });
//     })
//   })

// });

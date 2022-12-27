const express = require("express");
const path = require("path");
const { createServer } = require("http");
const { Server: WsServer } = require("socket.io");

const app = express();

const redis = require("redis");
let redisClient;
if (process.env.REDIS_URL) {
	redisClient = redis.createClient({ url: process.env.REDIS_URL });
} else {
	redisClient = redis.createClient();
}
redisClient.on("error", (err) => {
	console.info("redis client error", err);
});
redisClient.connect().then(() => console.info("redis client connected"));

if (process.env.NODE_ENV === "production") {
	// Serve any static files
	app.use(express.static(path.join(__dirname, "client/build")));
	// Handle React routing, return all requests to React app
	app.get("*", function (req, res) {
		res.sendFile(path.join(__dirname, "client", "build", "index.html"));
	});
}

const port = process.env.PORT || 10000;
const serveHost = process.env.YOUR_HOST || "0.0.0.0";

const httpServer = createServer(app);
httpServer.listen(port, serveHost, () => {
	console.log(`Server running on ${serveHost}:${port}`);
});

const io = new WsServer(httpServer, {
	cors: {
		origin: ["http://localhost:3000", process.env.HOST]
	}
});
io.on("connection", (socket) => {
	console.info("socket connected");

	socket.on("CreateRoom", async ({ user, id }) => {
		let roomName = Math.floor(Math.random() * 9999).toString();
		socket.join(roomName);
		await redisClient
			.hSet(roomName, user, 0)
			.catch((err) => console.error("err in hSet", err));

		io.to(roomName).emit("CreatedRoom", { user, roomName });
		console.info("created Room", roomName);
	});

	socket.on("JoinRoom", async ({ user, room: roomName, id, type }) => {
		const roomsInfo = await redisClient
			.hGetAll(roomName)
			.catch((error) => {});
		console.log("On Join room", roomsInfo, typeof roomsInfo);
		if (roomsInfo === null) {
			io.emit(`NoRoom/${id}`, { user, room: roomName });
		}
		if (roomsInfo !== null && roomsInfo !== undefined) {
			let len = Object.keys(roomsInfo).length;
			if (len <= 3 && len > 0) {
				socket.join(roomName);
				if (type !== "creator") {
					await redisClient
						.hSet(roomName, user, 0)
						.catch((err) => {});
					const newRoomInf = await redisClient
						.hGetAll(roomName)
						.catch((err) => {});
					console.log("On join room users", {
						newRoomInf,
						user,
						roomName,
						id,
						type
					});
				}
				io.to(roomName).emit("JoinedRoom", {
					user,
					room: roomName
				});
			} else {
				io.emit(`FullRoom/${id}`, { user, room: roomName });
			}
		}
	});

	socket.on("CheckRoom", async ({ roomId, id }) => {
		const roomInfo = await redisClient.hGetAll(roomId).catch((err) => {});
		console.log("On Check room", roomsInfo, typeof roomsInfo);

		if (roomInfo === null) {
			io.emit(`NoRoom/${id}`, { roomId });
		}
		if (roomInfo !== null && roomInfo !== undefined) {
			let len = Object.keys(roomInfo).length;
			if (len <= 3 && len > 0) {
				io.emit(`Available/${id}`, { roomId });
			} else {
				io.emit(`FullRoom/${id}`, { roomId });
			}
		}
	});

	socket.on("GetUsers", async ({ room }) => {
		const roomInfo = await redisClient.hGetAll(room).catch((err) => {});
		console.log("On get users", roomInfo, typeof roomInfo);

		const keys = Object.keys(roomInfo);
		const vals = Object.values(roomInfo);

		let arr = [];
		let total = 0;
		for (let i = 0; i < keys.length; i++) {
			arr = [...arr, keys[i], vals[i]];
			total += Number(vals[i]);
		}
		if (total == keys.length && total >= 1) {
			io.to(room).emit("CanPlay", true);
		}
		io.to(room).emit("Users", arr);
	});

	socket.on("SMsg", ({ user, room, msg }) => {
		socket.to(room).emit("Msg", { user, room, msg });
	});

	socket.on("Ready", async ({ user, room }) => {
		await redisClient.hSet(room, user, 1).catch((err) => {});
		io.to(room).emit("Ready", { user });
	});

	socket.on("GameStart", async ({ user, room }) => {
		const roomsInfo = await redisClient.hGetAll(room).catch((err) => {});

		let keys = Object.keys(roomsInfo);
		for (let i = 0; i < keys.length; i++) {
			await redisClient
				.lPush(`Game/${room}/list`, keys[i], (e, r) => {})
				.catch((err) => {});
		}

		redisClient.EXPIRE(`Game/${room}/list`, 2600).catch((err) => {});
		redisClient.SETEX(`Game/${room}/cntr`, 1000, -1).catch((err) => {});

		io.to(room).emit("GameStart", {
			len: keys.length,
			next: keys[0]
		});
	});

	socket.on("Cuts", async ({ user, room, val, len }) => {
		const counter = await redisClient
			.INCR(`Game/${room}/cntr`)
			.catch((err) => {});

		console.log("On Play cut counter : ", counter);

		const index = counter % len;
		const nextDetails = await redisClient
			.LINDEX(`Game/${room}/list`, index)
			.catch((err) => {});
		let nextUser = nextDetails;

		console.log("On Play cut nextUsr : ", index, nextDetails);

		io.to(room).emit("MadeCut", {
			user,
			room,
			val,
			nextUser
		});
	});

	socket.on("Win", ({ name, room }) => {
		io.to(room).emit("Won", name);
	});

	socket.on("PlayAgain", async ({ room }) => {
		const roomInfo = await redisClient.hGetAll(room).catch((err) => {});
		console.log("On Play again", roomInfo);

		const users = Object.keys(roomInfo);
		for (let i = 0; i < users.length; i++) {
			await redisClient.hSet(room, users[i], 0).catch((err) => {});
		}

		const deletedResp = await redisClient
			.DEL(`Game/${room}/list`, `Game/${room}/cntr`)
			.catch((error) => {});
		console.log("deleted rooms", deletedResp);

		io.to(room).emit("Reset", { room });
	});

	socket.on("Leave", async ({ room, user }) => {
		await redisClient.HDEL(room, user).catch((err) => {});
		io.to(room).emit("Left", { user });
	});
});

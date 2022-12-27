import React, { useEffect, useState, useRef } from "react";
import { Manager } from "socket.io-client";
import createRoom from "../images/createRoom.png";
import joinRoom from "../images/joinRoom.png";

const uniqid = require("uniqid");

const Home = (props) => {
	const uid = useRef(uniqid.time());
	const socketRef = useRef({});
	const [name, setName] = useState("");
	const [roomId, setRoomID] = useState("");
	const [error, setError] = useState("");

	let ReactIsInDevelomentMode = () => {
		return "_self" in React.createElement("div");
	};

	const Create = () => {
		const socket = socketRef.current;
		socket.emit(`CreateRoom`, { user: name, id: uid.current });

		socket.on("CreatedRoom", ({ user, roomName }) => {
			console.info("on create room client", { user, roomName });
			props.history.push({
				pathname: `/room/${roomName}`,
				RoomCreated: true,
				name
			});
		});
	};

	const Check = () => {
		const socket = socketRef.current;
		socket.emit(`CheckRoom`, { roomId, id: uid.current });

		socket.on(`Available/${uid.current}`, ({ roomId }) => {
			props.history.push({
				pathname: `/room/${roomId}`,
				RoomCreated: false
			});
		});

		socket.on(`NoRoom/${uid.current}`, ({ roomId }) => {
			setError(`No Room called ${roomId} is found`);
		});

		socket.on(`FullRoom/${uid.current}`, ({ roomId }) => {
			setError(`Room ${roomId} is full`);
		});
	};

	useEffect(() => {
		const Detect = ReactIsInDevelomentMode();
		let url = "https://chatndbingo.onrender.com";
		if (Detect) {
			url = "http://localhost:10000";
		}
		const manager = new Manager(url, { autoConnect: true });
		manager.open((err, resp) => {
			if (err) {
				console.info("error while connecting socket", err);
			} else {
				console.info("socket connected successfully", resp);
			}
		});
		socketRef.current = manager.socket("/");
	}, []);

	return (
		<div>
			<div className='row' style={{ height: "100vh" }}>
				<div className='col'>
					<center>
						<h2>Create New</h2>
						<img src={createRoom} alt='' className='img' />
						<br />
						<input
							className='input'
							type='text'
							autoComplete='off'
							onKeyPress={(e) => {
								if (
									e.key === "Enter" &&
									e.target.value.length > 0
								) {
									Create();
								}
							}}
							placeholder='Your Name'
							onChange={(e) => setName(e.target.value)}
						/>
						<br />
						{name.length > 0 ? (
							<button
								id='home'
								onClick={() => {
									Create();
								}}>
								Create Room
							</button>
						) : (
							<button
								id='home'
								disabled
								style={{ opacity: 0.75 }}>
								Enter your name to Create Room
							</button>
						)}
					</center>
				</div>
				<div className='col'>
					<center>
						<h2>Join One</h2>
						<img src={joinRoom} alt='' className='img' />
						<br />
						<input
							id='name'
							className='input'
							type='text'
							autoComplete='off'
							onKeyPress={(e) => {
								if (
									e.key === "Enter" &&
									e.target.value.length > 0
								) {
									Check();
								}
							}}
							placeholder='Room ID'
							onChange={(e) => setRoomID(e.target.value)}
						/>
						<br />
						{roomId.length > 0 ? (
							<button
								id='home'
								onClick={() => {
									Check();
								}}>
								Check Room
							</button>
						) : (
							<button
								id='home'
								disabled
								style={{ opacity: 0.75 }}>
								Enter Room ID to Check.
							</button>
						)}

						<div style={{ margin: "10px " }}>{error}</div>
					</center>
				</div>
			</div>
		</div>
	);
};

export default Home;

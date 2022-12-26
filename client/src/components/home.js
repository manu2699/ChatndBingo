import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import createRoom from "../images/createRoom.png";
import joinRoom from "../images/joinRoom.png";

let uniqid = require("uniqid");
const Home = (props) => {
	let [url, setURL] = useState("");
	let [uid, setUID] = useState(uniqid.time());
	let [name, setName] = useState("");
	let [roomId, setRoomID] = useState("");
	let [error, setError] = useState("");

	let ReactIsInDevelomentMode = () => {
		return "_self" in React.createElement("div");
	};

	let Create = () => {
		let socket = io(url);
		socket.emit(`CreateRoom`, { user: name, id: uid });

		socket.on("CreatedRoom", ({ user, roomName }) => {
			console.log(user, roomName);
			props.history.push({
				pathname: `/room/${roomName}`,
				RoomCreated: true,
				name
			});
		});
	};

	let Check = () => {
		let socket = io(url);
		socket.emit(`CheckRoom`, { roomId, id: uid });

		socket.on(`Available/${uid}`, ({ roomId }) => {
			props.history.push({
				pathname: `/room/${roomId}`,
				RoomCreated: false
			});
		});

		socket.on(`NoRoom/${uid}`, ({ roomId }) => {
			setError(`No Room called ${roomId} is found`);
		});

		socket.on(`FullRoom/${uid}`, ({ roomId }) => {
			setError(`Room ${roomId} is full`);
		});
	};

	useEffect(() => {
		const Detect = ReactIsInDevelomentMode();
		if (Detect) {
			setURL("http://localhost:5000");
			// setURL("https://chatndbingo.onrender.com");
		} else {
			setURL("https://chatndbingo.onrender.com");
		}
	});

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

import React, { useEffect, useState, useRef } from "react";
import { Manager } from "socket.io-client";
import joinRoom from "../images/joinRoom.png";
import roomMembers from "../images/roomMembers.png";
import { BingoMatrix } from "./bingoMatrix";

const uniqid = require("uniqid");
const word = "BINGO";
const boxIdPrefix = "bingo-box-";

const OnRoom = (props) => {
	const uid = useRef(uniqid.time());
	const socketRef = useRef({});

	const [joined, setJoined] = useState(false);
	const [joinedUsers, setjoinedUsers] = useState([]);
	const [name, setName] = useState("");
	const [error, setError] = useState("");
	const [currMsg, setCurrMsg] = useState("");
	const [msgs, setMsgs] = useState([
		{ user: "BINGO_BOT", msg: "Welcome All..." },
		{
			user: "BINGO_BOT",
			msg: "1) Share this Link or RoomID to your Friends..(Room has a occupant size of Four Members..)"
		},
		{
			user: "BINGO_BOT",
			msg: "2) You can Randomize or Drag & drop to rearrange Bingo Box. Then Click on Ready after you have randomized bingo box"
		},
		{
			user: "BINGO_BOT",
			msg: "3) Once all members in Room are ready the Game can be Started... Meahwhile you can chat with your friends in room here... Have Fun !"
		}
	]);
	const [isPlaying, setIsPlaying] = useState(false);
	const [liveRep, setLiveRep] = useState("");
	const [canPlay, setCanPlay] = useState(false);
	const [len, setLen] = useState(0);
	const [turn, setTurn] = useState("");
	const [matrix, setMatrix] = useState([
		[1, 2, 3, 4, 5],
		[6, 7, 8, 9, 10],
		[11, 12, 13, 14, 15],
		[16, 17, 18, 19, 20],
		[21, 22, 23, 24, 25]
	]);
	const [gameOver, setGameOver] = useState(false);

	const leftColumn = useRef("false");
	const rightColumn = useRef("false");
	const gameCounter = useRef(0);

	const randomizeMatrix = () => {
		const arr = [];
		let index = 1;
		const newMatrix = [...matrix];
		let i = 0;
		let j = 0;
		while (arr.length < 25) {
			let randomNum = Math.floor(Math.random() * 25) + 1;
			if (arr.indexOf(randomNum) === -1) {
				document.getElementById(`${boxIdPrefix}${index}`).innerText =
					randomNum;
				newMatrix[i][j] = randomNum;
				arr.push(randomNum);
				index += 1;
				if ((index - 1) % 5 === 0) {
					i += 1;
					j = 0;
				} else {
					j += 1;
				}
			}
		}
		setMatrix(newMatrix);
	};

	const ReactIsInDevelomentMode = () => {
		return "_self" in React.createElement("div");
	};

	const changeBox = (x, y) => {
		let id = 5 * x + (y + 1);
		document.getElementById(`${boxIdPrefix}${id}`).className = "cut";
	};

	const getIndex = (id) => {
		id = Number(id);
		let row = 0,
			col = 0;
		if (id % 5 === 0) {
			row = Math.floor(id / 5) - 1;
			col = 4;
		} else {
			row = Math.floor(id / 5);
			col = (id % 5) - 1;
		}
		return [row, col];
	};

	const findAndCut = (val) => {
		let newMatrix = [...matrix];
		for (let i = 0; i < 5; i++) {
			let index = newMatrix[i].indexOf(Number(val));
			if (index !== -1) {
				newMatrix[i][index] = newMatrix[i][index] * -1;
				setMatrix(newMatrix);
				changeBox(i, index);
				check(i, index);
			}
		}
	};

	const check = (x, y) => {
		gameCounter.current =
			checkRow(x) +
			checkColumn(y) +
			checkLeftDiagonal() +
			checkRightDiagonal() +
			gameCounter.current;

		if (gameCounter.current >= 5) {
			let toSend = props.location.name;
			if (toSend == null) toSend = name;
			socketRef.current.emit("Win", {
				name: toSend,
				room: props.match.params.id
			});
		}
		let win = word.substr(0, gameCounter.current);
		for (const i of win) {
			document.getElementById(i).style = "opacity: 1;";
		}
	};

	const checkRow = (i) => {
		let tc = 0;
		for (let j = 0; j < 5; j++) {
			if (matrix[i][j] < 0) tc++;
		}
		return tc == 5 ? 1 : 0;
	};

	const checkColumn = (i) => {
		let tc = 0;
		for (let j = 0; j < 5; j++) {
			if (matrix[j][i] < 0) tc++;
		}
		return tc == 5 ? 1 : 0;
	};

	const checkLeftDiagonal = () => {
		if (leftColumn.current == "false") {
			let tc = 0;
			for (let i = 0; i < 5; i++) {
				if (matrix[i][i] < 0) tc++;
			}
			if (tc == 5) {
				let set = "true";
				leftColumn.current = set;
				// console.log(leftColumn);
				return 1;
			} else {
				return 0;
			}
		} else {
			return 0;
		}
	};

	const checkRightDiagonal = () => {
		if (rightColumn.current == "false") {
			let tc = 0;
			for (let i = 0; i < 5; i++) {
				if (matrix[i][4 - i] < 0) tc++;
			}
			if (tc == 5) {
				let set = "true";
				rightColumn.current = set;
				// console.log(rightColumn);
				return 1;
			} else {
				return 0;
			}
		} else {
			return 0;
		}
	};

	const getUsers = () => {
		socketRef.current.emit("GetUsers", { room: props.match.params.id });
	};

	useEffect(() => {
		console.log(msgs);
	}, [msgs]);

	const ready = () => {
		socketRef.current.emit(`Ready`, {
			user: name,
			room: props.match.params.id
		});
	};

	const startEmit = () => {
		socketRef.current.emit(`GameStart`, {
			user: name,
			room: props.match.params.id
		});
	};

	const reset = () => {
		for (let i = 1; i <= 25; i++) {
			document.getElementById(`${boxIdPrefix}${i}`).className =
				"untouched";
		}
		for (const i of "BINGO") {
			document.getElementById(i).style = "opacity: 0.3;";
		}
	};

	const JoinAndListen = (onJoin, isCreator = false) => {
		const socket = socketRef.current;

		socket.emit(`JoinRoom`, {
			user: name,
			room: props.match.params.id,
			id: uid,
			type: isCreator ? "creator" : "joinee"
		});

		socket.on("JoinedRoom", ({ user, room }) => {
			onJoin && onJoin();
			getUsers();
		});

		socket.on(`NoRoom/${uid}`, ({ user, room }) => {
			setError(`No Room called ${room} is found`);
		});

		socket.on(`FullRoom/${uid}`, ({ user, room }) => {
			setError(`Room ${room} is full`);
		});

		socket.on("Users", (reply) => {
			setjoinedUsers([...reply]);
		});

		socket.on("Msg", ({ user, room, msg }) => {
			setMsgs((msgs) => [...msgs, { user, room, msg }]);
			autoScroll();
		});

		socket.on("Ready", ({ user }) => {
			getUsers();
		});

		socket.on("CanPlay", (val) => {
			if (val) {
				setCanPlay(true);
			}
		});

		socket.on("GameStart", ({ len, next }) => {
			setIsPlaying(true);
			setLen(len);
			setLiveRep(`${next}'s turn`);
			setTurn(next);
		});

		socket.on("MadeCut", ({ user, room, val, nextUser }) => {
			findAndCut(val);
			setLiveRep(
				`${user} striken ${val}...  Its ${nextUser}'s turn now...!`
			);
			setTurn(nextUser);
		});

		socket.on("Won", (name) => {
			setLiveRep(`${name} has made BINGO!...`);
			setGameOver(true);
			setCanPlay(false);
		});

		socket.on("Reset", ({ room }) => {
			getUsers();
			setIsPlaying(false);
			reset();
			setGameOver(false);
		});

		socket.on("Left", ({ user }) => {
			getUsers();
		});
	};

	const handleDrag = (event) => {
		event.dataTransfer.setData("value", event.target.innerText);
		event.dataTransfer.setData("index", event.target.id);
	};

	const handleDrop = (event) => {
		event.preventDefault();
		let originalData = event.target.innerText;
		let newData = event.dataTransfer.getData("value");
		event.target.innerText = newData;
		let swapIndex = event.dataTransfer.getData("index");
		document.getElementById(`${boxIdPrefix}${swapIndex}`).innerText =
			originalData;
		let src = getIndex(event.target.id);
		let dest = getIndex(swapIndex);
		let temp = matrix[src[0]][src[1]];
		matrix[src[0]][src[1]] = matrix[dest[0]][dest[1]];
		matrix[dest[0]][dest[1]] = temp;
		// console.log(matrix)
	};

	const allowDrop = (event) => {
		event.preventDefault();
	};

	const handleCut = (event) => {
		if (isPlaying && !gameOver) {
			if (turn == name) {
				socketRef.current.emit(`Cuts`, {
					user: name,
					room: props.match.params.id,
					val: event.target.innerText,
					len
				});
			} else {
				setLiveRep(`Its ${turn}'s turn not yours..!`);
			}
		}
	};

	const sendMsg = () => {
		socketRef.current.emit("SMsg", {
			user: name,
			room: props.match.params.id,
			msg: currMsg
		});
		setCurrMsg("");
		document.getElementById("message").value = "";
	};

	useEffect(() => {
		const Detect = ReactIsInDevelomentMode();
		let url = "https://chatndbingo.onrender.com";
		if (Detect) {
			url = "http://localhost:10000";
		} else {
			window.addEventListener("beforeunload", onUnload);
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

		if (props.location.RoomCreated) {
			setName(props.location.name);
			JoinAndListen(undefined, true);
		}
	}, []);

	const autoScroll = () => {
		const container = document.getElementById("chat-window");
		if (container) container.scrollTo(0, container.scrollHeight);
	};

	const playAgain = () => {
		socketRef.current.emit(`PlayAgain`, { room: props.match.params.id });
	};

	const leave = () => {
		socketRef.current.emit(`Leave`, {
			user: name,
			room: props.match.params.id
		});
		props.history.push("/");
	};

	const onUnload = (e) => {
		e.preventDefault();
		e.returnValue = "";
	};

	if (
		(props.location.RoomCreated == undefined ||
			props.location.RoomCreated == false) &&
		joined == false
	) {
		return (
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					height: "100vh"
				}}>
				<center>
					<h2>Room {props.match.params.id}</h2>
					<img src={joinRoom} alt='' className='img' />
					<br />
					<input
						className='input'
						id='name'
						type='text'
						autoComplete='off'
						placeholder='Enter Your Name'
						onKeyPress={(e) => {
							if (
								e.key === "Enter" &&
								e.target.value.length > 0
							) {
								JoinAndListen(() => setJoined(true));
							}
						}}
						onChange={(e) => setName(e.target.value)}
					/>
					<br />
					{name != undefined && name.length > 0 ? (
						<button
							id='home'
							onClick={() => {
								JoinAndListen(() => setJoined(true));
							}}>
							Join Room
						</button>
					) : (
						<button id='home' disabled style={{ opacity: 0.75 }}>
							Enter your name to Join Room
						</button>
					)}
					<br />
					<div style={{ margin: "10px " }}>{error}</div>
					<button
						id='start'
						onClick={() => {
							props.history.push("/");
						}}>
						Not this Room?
					</button>
				</center>
			</div>
		);
	} else {
		if (joinedUsers.length == 0) {
			return <div>No users joined</div>;
		} else {
			return (
				<div>
					<div className='row'>
						<div className='col'>
							<center>
								{!isPlaying ? (
									<h2>Room {props.match.params.id}</h2>
								) : (
									<div></div>
								)}

								{!isPlaying ? (
									<div>
										{canPlay ? (
											<button
												id='start'
												onClick={() => {
													startEmit();
												}}>
												Start the Game
											</button>
										) : (
											<img
												src={roomMembers}
												alt=''
												className='img'
												style={{ width: "40%" }}
											/>
										)}
									</div>
								) : (
									<div>
										<h6> {liveRep} </h6>
									</div>
								)}

								{isPlaying && gameOver ? (
									<button
										id='again'
										onClick={() => {
											playAgain();
										}}>
										Play Again
									</button>
								) : (
									<div></div>
								)}

								<div id='bottom'>
									<BingoMatrix
										boxIdPrefix={boxIdPrefix}
										onDrag={handleDrag}
										onDrop={handleDrop}
										onCut={handleCut}
										onAllowDrop={allowDrop}
									/>
								</div>

								{!isPlaying ? (
									<div>
										<button
											className='Randomize'
											onClick={() => {
												randomizeMatrix();
											}}>
											Randomize
										</button>
										<button
											className='Ready'
											onClick={() => {
												ready();
											}}>
											Ready
										</button>
									</div>
								) : (
									<div />
								)}
							</center>
						</div>

						<div className='col' id='chat'>
							<center>
								<h2>
									Chat <i className='fas fa-comments'></i>
								</h2>

								<div className='chatbox' id='chat-window'>
									{msgs != undefined && msgs.length > 0 ? (
										<div>
											{msgs.map((msg) => {
												return (
													<div>
														{msg.user == name ? (
															<div id='sentMsg'>
																<div
																	style={{
																		fontSize:
																			"10px",
																		fontWeight:
																			"bold"
																	}}>
																	You
																</div>
																<div>
																	{msg.msg}
																</div>
															</div>
														) : (
															<div id='receivedMsg'>
																<div
																	style={{
																		fontSize:
																			"10px",
																		fontWeight:
																			"bold"
																	}}>
																	{msg.user}
																</div>
																<div>
																	{msg.msg}
																</div>
															</div>
														)}
													</div>
												);
											})}
										</div>
									) : (
										<div>No Messages</div>
									)}
								</div>

								<div className='reply'>
									<input
										id='message'
										autoComplete='off'
										type='text'
										className='inputReply'
										placeholder='Reply'
										onKeyPress={(e) => {
											if (
												e.key === "Enter" &&
												e.target.value.length > 0
											) {
												sendMsg();
											}
										}}
										onChange={(e) =>
											setCurrMsg(e.target.value)
										}
									/>
									<button
										className='transparent'
										onClick={() => {
											sendMsg();
										}}>
										<div className='fa-2x'>
											<i className='fas fa-paper-plane'></i>
										</div>
									</button>
								</div>

								<div>
									{!isPlaying ? (
										<div>
											<h4
												style={{
													color: "#3d5e85",
													fontSize: "1.2em"
												}}>
												Members
											</h4>
											{joinedUsers.map((item, index) => {
												if (index % 2 == 0) {
													let isReady =
														"Not Ready yet";
													if (
														joinedUsers[
															index + 1
														] == "1"
													)
														isReady = "Ready !..";
													return (
														<h3>
															{item}
															<span className='readyIndicator'>
																{isReady}
															</span>
														</h3>
													);
												}
											})}
										</div>
									) : (
										<div />
									)}
								</div>
							</center>
						</div>
					</div>

					{!isPlaying ? (
						<div className='leave'>
							<button
								className='transparent'
								onClick={() => {
									document.getElementById(
										"overlay"
									).style.height = "100%";
								}}>
								Leave Room
								<div
									style={{
										color: "#3d5e85",
										fontSize: "1.2em"
									}}>
									<i class='fas fa-sign-out-alt'></i>
								</div>
							</button>
						</div>
					) : (
						<div></div>
					)}

					<div id='overlay'>
						<div>
							<center>
								<h6>Are you sure? Wanna leave room?</h6>
								<br />
								<button
									id='start'
									style={{
										width: "max-content",
										margin: "20px"
									}}
									onClick={() => {
										leave();
									}}>
									Yes
								</button>
								<button
									id='start'
									style={{ width: "max-content" }}
									onClick={() => {
										document.getElementById(
											"overlay"
										).style.height = "0";
									}}>
									No
								</button>
							</center>
						</div>
					</div>
				</div>
			);
		}
	}
};

export default OnRoom;

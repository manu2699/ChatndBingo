import React, { useEffect, useState } from 'react';
import io from "socket.io-client";
import joinRoom from '../images/joinRoom.png'
import roomMembers from '../images/roomMembers.png'

let uniqid = require('uniqid');

const OnRoom = (props) => {
  let [url, setURL] = useState("https://chatndbingo.herokuapp.com");
  let [uid, setUID] = useState(uniqid.time());
  let [joined, setJoined] = useState(false);
  let [joinedUsers, setjoinedUsers] = useState([]);
  let [name, setName] = useState("");
  let [error, setError] = useState("");
  let [currMsg, setCurrMsg] = useState("");
  let [msgs, setMsgs] = useState([{ user: "BINGO_BOT", msg: "Welcome All..." }, { user: "BINGO_BOT", msg: "1) Share this Link or RoomID to your Friends..(Room has a occupant size of Four Members..)" }, { user: "BINGO_BOT", msg: "2) You can Randomize or Drag & drop to rearrange Bingo Box. Then Click on Ready after you have randomized bingo box" }, { user: "BINGO_BOT", msg: "3) Once all members in Room are ready the Game can be Started... Meahwhile you can chat with your friends in room here... Have Fun !" }]);
  let [isPlaying, setIsPlaying] = useState(false);
  let [liveRep, setLiveRep] = useState("");
  let [canPlay, setCanPlay] = useState(false)
  let [len, setLen] = useState(0);
  let [turn, setTurn] = useState("");
  let [mat, setMat] = useState([[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12, 13, 14, 15], [16, 17, 18, 19, 20], [21, 22, 23, 24, 25]]);
  let [gameOver, setGameOver] = useState(false);
  let word = "BINGO";
  let leftColumn = "false", rightColumn = "false";
  let gc = 0;

  let randomize = () => {
    let arr = [], index = 1, nmat = [...mat];
    let i = 0, j = 0;
    while (arr.length < 25) {
      var r = Math.floor(Math.random() * 25) + 1;
      if (arr.indexOf(r) === -1) {
        document.getElementById(index).innerText = r;
        nmat[i][j] = r;
        arr.push(r);
        index++;
        if ((index - 1) % 5 === 0) {
          i++;
          j = 0;
        } else {
          j++;
        }
      }
    }
    setMat(nmat);
  }

  let ReactIsInDevelomentMode = () => {
    return "_self" in React.createElement("div");
  };

  let changeBox = (x, y) => {
    let id = (5 * x) + (y + 1);
    document.getElementById(id).className = "cut";
  }

  let getIndex = (id) => {
    id = Number(id);
    let row = 0, col = 0;
    if (id % 5 === 0) {
      row = Math.floor((id / 5)) - 1;
      col = 4;
    } else {
      row = Math.floor(id / 5)
      col = id % 5 - 1
    }
    return [row, col];
  }

  let finds = (val) => {
    let nmat = [...mat];
    for (let i = 0; i < 5; i++) {
      let ind = nmat[i].indexOf(Number(val));
      if (ind !== -1) {
        nmat[i][ind] = nmat[i][ind] * -1;
        setMat(nmat);
        // console.log(mat)
        changeBox(i, ind);
        check(i, ind);
      }
    }
  }

  let check = (x, y) => {
    gc = checkRow(x) + checkColumn(y) + checkLeftDiagonal() + checkRightDiagonal() + gc;

    if (gc >= 5) {
      let toSend = props.location.name;
      if (toSend == null)
        toSend = name
      let socket = io(url);
      socket.emit("Win", { name: toSend, room: props.match.params.id });
    }
    let win = word.substr(0, gc);
    for (const i of win) {
      document.getElementById(i).style = "opacity: 1;"
    }
  }

  let checkRow = (i) => {
    let tc = 0;
    for (let j = 0; j < 5; j++) {
      if (mat[i][j] < 0)
        tc++;
    }
    return (tc == 5) ? 1 : 0;
  }

  let checkColumn = (i) => {
    let tc = 0;
    for (let j = 0; j < 5; j++) {
      if (mat[j][i] < 0)
        tc++;
    }
    return (tc == 5) ? 1 : 0;
  }

  let checkLeftDiagonal = () => {
    if (leftColumn == "false") {
      let tc = 0
      for (let i = 0; i < 5; i++) {
        if (mat[i][i] < 0)
          tc++;
      }
      if (tc == 5) {
        let set = "true";
        leftColumn = set;
        // console.log(leftColumn);
        return 1;
      } else {
        return 0;
      }
    } else {
      return 0;
    }
  }

  let checkRightDiagonal = () => {
    if (rightColumn == "false") {
      let tc = 0;
      for (let i = 0; i < 5; i++) {
        if (mat[i][4 - i] < 0)
          tc++;
      }
      if (tc == 5) {
        let set = "true";
        rightColumn = set;
        // console.log(rightColumn);
        return 1;
      } else {
        return 0;
      }
    } else {
      return 0;
    }
  }

  let getUsers = () => {
    let socket = io(url)
    socket.emit('GetUsers', { room: props.match.params.id });
  }

  useEffect(() => {
    console.log(msgs)
  }, [msgs])

  let ready = () => {
    let socket = io(url);
    socket.emit(`Ready`, { user: name, room: props.match.params.id });
  }

  let startEmit = () => {
    let socket = io(url);
    socket.emit(`GameStart`, { user: name, room: props.match.params.id });
  }

  let reset = () => {
    for (let i = 1; i <= 25; i++) {
      document.getElementById(i).className = "untouched"
    }
    for (const i of "BINGO") {
      document.getElementById(i).style = "opacity: 0.3;"
    }

  }

  let Join = () => {
    let socket = io(url);
    socket.emit(`JoinRoom`, { user: name, room: props.match.params.id, id: uid });

    socket.on("JoinedRoom", ({ user, room }) => {
      setJoined(true)
      getUsers();
    })

    socket.on(`NoRoom/${uid}`, ({ user, room }) => {
      setError(`No Room called ${room} is found`)
    })

    socket.on(`FullRoom/${uid}`, ({ user, room }) => {
      setError(`Room ${room} is full`)
    })

    socket.on('Users', (reply) => {
      setjoinedUsers([...reply])
    })

    socket.on("Msg", ({ user, room, msg }) => {
      console.log("creator check 2")
      setMsgs(msgs => [...msgs, { user, room, msg }]);
      autoScroll();
    })

    socket.on("Ready", ({ user }) => {
      getUsers();
    })

    socket.on("CanPlay", (val) => {
      if (val) {
        setCanPlay(true)
      }
    })

    socket.on("GameStart", ({ len, next }) => {
      setIsPlaying(true);
      setLen(len);
      setLiveRep(`${next}'s turn`)
      setTurn(next);
    })

    socket.on("MadeCut", ({ user, room, val, nextUser }) => {
      finds(val)
      setLiveRep(`${user} striken ${val}...  Its ${nextUser}'s turn now...!`)
      setTurn(nextUser);
    })

    socket.on("Won", (name) => {
      setLiveRep(`${name} has made BINGO!...`)
      setGameOver(true)
      setCanPlay(false)
    })

    socket.on("Reset", ({ room }) => {
      getUsers();
      setIsPlaying(false)
      reset();
    })

    socket.on("Left", ({ user }) => {
      getUsers();
    })

  }

  let drag = (event) => {
    event.dataTransfer.setData("value", event.target.innerText);
    event.dataTransfer.setData("index", event.target.id)
  }

  let drop = (event) => {
    event.preventDefault();
    let originalData = event.target.innerText;
    let newData = event.dataTransfer.getData("value");
    event.target.innerText = newData;
    let swapIndex = event.dataTransfer.getData("index");
    document.getElementById(swapIndex).innerText = originalData;
    let src = getIndex(event.target.id), dest = getIndex(swapIndex);
    let temp = mat[src[0]][src[1]];
    mat[src[0]][src[1]] = mat[dest[0]][dest[1]]
    mat[dest[0]][dest[1]] = temp;
    // console.log(mat)
  }

  let allowDrop = (event) => { event.preventDefault() }

  let cut = (event) => {
    if (isPlaying && !gameOver) {
      if (turn == name) {
        let socket = io(url);
        socket.emit(`Cuts`, { user: name, room: props.match.params.id, val: event.target.innerText, len });
      } else {
        setLiveRep(`Its ${turn}'s turn not yours..!`)
      }
    }
  }

  let sendMsg = () => {
    let socket = io(url);
    socket.emit('SMsg', { user: name, room: props.match.params.id, msg: currMsg })
    setCurrMsg("");
    document.getElementById("message").value = "";
  }

  // useEffect(() => {

  // }, [url])

  useEffect(() => {
    const Detect = ReactIsInDevelomentMode();
    if (Detect) {
      setURL("http://localhost:5000");
    } else {
      setURL("https://chatndbingo.herokuapp.com");
      window.addEventListener("beforeunload", onUnload);
    }

    let socket = io(url);

    if (props.location.RoomCreated) {

      setName(props.location.name)

      socket.emit('JoinRoom', { user: props.location.name, room: props.match.params.id, type: "creator" })

      socket.on("JoinedRoom", ({ user, room }) => {
        getUsers();
      })

      socket.on('Users', (reply) => {
        setjoinedUsers([...reply])
      })

      socket.on("Msg", ({ user, room, msg }) => {
        console.log("creator check 1")
        setMsgs(msgs => [...msgs, { user, room, msg }]);
        autoScroll();
      })

      socket.on("Ready", ({ user }) => {
        getUsers();
      })

      socket.on("CanPlay", (val) => {
        if (val) {
          setCanPlay(true)
        }
      })

      socket.on("GameStart", ({ len, next }) => {
        setIsPlaying(true);
        setLen(len);
        setTurn(next);
      })

      socket.on("MadeCut", ({ user, room, val, nextUser }) => {
        finds(val)
        setLiveRep(`${user} striken ${val}...  Its ${nextUser}'s turn now...!`)
        setTurn(nextUser);
      })

      socket.on("Won", (name) => {
        setLiveRep(`${name} has made BINGO!...`)
        setGameOver(true)
        setCanPlay(false)
      })

      socket.on("Reset", ({ room }) => {
        getUsers();
        setIsPlaying(false)
        reset();
      })

      socket.on("Left", ({ user }) => {
        getUsers();
      })
    }

  }, [])

  let autoScroll = () => {
    const container = document.getElementById("chat-window");
    if (container) container.scrollTo(0, container.scrollHeight);
  };

  let playAgain = () => {
    let socket = io(url);
    socket.emit(`PlayAgain`, { room: props.match.params.id });
  }

  let leave = () => {
    let socket = io(url);
    socket.emit(`Leave`, { user: name, room: props.match.params.id });
    props.history.push('/');
  }

  let onUnload = e => {
    e.preventDefault();
    e.returnValue = '';
  }

  if ((props.location.RoomCreated == undefined || props.location.RoomCreated == false) && joined == false) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <center>
          <h2>Room {props.match.params.id}</h2>
          <img src={joinRoom} alt="" className="img" />
          <br />
          <input
            className="input"
            id="name"
            type="text"
            autoComplete="off"
            placeholder="Enter Your Name"
            onKeyPress={e => {
              if (
                e.key === "Enter" &&
                e.target.value.length > 0
              ) {
                Join();
              }
            }}
            onChange={e => setName(e.target.value)}
          />
          <br />
          {name != undefined && name.length > 0 ? (
            <button id="home" onClick={() => {
              Join();
            }}>Join Room</button>
          ) : (
              <button id="home" disabled style={{ opacity: 0.75 }}>
                Enter your name to Join Room
              </button>)}
          <br />
          <div style={{ margin: "10px " }}>{error}</div>
          <button id="start" onClick={() => {
            props.history.push('/');
          }}>Not this Room?</button>
        </center>
      </div>
    );
  } else {
    if (joinedUsers.length == 0) {
      return (
        <div>
          No users joined
        </div>
      )
    } else {
      return (
        <div>
          <div className="row">
            <div className="col">
              <center>
                {!isPlaying ? (<h2>Room {props.match.params.id}</h2>) : (<div></div>)}


                {!isPlaying ? (<div>
                  {canPlay ? (<button id="start" onClick={() => { startEmit() }}>Start the Game</button>) : (<img src={roomMembers} alt="" className="img" style={{ width: "40%" }} />)}
                </div>) : (
                    <div><h6> {liveRep} </h6>
                    </div>
                  )}

                {(isPlaying && gameOver) ? (<button id="again" onClick={() => { playAgain() }}>Play Again</button>) : (<div></div>)}

                <div id="bottom">
                  <div id="Bingo">
                    <table cellPadding="10px" cellSpacing="8px" style={{ textAlign: "center" }}>
                      <tbody><tr>
                        <th id="B">B</th>
                        <th id="I">I</th>
                        <th id="N">N</th>
                        <th id="G">G</th>
                        <th id="O">O</th>
                      </tr>
                        <tr>
                          <td id={1} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            1
                </td>
                          <td id={2} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            2
                </td>
                          <td id={3} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            3
                </td>
                          <td id={4} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            4
                </td>
                          <td id={5} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            5
                </td>
                        </tr>
                        <tr>
                          <td id={6} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            6
                </td>
                          <td id={7} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            7
                </td>
                          <td id={8} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            8
                </td>
                          <td id={9} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            9
                </td>
                          <td id={10} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            10
                </td>
                        </tr>
                        <tr>
                          <td id={11} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            11
                </td>
                          <td id={12} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            12
                </td>
                          <td id={13} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            13
                </td>
                          <td id={14} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            14
                </td>
                          <td id={15} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            15
                </td>
                        </tr>
                        <tr>
                          <td id={16} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            16
                </td>
                          <td id={17} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            17
                </td>
                          <td id={18} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            18
                </td>
                          <td id={19} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            19
                </td>
                          <td id={20} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            20
                </td>
                        </tr>
                        <tr>
                          <td id={21} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            21
                      </td>
                          <td id={22} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            22
                      </td>
                          <td id={23} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            23
                      </td>
                          <td id={24} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            24
                      </td>
                          <td id={25} draggable="true" onDragStart={(event) => { drag(event) }} onDrop={(event) => { drop(event) }} onDragOver={(event) => { allowDrop(event) }} className="untouched" onClick={(event) => { cut(event) }}>
                            25
                      </td>
                        </tr>
                      </tbody>
                    </table>

                  </div>
                </div>

                {!isPlaying ? (<div>
                  <button className="Randomize" onClick={() => { randomize() }}>Randomize</button>
                  <button className="Ready" onClick={() => { ready() }}>Ready</button>
                </div>) : (<div></div>)}

              </center>
            </div>

            <div className="col" id="chat">
              <center>
                <h2>Chat <i className="fas fa-comments"></i></h2>

                <div className="chatbox" id="chat-window">

                  {msgs != undefined && msgs.length > 0 ? (
                    <div>
                      {msgs.map(msg => {
                        return (
                          <div>
                            {msg.user == name ? (
                              <div id="sentMsg">
                                <div style={{ fontSize: "10px", fontWeight: "bold" }}>
                                  You
                        </div>
                                <div>{msg.msg}</div>
                              </div>
                            ) : (
                                <div id="receivedMsg">
                                  <div style={{ fontSize: "10px", fontWeight: "bold" }}>
                                    {msg.user}
                                  </div>
                                  <div>{msg.msg}</div>
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

                <div className="reply">
                  <input id="message" autoComplete="off" type="text" className="inputReply" placeholder="Reply" onKeyPress={e => {
                    if (
                      e.key === "Enter" &&
                      e.target.value.length > 0
                    ) {
                      sendMsg();
                    }
                  }}
                    onChange={e => setCurrMsg(e.target.value)}
                  />
                  <button className="transparent" onClick={() => { sendMsg() }}>
                    <div className="fa-2x">
                      <i className="fas fa-paper-plane"></i>
                    </div>
                  </button>
                </div>

                <div>
                  {!isPlaying ? (
                    <div>
                      <h4 style={{ color: "#3d5e85", fontSize: "1.2em" }}>Members</h4>
                      {joinedUsers.map((item, index) => {
                        if (index % 2 == 0) {
                          let isReady = "Not Ready yet";
                          if (joinedUsers[index + 1] == "1")
                            isReady = "Ready !.."
                          return (<h3>{item}<span className="readyIndicator">{isReady}</span></h3>)
                        }
                      })}
                    </div>
                  ) : (<div> </div>)}
                </div>
              </center>
            </div>

          </div>

          {!isPlaying ? (<div className="leave">
            <button className="transparent" onClick={() => {
              document.getElementById("overlay").style.height = "100%";
            }}>
              Leave Room
            <div style={{ color: "#3d5e85", fontSize: "1.2em" }}>
                <i class="fas fa-sign-out-alt"></i>
              </div>
            </button>
          </div>
          ) : (<div></div>)}


          <div id="overlay">
            <div>
              <center>
                <h6>
                  Are you sure? Wanna leave room?
                </h6>
                <br />
                <button id="start" style={{ width: "max-content", margin: "20px" }} onClick={() => {
                  leave();
                }}>Yes</button>
                <button id="start" style={{ width: "max-content" }} onClick={() => {
                  document.getElementById("overlay").style.height = "0";
                }}>No</button>
              </center>
            </div>
          </div>
        </div>
      );
    }
  }
}

export default OnRoom;
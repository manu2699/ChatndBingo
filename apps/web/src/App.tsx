import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import logo from "./assets/logo.png";
import { ConnectionPill } from "./components/ConnectionPill";
import { Confetti } from "./components/Confetti";
import { SoundOffIcon, SoundOnIcon } from "./components/icons";
import { Toasts } from "./components/Toasts";
import { setSound, useSound } from "./fx/prefs";
import { Home } from "./pages/Home";
import { RoomPage } from "./pages/Room";
import { connect } from "./state/game";

function Header() {
	const sound = useSound();
	return (
		<header className="header">
			<a className="brand" href="/">
				<img src={logo} alt="" width={36} />
				<span>Chat &amp; Bingo</span>
			</a>
			<button type="button" className="icon-btn" aria-pressed={sound} aria-label={sound ? "Mute sounds" : "Turn sounds on"} onClick={() => setSound(!sound)}>
				{sound ? <SoundOnIcon /> : <SoundOffIcon />}
			</button>
		</header>
	);
}

export function App() {
	useEffect(() => connect(), []);
	return (
		<BrowserRouter>
			<Header />
			<ConnectionPill />
			<Routes>
				<Route path="/" element={<Home />} />
				<Route path="/room/:code" element={<RoomPage />} />
				<Route path="*" element={<Home />} />
			</Routes>
			<Toasts />
			<Confetti />
		</BrowserRouter>
	);
}

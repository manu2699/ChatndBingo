import { prefersReducedMotion } from "./prefs";

interface Piece {
	x: number;
	y: number;
	vx: number;
	vy: number;
	size: number;
	rot: number;
	vr: number;
	color: string;
	shape: 0 | 1;
}

const COLORS = ["#f3506a", "#3d5e85", "#ffd166", "#06d6a0", "#4a97f5", "#ffffff"];

/** Fire a one-off confetti burst on a full-screen canvas. Resolves when the animation ends. */
export const burst = (canvas: HTMLCanvasElement, count = 140): Promise<void> => {
	if (prefersReducedMotion()) return Promise.resolve();
	const ctx = canvas.getContext("2d");
	if (!ctx) return Promise.resolve();

	const dpr = window.devicePixelRatio || 1;
	const w = (canvas.width = window.innerWidth * dpr);
	const h = (canvas.height = window.innerHeight * dpr);

	const pieces: Piece[] = Array.from({ length: count }, (_, i) => {
		const fromLeft = i % 2 === 0;
		const angle = (fromLeft ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7;
		const speed = (9 + Math.random() * 9) * dpr;
		return {
			x: (fromLeft ? 0.1 : 0.9) * w,
			y: h * 0.85,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			size: (6 + Math.random() * 6) * dpr,
			rot: Math.random() * Math.PI * 2,
			vr: (Math.random() - 0.5) * 0.4,
			color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
			shape: Math.random() > 0.5 ? 1 : 0
		};
	});

	return new Promise((resolve) => {
		const start = performance.now();
		const frame = (now: number) => {
			const t = now - start;
			ctx.clearRect(0, 0, w, h);
			let alive = 0;
			for (const p of pieces) {
				p.vy += 0.32 * dpr;
				p.vx *= 0.992;
				p.x += p.vx;
				p.y += p.vy;
				p.rot += p.vr;
				if (p.y < h + 40) alive++;
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rot);
				ctx.globalAlpha = Math.max(0, 1 - t / 4200);
				ctx.fillStyle = p.color;
				if (p.shape) {
					ctx.beginPath();
					ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
					ctx.fill();
				} else {
					ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
				}
				ctx.restore();
			}
			if (alive > 0 && t < 4500) requestAnimationFrame(frame);
			else {
				ctx.clearRect(0, 0, w, h);
				resolve();
			}
		};
		requestAnimationFrame(frame);
	});
};

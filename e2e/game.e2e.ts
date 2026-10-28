/**
 * Browser end-to-end tests. Needs a built web app (`bun run build`) and a Chromium:
 *   bunx playwright install chromium     # once
 *   bun run test:e2e
 * Set PLAYWRIGHT_CHROMIUM_PATH to use an existing Chromium binary.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright";

const PORT = 4311;
const base = `http://127.0.0.1:${PORT}`;

let server: Bun.Subprocess;
let browser: Browser;

beforeAll(async () => {
	server = Bun.spawn(["bun", "apps/server/src/index.ts"], {
		env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", TURN_SKIP_MS: "500" },
		stdout: "ignore",
		stderr: "inherit"
	});
	for (let i = 0; i < 50; i++) {
		try {
			if ((await fetch(`${base}/healthz`)).ok) break;
		} catch {
			await Bun.sleep(100);
		}
	}
	browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
});

afterAll(async () => {
	await browser?.close();
	server?.kill();
});

const player = async (name: string) => {
	const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
	const page = await ctx.newPage();
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
	return { page, errors, ctx };
};

const createRoom = async (page: Page, name: string) => {
	await page.goto(base);
	await page.locator(".field__input").first().fill(name);
	await page.getByRole("button", { name: "Create room" }).click();
	await page.waitForURL(/\/room\/[A-Z0-9]{5}$/);
	await page.waitForSelector(".board--edit");
	return page.url().split("/").pop()!;
};

const joinRoom = async (page: Page, code: string, name: string) => {
	await page.goto(`${base}/room/${code}`);
	await page.locator(".field__input").fill(name);
	await page.getByRole("button", { name: "Join room" }).click();
	await page.waitForSelector(".board--edit");
};

const startGame = async (host: Page, guest: Page) => {
	await host.getByRole("button", { name: "I'm ready" }).click();
	await guest.getByRole("button", { name: "I'm ready" }).click();
	await host.getByRole("button", { name: "Start the game" }).click();
	await host.waitForSelector(".board--play");
	await guest.waitForSelector(".board--play");
};

describe("browser e2e", () => {
	test("two players: create, join, chat, play to a win, play again", async () => {
		const a = await player("ann");
		const b = await player("bo");
		const code = await createRoom(a.page, "Ann");
		await joinRoom(b.page, code, "Bo");

		await a.page.getByRole("button", { name: "Shuffle" }).click();
		await startGame(a.page, b.page);

		await b.page.locator(".chat__input").fill("hello from bo");
		await b.page.locator(".send").click();
		await a.page.getByText("hello from bo").waitFor();

		for (let i = 0; i < 25; i++) {
			if (await a.page.locator(".turn--over").count()) break;
			const mover = (await a.page.locator(".turn--mine").count()) ? a.page : b.page;
			await mover.locator(".turn--mine").waitFor();
			await mover.locator(".cell--pickable").first().click();
			await mover.waitForTimeout(80);
		}
		await a.page.locator(".turn--over").waitFor();
		await b.page.locator(".turn--over").waitFor();

		await a.page.getByRole("button", { name: "Play again" }).click();
		await a.page.waitForSelector(".board--edit");
		await b.page.waitForSelector(".board--edit");

		expect([...a.errors, ...b.errors]).toEqual([]);
		await a.ctx.close();
		await b.ctx.close();
	}, 60_000);

	test("a reload mid-game resumes the same seat", async () => {
		const a = await player("ann");
		const b = await player("bo");
		const code = await createRoom(a.page, "Ann");
		await joinRoom(b.page, code, "Bo");
		await startGame(a.page, b.page);

		await a.page.locator(".cell--pickable").first().click();
		await a.page.reload();
		await a.page.waitForSelector(".board--play");
		expect(await a.page.locator(".cell--struck").count()).toBe(1);
		await expect(a.page.locator(".player", { hasText: "(you)" }).first().innerText()).resolves.toContain("Ann");
		await a.ctx.close();
		await b.ctx.close();
	}, 30_000);

	test("joining a missing room shows a clear message", async () => {
		const a = await player("ann");
		await a.page.goto(base);
		await a.page.locator(".field__input--code").fill("ZZZZZ");
		await a.page.getByRole("button", { name: "Find room" }).click();
		await a.page.getByText("No room called ZZZZZ").waitFor();
		await a.ctx.close();
	}, 30_000);

	test("tap-to-swap rearranges the board", async () => {
		const a = await player("ann");
		await createRoom(a.page, "Ann");
		const first = () => a.page.locator(".cell").nth(0).innerText();
		expect(await first()).toBe("1");
		await a.page.locator(".cell").nth(0).click();
		await a.page.locator(".cell").nth(4).click();
		await a.page.waitForTimeout(450);
		expect(await first()).toBe("5");
		await a.ctx.close();
	}, 30_000);
});

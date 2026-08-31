import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import request from "supertest";
import { Server as SocketIOServer } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";

import Server from "../server.js";
import { AuthService, COOKIE_NAME } from "../authService.js";
import ClientTracker from "../clientTracker.js";
import type { ServerConfig } from "../../types/config.js";

function buildConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
	return {
		port: 0,
		clientConfigs: ["bathroom"],
		rootConf: "root",
		providedModules: [],
		httpHeaders: {},
		...overrides,
	};
}

function extractCookie(setCookieHeader: string | string[] | undefined): string {
	const values = Array.isArray(setCookieHeader)
		? setCookieHeader
		: setCookieHeader
			? [setCookieHeader]
			: [];
	const raw = values.find((c) => c.startsWith(`${COOKIE_NAME}=`));
	if (!raw) throw new Error("No session cookie in response");
	return raw.split(";")[0]!; // "hms-session=<token>"
}

// server.ts writes "./workData/cTracker.json" using a bare relative path
// (not derived from an injectable rootDir like AuthService uses), so socket
// tests chdir into a scratch directory with a workData/ folder already
// present to keep those writes sandboxed instead of hitting the real project.
describe("Server", () => {
	let rootDir: string;
	let originalCwd: string;

	beforeEach(() => {
		rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dalamirror-server-"));
		fs.mkdirSync(path.join(rootDir, "workData"), { recursive: true });
		originalCwd = process.cwd();
		process.chdir(rootDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		fs.rmSync(rootDir, { recursive: true, force: true });
	});

	describe("authEndpoints", () => {
		function createHttpOnlyServer(): Server {
			const srv = new Server(buildConfig());
			srv.app = express();
			srv.app.use(express.json());
			srv.auth = new AuthService(rootDir);
			srv.authEndpoints();
			return srv;
		}

		it("logs in with valid credentials and sets a session cookie", async () => {
			const srv = createHttpOnlyServer();
			const res = await request(srv.app)
				.post("/auth/login")
				.send({ username: "admin", password: "admin" });

			expect(res.status).toBe(200);
			expect(res.body).toEqual({ username: "admin", displayName: "Admin", role: "admin" });
			expect(extractCookie(res.headers["set-cookie"])).toMatch(new RegExp(`^${COOKIE_NAME}=.+`));
		});

		it("rejects invalid credentials", async () => {
			const srv = createHttpOnlyServer();
			const res = await request(srv.app)
				.post("/auth/login")
				.send({ username: "admin", password: "wrong" });

			expect(res.status).toBe(401);
			expect(res.headers["set-cookie"]).toBeUndefined();
		});

		it("rejects a login request missing fields", async () => {
			const srv = createHttpOnlyServer();
			const res = await request(srv.app).post("/auth/login").send({ username: "admin" });
			expect(res.status).toBe(400);
		});

		it("rejects /auth/me without a cookie", async () => {
			const srv = createHttpOnlyServer();
			const res = await request(srv.app).get("/auth/me");
			expect(res.status).toBe(401);
		});

		it("resolves /auth/me with a valid cookie", async () => {
			const srv = createHttpOnlyServer();
			const loginRes = await request(srv.app)
				.post("/auth/login")
				.send({ username: "admin", password: "admin" });
			const cookie = extractCookie(loginRes.headers["set-cookie"]);

			const res = await request(srv.app).get("/auth/me").set("Cookie", cookie);
			expect(res.status).toBe(200);
			expect(res.body).toEqual({ username: "admin", displayName: "Admin", role: "admin" });
		});

		it("invalidates the session on logout", async () => {
			const srv = createHttpOnlyServer();
			const loginRes = await request(srv.app)
				.post("/auth/login")
				.send({ username: "admin", password: "admin" });
			const cookie = extractCookie(loginRes.headers["set-cookie"]);

			const logoutRes = await request(srv.app).post("/auth/logout").set("Cookie", cookie);
			expect(logoutRes.status).toBe(200);

			const meRes = await request(srv.app).get("/auth/me").set("Cookie", cookie);
			expect(meRes.status).toBe(401);
		});
	});

	describe("trackerSetup (socket)", () => {
		async function createTrackerHarness(
			trackedClients: ClientTracker[],
		): Promise<{ srv: Server; port: number }> {
			const srv = new Server(buildConfig());
			srv.app = express();
			srv.auth = new AuthService(rootDir);
			srv.trackedClients = trackedClients;
			srv.clientMap = new Map();
			srv.server = http.createServer(srv.app);
			srv.io = new SocketIOServer(srv.server, { cors: { origin: /.*$/, credentials: true } });
			srv.trackerSetup();

			await new Promise<void>((resolve) => srv.server!.listen(0, resolve));
			const port = (srv.server!.address() as AddressInfo).port;
			return { srv, port };
		}

		function connectClient(port: number, clientName: string, cookie?: string): ClientSocket {
			return ioClient(`http://localhost:${port}/`, {
				path: "/socket.io",
				query: { clientName, clientType: "mirror" },
				forceNew: true,
				transports: ["websocket"],
				extraHeaders: cookie ? { Cookie: cookie } : undefined,
			});
		}

		function onceConnected(client: ClientSocket): Promise<void> {
			return new Promise((resolve, reject) => {
				client.once("connect", () => resolve());
				client.once("connect_error", reject);
			});
		}

		async function teardown(srv: Server, ...clients: ClientSocket[]): Promise<void> {
			for (const c of clients) c.close();
			await srv.close();
		}

		it("disconnects a socket whose clientName is not a tracked client", async () => {
			const { srv, port } = await createTrackerHarness([]);
			const client = connectClient(port, "unknown-client");

			await new Promise<void>((resolve) => client.on("disconnect", () => resolve()));
			await teardown(srv, client);
		});

		it("marks a known client online on connection", async () => {
			const tracker = new ClientTracker("bathroom", "mirror");
			const { srv, port } = await createTrackerHarness([tracker]);
			const client = connectClient(port, "bathroom");

			await onceConnected(client);
			expect(tracker.status).toBe("online");
			expect(tracker.connections).toHaveLength(1);

			await teardown(srv, client);
		});

		it("marks a client offline and resets its user when its last connection closes", async () => {
			const tracker = new ClientTracker("bathroom", "mirror", null, null, "online", [], "dala");
			const { srv, port } = await createTrackerHarness([tracker]);
			const client = connectClient(port, "bathroom");
			await onceConnected(client);

			client.close();
			await new Promise((resolve) => setTimeout(resolve, 200)); // let the server process the disconnect

			expect(tracker.status).toBe("offline");
			expect(tracker.user).toBe("default");

			await srv.close();
		});

		it("ignores CHANGE_USER_X from a socket with no valid session", async () => {
			const tracker = new ClientTracker("bathroom", "mirror");
			const { srv, port } = await createTrackerHarness([tracker]);
			const client = connectClient(port, "bathroom"); // no cookie
			await onceConnected(client);

			client.emit("CHANGE_USER_X", { client: "bathroom", user: "someone" });
			await new Promise((resolve) => setTimeout(resolve, 200));

			expect(tracker.user).toBe("default");

			await teardown(srv, client);
		});

		it("cannot be used to impersonate another user — the server always substitutes the session's own username", async () => {
			const tracker = new ClientTracker("bathroom", "mirror");
			const { srv, port } = await createTrackerHarness([tracker]);

			srv.auth.createAccount("dala", "Dala", "user", "hunter2");
			const session = srv.auth.login("dala", "hunter2")!;

			const client = connectClient(port, "bathroom", `${COOKIE_NAME}=${session.token}`);
			await onceConnected(client);

			const received = new Promise<{ client: string; user: string }>((resolve) => {
				client.once("CHANGE_USER_Y", resolve);
			});

			// payload claims a different user than the one actually logged in on this socket
			client.emit("CHANGE_USER_X", { client: "bathroom", user: "admin" });
			const payload = await received;

			// server-side tracked state must reflect the real session identity, not the spoofed one
			expect(tracker.user).toBe("dala");
			// the broadcast the client actually acts on must match too
			expect(payload.user).toBe("dala");

			await teardown(srv, client);
		});

		it("allows an authenticated user to reset a client to GLOBAL", async () => {
			const tracker = new ClientTracker("bathroom", "mirror", null, null, "online", [], "dala");
			const { srv, port } = await createTrackerHarness([tracker]);

			srv.auth.createAccount("dala", "Dala", "user", "hunter2");
			const session = srv.auth.login("dala", "hunter2")!;

			const client = connectClient(port, "bathroom", `${COOKIE_NAME}=${session.token}`);
			await onceConnected(client);

			const received = new Promise<{ user: string }>((resolve) => {
				client.once("CHANGE_USER_Y", resolve);
			});
			client.emit("CHANGE_USER_X", { client: "bathroom", user: "GLOBAL" });
			const payload = await received;

			expect(tracker.user).toBe("GLOBAL");
			expect(payload.user).toBe("GLOBAL");

			await teardown(srv, client);
		});

		it("updates lastOnline on heartbeat", async () => {
			const tracker = new ClientTracker("bathroom", "mirror");
			const { srv, port } = await createTrackerHarness([tracker]);
			const client = connectClient(port, "bathroom");
			await onceConnected(client);

			const before = tracker.lastOnline?.getTime() ?? 0;
			await new Promise((resolve) => setTimeout(resolve, 10));
			client.emit("heartbeat");
			await new Promise((resolve) => setTimeout(resolve, 200));

			expect(tracker.lastOnline).toBeInstanceOf(Date);
			expect(tracker.lastOnline!.getTime()).toBeGreaterThanOrEqual(before);

			await teardown(srv, client);
		});
	});
});

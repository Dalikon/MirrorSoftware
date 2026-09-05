import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";

import Server from "../server.js";
import { AuthService, COOKIE_NAME } from "../authService.js";
import type { ServerConfig } from "../../types/config.js";

function buildConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
	const base: ServerConfig = {
		port: 0,
		address: "127.0.0.1",
		ipWhitelist: [],
		ipBlackList: [],
		https: false,
		httpHeaders: {
			contentSecurityPolicy: false,
			crossOriginOpenerPolicy: false,
			crossOriginEmbedderPolicy: false,
			crossOriginResourcePolicy: false,
			originAgentCluster: false,
		},
		checkServerInterval: 0,
		userSwitchMode: "SAVE",
		logLevel: [],
		reloadAfterServerRestart: false,
		language: "en",
		timeFormat: 24,
		units: "metric",
		zoom: 1,
		customCss: "",
		rootConf: "root",
		clientConfigs: ["bathroom"],
		providedModules: [],
	};
	return { ...base, ...overrides };
}

function makeServer(rootDir: string, config: ServerConfig = buildConfig()): Server {
	const srv = new Server(rootDir, config);
	srv.app = express();
	srv.app.use(express.json());
	srv.auth = new AuthService(rootDir);
	return srv;
}

function sessionCookie(auth: AuthService, username: string, password: string): string {
	const session = auth.login(username, password)!;
	return `${COOKIE_NAME}=${session.token}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// loadTrackerFile
// ─────────────────────────────────────────────────────────────────────────────

describe("Server.loadTrackerFile", () => {
	let rootDir: string;

	beforeEach(() => {
		rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dalamirror-tracker-"));
	});

	afterEach(() => {
		fs.rmSync(rootDir, { recursive: true, force: true });
	});

	it("loads trackers and resets status to offline and connections to []", () => {
		const raw = [
			{
				name: "bathroom",
				type: "mirror",
				lastOnline: "2026-01-01T00:00:00.000Z",
				connectedAt: "2026-01-01T00:01:00.000Z",
				status: "online",
				user: "dala",
				connections: [{ ip: "10.0.0.1", connectedAt: new Date().toISOString() }],
			},
		];
		fs.mkdirSync(path.join(rootDir, "workData"), { recursive: true });
		fs.writeFileSync(path.join(rootDir, "workData/cTracker.json"), JSON.stringify(raw));

		const srv = new Server(rootDir, buildConfig());
		srv.loadTrackerFile();

		expect(srv.trackedClients).toHaveLength(1);
		expect(srv.trackedClients[0]!.name).toBe("bathroom");
		expect(srv.trackedClients[0]!.status).toBe("offline");
		expect(srv.trackedClients[0]!.connections).toEqual([]);
		expect(srv.trackedClients[0]!.user).toBe("dala");
	});

	it("preserves lastOnline as a Date after loading", () => {
		const raw = [
			{
				name: "bathroom",
				type: "mirror",
				lastOnline: "2026-06-01T12:00:00.000Z",
				connectedAt: null,
				status: "offline",
				user: "default",
				connections: [],
			},
		];
		fs.mkdirSync(path.join(rootDir, "workData"), { recursive: true });
		fs.writeFileSync(path.join(rootDir, "workData/cTracker.json"), JSON.stringify(raw));

		const srv = new Server(rootDir, buildConfig());
		srv.loadTrackerFile();

		expect(srv.trackedClients[0]!.lastOnline).toBeInstanceOf(Date);
		expect(srv.trackedClients[0]!.lastOnline?.toISOString()).toBe("2026-06-01T12:00:00.000Z");
	});

	it("leaves trackedClients empty when the file does not exist", () => {
		const srv = new Server(rootDir, buildConfig());
		srv.loadTrackerFile();

		expect(srv.trackedClients).toEqual([]);
	});

	it("leaves trackedClients empty when the file contains malformed JSON", () => {
		fs.mkdirSync(path.join(rootDir, "workData"), { recursive: true });
		fs.writeFileSync(path.join(rootDir, "workData/cTracker.json"), "not valid json {{{");

		const srv = new Server(rootDir, buildConfig());
		srv.loadTrackerFile();

		expect(srv.trackedClients).toEqual([]);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// userEndpoints
// ─────────────────────────────────────────────────────────────────────────────

describe("Server.userEndpoints", () => {
	let rootDir: string;
	let srv: Server;
	let adminCookie: string;

	beforeEach(() => {
		rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dalamirror-user-ep-"));
		srv = makeServer(rootDir);
		srv.auth.createAccount("alice", "Alice", "user", "pass1");
		srv.userEndpoints();

		adminCookie = sessionCookie(srv.auth, "admin", "admin");
	});

	afterEach(() => {
		fs.rmSync(rootDir, { recursive: true, force: true });
	});

	it("returns 401 on all GET routes without a session cookie", async () => {
		for (const route of ["/user/config", "/user/config/bathroom", "/user/clients", "/user/modules/available"]) {
			const res = await request(srv.app).get(route);
			expect(res.status).toBe(401);
		}
	});

	it("returns 401 on PUT routes without a session cookie", async () => {
		const r1 = await request(srv.app).put("/user/config").send({ modules: [] });
		expect(r1.status).toBe(401);
		const r2 = await request(srv.app).put("/user/config/bathroom").send({ modules: [] });
		expect(r2.status).toBe(401);
	});

	describe("GET /user/config", () => {
		it("returns the global user config when it exists", async () => {
			const data = { name: "admin", modules: [{ module: "clock", position: "top_left" }] };
			const p = path.join(rootDir, "configs/users/admin.json");
			fs.mkdirSync(path.dirname(p), { recursive: true });
			fs.writeFileSync(p, JSON.stringify(data));

			const res = await request(srv.app).get("/user/config").set("Cookie", adminCookie);
			expect(res.status).toBe(200);
			expect(res.body).toEqual(data);
		});

		it("returns an empty-modules fallback when no config file exists", async () => {
			const res = await request(srv.app).get("/user/config").set("Cookie", adminCookie);
			expect(res.status).toBe(200);
			expect(res.body).toEqual({ name: "admin", modules: [] });
		});
	});

	describe("GET /user/config/:client", () => {
		it("returns the client-specific config when it exists", async () => {
			const data = { name: "admin", modules: [{ module: "clock" }] };
			const p = path.join(rootDir, "configs/bathroom/users/admin.json");
			fs.mkdirSync(path.dirname(p), { recursive: true });
			fs.writeFileSync(p, JSON.stringify(data));

			const res = await request(srv.app).get("/user/config/bathroom").set("Cookie", adminCookie);
			expect(res.status).toBe(200);
			expect(res.body).toEqual(data);
		});

		it("falls back to the global config when no client-specific file exists", async () => {
			const globalData = { name: "admin", modules: [{ module: "clock" }] };
			const p = path.join(rootDir, "configs/users/admin.json");
			fs.mkdirSync(path.dirname(p), { recursive: true });
			fs.writeFileSync(p, JSON.stringify(globalData));

			const res = await request(srv.app).get("/user/config/bathroom").set("Cookie", adminCookie);
			expect(res.status).toBe(200);
			expect(res.body).toEqual(globalData);
		});

		it("returns the empty-modules fallback when neither file exists", async () => {
			const res = await request(srv.app).get("/user/config/bathroom").set("Cookie", adminCookie);
			expect(res.status).toBe(200);
			expect(res.body).toEqual({ name: "admin", modules: [] });
		});
	});

	describe("GET /user/clients", () => {
		it("lists clients where the logged-in user appears in the users array", async () => {
			const p = path.join(rootDir, "configs/bathroom/bathroom.json");
			fs.mkdirSync(path.dirname(p), { recursive: true });
			fs.writeFileSync(p, JSON.stringify({ users: ["admin", "alice"] }));

			const res = await request(srv.app).get("/user/clients").set("Cookie", adminCookie);
			expect(res.status).toBe(200);
			expect(res.body).toContain("bathroom");
		});

		it("excludes clients where the user is not listed", async () => {
			const p = path.join(rootDir, "configs/bathroom/bathroom.json");
			fs.mkdirSync(path.dirname(p), { recursive: true });
			fs.writeFileSync(p, JSON.stringify({ users: ["alice"] }));

			const res = await request(srv.app).get("/user/clients").set("Cookie", adminCookie);
			expect(res.status).toBe(200);
			expect(res.body).not.toContain("bathroom");
		});
	});

	describe("GET /user/modules/available", () => {
		it("returns the default user-accessible modules", async () => {
			const res = await request(srv.app)
				.get("/user/modules/available")
				.set("Cookie", adminCookie);
			expect(res.status).toBe(200);
			expect(res.body).toContain("clock");
			expect(res.body).toContain("dbbutton");
		});

		it("excludes admin-only modules", async () => {
			const res = await request(srv.app)
				.get("/user/modules/available")
				.set("Cookie", adminCookie);
			expect(res.status).toBe(200);
			for (const m of ["alert", "clientDisplay", "clientDetailes", "userManager", "personalization"]) {
				expect(res.body).not.toContain(m);
			}
		});

		it("includes third-party module directories found under rootDir/modules", async () => {
			fs.mkdirSync(path.join(rootDir, "modules/mymodule"), { recursive: true });

			const res = await request(srv.app)
				.get("/user/modules/available")
				.set("Cookie", adminCookie);
			expect(res.status).toBe(200);
			expect(res.body).toContain("mymodule");
		});

		it("excludes the 'default' subdirectory from third-party results", async () => {
			fs.mkdirSync(path.join(rootDir, "modules/default"), { recursive: true });

			const res = await request(srv.app)
				.get("/user/modules/available")
				.set("Cookie", adminCookie);
			expect(res.status).toBe(200);
			expect(res.body).not.toContain("default");
		});
	});

	describe("PUT /user/config", () => {
		it("saves the global user config and returns ok", async () => {
			const modules = [{ module: "clock", position: "top_left" }];
			const res = await request(srv.app)
				.put("/user/config")
				.set("Cookie", adminCookie)
				.send({ modules });

			expect(res.status).toBe(200);
			expect(res.body).toEqual({ ok: true });

			const saved = JSON.parse(
				fs.readFileSync(path.join(rootDir, "configs/users/admin.json"), "utf8"),
			);
			expect(saved.modules).toEqual(modules);
			expect(saved.name).toBe("admin");
		});

		it("returns 400 when modules is not an array", async () => {
			const res = await request(srv.app)
				.put("/user/config")
				.set("Cookie", adminCookie)
				.send({ modules: "not-an-array" });
			expect(res.status).toBe(400);
		});
	});

	describe("PUT /user/config/:client", () => {
		it("saves a client-specific config and returns ok", async () => {
			const modules = [{ module: "clock" }];
			const res = await request(srv.app)
				.put("/user/config/bathroom")
				.set("Cookie", adminCookie)
				.send({ modules });

			expect(res.status).toBe(200);
			expect(res.body).toEqual({ ok: true });

			const saved = JSON.parse(
				fs.readFileSync(path.join(rootDir, "configs/bathroom/users/admin.json"), "utf8"),
			);
			expect(saved.modules).toEqual(modules);
		});

		it("returns 400 when modules is not an array", async () => {
			const res = await request(srv.app)
				.put("/user/config/bathroom")
				.set("Cookie", adminCookie)
				.send({ modules: 42 });
			expect(res.status).toBe(400);
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// adminEndpoints
// ─────────────────────────────────────────────────────────────────────────────

describe("Server.adminEndpoints", () => {
	let rootDir: string;
	let srv: Server;
	let adminCookie: string;
	let userCookie: string;

	beforeEach(() => {
		rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dalamirror-admin-ep-"));

		const bathCfgPath = path.join(rootDir, "configs/bathroom/bathroom.json");
		fs.mkdirSync(path.dirname(bathCfgPath), { recursive: true });
		fs.writeFileSync(bathCfgPath, JSON.stringify({ users: ["alice"] }));

		srv = makeServer(rootDir);
		srv.auth.createAccount("alice", "Alice", "user", "pass1");
		srv.adminEndpoints();

		adminCookie = sessionCookie(srv.auth, "admin", "admin");
		userCookie = sessionCookie(srv.auth, "alice", "pass1");
	});

	afterEach(() => {
		fs.rmSync(rootDir, { recursive: true, force: true });
	});

	it("returns 401 without a session cookie", async () => {
		const res = await request(srv.app).get("/admin/users");
		expect(res.status).toBe(401);
	});

	it("returns 403 for a non-admin user", async () => {
		const res = await request(srv.app).get("/admin/users").set("Cookie", userCookie);
		expect(res.status).toBe(403);
	});

	describe("GET /admin/users", () => {
		it("lists all accounts without sensitive fields", async () => {
			const res = await request(srv.app).get("/admin/users").set("Cookie", adminCookie);
			expect(res.status).toBe(200);
			expect(res.body).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ username: "admin", role: "admin" }),
					expect.objectContaining({ username: "alice", role: "user" }),
				]),
			);
			for (const account of res.body as object[]) {
				expect(account).not.toHaveProperty("passwordHash");
				expect(account).not.toHaveProperty("salt");
			}
		});
	});

	describe("POST /admin/users", () => {
		it("creates a new account and auto-creates its global config file", async () => {
			const res = await request(srv.app)
				.post("/admin/users")
				.set("Cookie", adminCookie)
				.send({ username: "bob", displayName: "Bob", role: "user", password: "bobpass" });

			expect(res.status).toBe(201);
			expect(srv.auth.login("bob", "bobpass")).not.toBeNull();

			const cfg = JSON.parse(
				fs.readFileSync(path.join(rootDir, "configs/users/bob.json"), "utf8"),
			);
			expect(cfg).toEqual({ name: "bob", modules: [] });
		});

		it("returns 400 when required fields are missing", async () => {
			const res = await request(srv.app)
				.post("/admin/users")
				.set("Cookie", adminCookie)
				.send({ username: "bob", displayName: "Bob" }); // missing role + password
			expect(res.status).toBe(400);
		});

		it("returns 409 on a duplicate username", async () => {
			const res = await request(srv.app)
				.post("/admin/users")
				.set("Cookie", adminCookie)
				.send({ username: "alice", displayName: "Alice 2", role: "user", password: "x" });
			expect(res.status).toBe(409);
		});
	});

	describe("PATCH /admin/users/:username", () => {
		it("updates the display name", async () => {
			const res = await request(srv.app)
				.patch("/admin/users/alice")
				.set("Cookie", adminCookie)
				.send({ displayName: "Alice Updated" });

			expect(res.status).toBe(200);
			expect(res.body).toEqual({ ok: true });
			expect(srv.auth.listAccounts().find((a) => a.username === "alice")?.displayName).toBe(
				"Alice Updated",
			);
		});

		it("updates the password so the old one stops working", async () => {
			await request(srv.app)
				.patch("/admin/users/alice")
				.set("Cookie", adminCookie)
				.send({ password: "newpass" });

			expect(srv.auth.login("alice", "pass1")).toBeNull();
			expect(srv.auth.login("alice", "newpass")).not.toBeNull();
		});

		it("returns 404 for an unknown user", async () => {
			const res = await request(srv.app)
				.patch("/admin/users/nobody")
				.set("Cookie", adminCookie)
				.send({ displayName: "x" });
			expect(res.status).toBe(404);
		});
	});

	describe("DELETE /admin/users/:username", () => {
		it("removes the account and strips the user from all client configs", async () => {
			const res = await request(srv.app)
				.delete("/admin/users/alice")
				.set("Cookie", adminCookie);

			expect(res.status).toBe(200);
			expect(srv.auth.listAccounts().find((a) => a.username === "alice")).toBeUndefined();

			const cfg = JSON.parse(
				fs.readFileSync(path.join(rootDir, "configs/bathroom/bathroom.json"), "utf8"),
			) as { users: string[] };
			expect(cfg.users).not.toContain("alice");
		});

		it("returns 404 for an unknown user", async () => {
			const res = await request(srv.app)
				.delete("/admin/users/nobody")
				.set("Cookie", adminCookie);
			expect(res.status).toBe(404);
		});
	});

	describe("GET /admin/clients", () => {
		it("returns all configured clients with their users lists", async () => {
			const res = await request(srv.app).get("/admin/clients").set("Cookie", adminCookie);
			expect(res.status).toBe(200);
			expect(res.body).toEqual([{ name: "bathroom", users: ["alice"] }]);
		});
	});

	describe("PUT /admin/clients/:client/users", () => {
		it("replaces the users list on the client config", async () => {
			const res = await request(srv.app)
				.put("/admin/clients/bathroom/users")
				.set("Cookie", adminCookie)
				.send({ users: ["admin", "alice"] });

			expect(res.status).toBe(200);
			expect(res.body).toEqual({ ok: true });

			const cfg = JSON.parse(
				fs.readFileSync(path.join(rootDir, "configs/bathroom/bathroom.json"), "utf8"),
			) as { users: string[] };
			expect(cfg.users).toEqual(["admin", "alice"]);
		});

		it("returns 404 for a client not in clientConfigs", async () => {
			const res = await request(srv.app)
				.put("/admin/clients/unknown/users")
				.set("Cookie", adminCookie)
				.send({ users: [] });
			expect(res.status).toBe(404);
		});

		it("returns 400 when users is not an array", async () => {
			const res = await request(srv.app)
				.put("/admin/clients/bathroom/users")
				.set("Cookie", adminCookie)
				.send({ users: "bad" });
			expect(res.status).toBe(400);
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// userServiceEndpoints
// ─────────────────────────────────────────────────────────────────────────────

describe("Server.userServiceEndpoints", () => {
	let rootDir: string;
	let srv: Server;

	beforeEach(() => {
		rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dalamirror-usersvc-"));
		srv = makeServer(rootDir);
		srv.userServiceEndpoints();
	});

	afterEach(() => {
		fs.rmSync(rootDir, { recursive: true, force: true });
	});

	it("returns the client-specific user config when it exists", async () => {
		const data = { name: "dala", modules: [{ module: "clock" }] };
		const p = path.join(rootDir, "configs/bathroom/users/dala.json");
		fs.mkdirSync(path.dirname(p), { recursive: true });
		fs.writeFileSync(p, JSON.stringify(data));

		const res = await request(srv.app)
			.post("/get-user/dala")
			.set("Content-Type", "text/plain")
			.send("bathroom");

		expect(res.status).toBe(200);
		expect(res.body).toEqual(data);
	});

	it("falls back to the global user config when no client-specific one exists", async () => {
		const data = { name: "dala", modules: [] };
		const p = path.join(rootDir, "configs/users/dala.json");
		fs.mkdirSync(path.dirname(p), { recursive: true });
		fs.writeFileSync(p, JSON.stringify(data));

		const res = await request(srv.app)
			.post("/get-user/dala")
			.set("Content-Type", "text/plain")
			.send("bathroom");

		expect(res.status).toBe(200);
		expect(res.body).toEqual(data);
	});

	it("prefers the client-specific config over the global one", async () => {
		const clientData = { name: "dala", modules: [{ module: "clock" }] };
		const globalData = { name: "dala", modules: [] };

		const cp = path.join(rootDir, "configs/bathroom/users/dala.json");
		fs.mkdirSync(path.dirname(cp), { recursive: true });
		fs.writeFileSync(cp, JSON.stringify(clientData));

		const gp = path.join(rootDir, "configs/users/dala.json");
		fs.mkdirSync(path.dirname(gp), { recursive: true });
		fs.writeFileSync(gp, JSON.stringify(globalData));

		const res = await request(srv.app)
			.post("/get-user/dala")
			.set("Content-Type", "text/plain")
			.send("bathroom");

		expect(res.status).toBe(200);
		expect(res.body).toEqual(clientData);
	});

	it("returns 404 when neither config file exists", async () => {
		const res = await request(srv.app)
			.post("/get-user/dala")
			.set("Content-Type", "text/plain")
			.send("bathroom");

		expect(res.status).toBe(404);
	});
});

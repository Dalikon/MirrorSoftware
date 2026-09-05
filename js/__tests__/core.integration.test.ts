import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { io as ioClient } from "socket.io-client";
import Core from "../core.js";
import { getDb } from "../db/index.js";
import { clients as clientsTable } from "../db/schema.js";

const BASE_CONFIG = {
	address: "127.0.0.1",
	port: 0,
	ipWhitelist: [] as string[],
	ipBlackList: [] as string[],
	https: false,
	httpHeaders: {
		contentSecurityPolicy: false,
		crossOriginOpenerPolicy: false,
		crossOriginEmbedderPolicy: false,
		crossOriginResourcePolicy: false,
		originAgentCluster: false,
	},
	checkServerInterval: 0,
	userSwitchMode: "SAVE" as const,
	logLevel: [] as string[],
	reloadAfterServerRestart: false,
	language: "en",
	timeFormat: 24 as const,
	units: "metric" as const,
	zoom: 1,
	customCss: "",
	rootConf: "root",
	clientConfigs: ["bathroom"] as string[],
	providedModules: [] as string[],
};

function setupRootDir(configOverrides: Partial<typeof BASE_CONFIG> = {}): string {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dalamirror-int-"));
	fs.mkdirSync(path.join(rootDir, "configs/server"), { recursive: true });
	fs.mkdirSync(path.join(rootDir, "configs/bathroom"), { recursive: true });
	fs.mkdirSync(path.join(rootDir, "configs/root"), { recursive: true });
	fs.mkdirSync(path.join(rootDir, "workData"), { recursive: true });
	fs.mkdirSync(path.join(rootDir, "js"), { recursive: true });
	fs.writeFileSync(
		path.join(rootDir, "configs/server/defaultServerConfig.json"),
		JSON.stringify({ ...BASE_CONFIG, ...configOverrides }),
	);
	fs.writeFileSync(path.join(rootDir, "configs/server/serverConfig.json"), "{}");
	fs.writeFileSync(
		path.join(rootDir, "configs/bathroom/bathroom.json"),
		JSON.stringify({ name: "bathroom", type: "mirror", defaultModules: [], users: [] }),
	);
	fs.writeFileSync(path.join(rootDir, "js/mirror.js"), "// mirror");
	return rootDir;
}

describe("Core.start() integration", () => {
	let rootDir = "";
	let core: Core | null = null;

	afterEach(async () => {
		if (core?.httpServer) {
			try {
				await core.httpServer.close();
			} catch {
				/* already closed */
			}
			core = null;
		}
		if (rootDir) {
			fs.rmSync(rootDir, { recursive: true, force: true });
			rootDir = "";
		}
	});

	// ─── HTTP server ───────────────────────────────────────────────────────────

	describe("HTTP server", () => {
		it("POST /auth/login with default credentials returns 200 and session info", async () => {
			rootDir = setupRootDir();
			core = new Core(rootDir);
			await core.start();

			const res = await request(core.httpServer.server!)
				.post("/auth/login")
				.send({ username: "admin", password: "admin" });

			expect(res.status).toBe(200);
			expect(res.body).toMatchObject({ username: "admin", role: "admin" });
		});

		it("GET /auth/me without a session returns 401", async () => {
			rootDir = setupRootDir();
			core = new Core(rootDir);
			await core.start();

			const res = await request(core.httpServer.server!).get("/auth/me");
			expect(res.status).toBe(401);
		});

		it("POST /auth/login with wrong password returns 401", async () => {
			rootDir = setupRootDir();
			core = new Core(rootDir);
			await core.start();

			const res = await request(core.httpServer.server!)
				.post("/auth/login")
				.send({ username: "admin", password: "wrong" });

			expect(res.status).toBe(401);
		});

		it("login → /auth/me → logout → /auth/me cycle works end-to-end", async () => {
			rootDir = setupRootDir();
			core = new Core(rootDir);
			await core.start();

			const agent = request.agent(core.httpServer.server!);

			await agent.post("/auth/login").send({ username: "admin", password: "admin" }).expect(200);
			await agent.get("/auth/me").expect(200);
			await agent.post("/auth/logout").expect(200);
			await agent.get("/auth/me").expect(401);
		});
	});

	// ─── checkMirrorConfigs ────────────────────────────────────────────────────

	describe("checkMirrorConfigs", () => {
		it("seeds configured clients into DB containing configured clients plus root", async () => {
			rootDir = setupRootDir();
			core = new Core(rootDir);
			await core.start();

			const rows = getDb().select().from(clientsTable).all();
			expect(rows.map((r) => r.name)).toEqual(
				expect.arrayContaining(["bathroom", "root"]),
			);
		});

		it("copies js/mirror.js into each client config folder on first run", async () => {
			rootDir = setupRootDir();
			core = new Core(rootDir);
			await core.start();

			expect(fs.existsSync(path.join(rootDir, "configs/bathroom/bathroom.js"))).toBe(true);
			expect(fs.existsSync(path.join(rootDir, "configs/root/root.js"))).toBe(true);
		});

		it("starting a second time with the same DB does not duplicate clients", async () => {
			rootDir = setupRootDir();
			core = new Core(rootDir);
			await core.start();
			await core.httpServer.close();
			core = null;

			core = new Core(rootDir);
			await core.start();

			const rows = getDb().select().from(clientsTable).all();
			expect(rows.filter((r) => r.name === "bathroom")).toHaveLength(1);
			expect(rows.filter((r) => r.name === "root")).toHaveLength(1);
		});
	});

	// ─── module helper loading ─────────────────────────────────────────────────

	describe("module helper loading", () => {
		function addModule(
			rd: string,
			moduleName: string,
			permissions: string[] = ["express.route"],
		): void {
			const moduleDir = path.join(rd, "modules", moduleName);
			fs.mkdirSync(moduleDir, { recursive: true });
			fs.writeFileSync(
				path.join(moduleDir, "module.json"),
				JSON.stringify({ helper: { permissions } }),
			);
			fs.writeFileSync(
				path.join(moduleDir, "helper.js"),
				[
					"class H {",
					"  setName(n) { this.name = n; }",
					"  setPath(p) { this.path = p; }",
					"  loaded() {}",
					"  setExpressApp(r) { r.get('/ping', (_req, res) => res.json({ ok: true })); }",
					"  start() { return Promise.resolve(); }",
					"}",
					"module.exports = H;",
				].join("\n"),
			);
		}

		function addModuleToClient(rd: string, moduleName: string): void {
			const bathPath = path.join(rd, "configs/bathroom/bathroom.json");
			const cfg = JSON.parse(fs.readFileSync(bathPath, "utf8")) as {
				defaultModules: { module: string; position: string }[];
			};
			cfg.defaultModules.push({ module: moduleName, position: "top_left" });
			fs.writeFileSync(bathPath, JSON.stringify(cfg));
		}

		it("loads a helper with a valid manifest and registers its express route", async () => {
			rootDir = setupRootDir();
			addModule(rootDir, "testHelper");
			addModuleToClient(rootDir, "testHelper");

			core = new Core(rootDir);
			await core.start();

			expect(core.moduleHelpers).toHaveLength(1);

			const res = await request(core.httpServer.server!).get("/testHelper/ping");
			expect(res.status).toBe(200);
			expect(res.body).toEqual({ ok: true });
		});

		it("rejects a helper whose manifest declares unknown permissions", async () => {
			rootDir = setupRootDir();
			addModule(rootDir, "badHelper", ["unknown.permission"]);
			addModuleToClient(rootDir, "badHelper");

			core = new Core(rootDir);
			await core.start();

			expect(core.moduleHelpers).toHaveLength(0);
		});

		it("skips a module folder with no module.json", async () => {
			rootDir = setupRootDir();
			fs.mkdirSync(path.join(rootDir, "modules/noManifest"), { recursive: true });
			addModuleToClient(rootDir, "noManifest");

			core = new Core(rootDir);
			await core.start();

			expect(core.moduleHelpers).toHaveLength(0);
		});
	});

	// ─── socket.io tracker ────────────────────────────────────────────────────

	describe("Socket.IO tracker", () => {
		function serverPort(c: Core): number {
			return (c.httpServer.server!.address() as AddressInfo).port;
		}

		it("accepts a connection from a client seeded in DB", async () => {
			rootDir = setupRootDir();
			core = new Core(rootDir);
			await core.start();

			const socket = ioClient(`http://127.0.0.1:${serverPort(core)}`, {
				query: { clientName: "bathroom", clientType: "mirror" },
				transports: ["websocket"],
				reconnection: false,
			});

			await new Promise<void>((resolve, reject) => {
				socket.once("connect", resolve);
				socket.once("connect_error", reject);
			});

			expect(socket.connected).toBe(true);
			socket.disconnect();
		});

		it("immediately disconnects a client whose name is not in DB", async () => {
			rootDir = setupRootDir();
			core = new Core(rootDir);
			await core.start();

			const socket = ioClient(`http://127.0.0.1:${serverPort(core)}`, {
				query: { clientName: "nonexistent", clientType: "mirror" },
				transports: ["websocket"],
				reconnection: false,
			});

			await new Promise<void>((resolve) => socket.once("disconnect", () => resolve()));
			expect(socket.connected).toBe(false);
		});
	});
});

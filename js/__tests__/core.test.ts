import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Core from "../core.js";
import type { ClientModuleMap } from "../core.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

const BASE_CONFIG = {
	address: "0.0.0.0",
	port: 8080,
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
	userSwitchMode: "DELETE" as const,
	logLevel: [] as string[],
	reloadAfterServerRestart: false,
	language: "en",
	timeFormat: 24 as const,
	units: "metric" as const,
	zoom: 1,
	customCss: "",
	rootConf: "root",
	clientConfigs: [] as string[],
	providedModules: [] as string[],
};

/**
 * Creates a temp rootDir with the minimal server config files Core needs,
 * merges any overrides into the defaults, and returns a Core instance.
 */
function makeCore(rootDir: string, overrides: Record<string, unknown> = {}): Core {
	const configDir = path.join(rootDir, "configs/server");
	fs.mkdirSync(configDir, { recursive: true });
	fs.writeFileSync(
		path.join(configDir, "defaultServerConfig.json"),
		JSON.stringify({ ...BASE_CONFIG, ...overrides }),
	);
	fs.writeFileSync(path.join(configDir, "serverConfig.json"), "{}");
	return new Core(rootDir);
}

// ─────────────────────────────────────────────────────────────────────────────
// constructor
// ─────────────────────────────────────────────────────────────────────────────

describe("Core constructor", () => {
	let rootDir: string;

	beforeEach(() => {
		rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dalamirror-core-"));
	});

	afterEach(() => {
		fs.rmSync(rootDir, { recursive: true, force: true });
	});

	it("stores rootDir and initialises moduleHelpers as empty", () => {
		const core = makeCore(rootDir);
		expect(core.rootDir).toBe(rootDir);
		expect(core.moduleHelpers).toEqual([]);
	});

	it("reads the default config from defaultServerConfig.json", () => {
		const core = makeCore(rootDir, { language: "cs", clientConfigs: ["bathroom"] });
		expect(core.config.language).toBe("cs");
		expect(core.config.clientConfigs).toContain("bathroom");
	});

	it("merges serverConfig.json overrides on top of the defaults", () => {
		const configDir = path.join(rootDir, "configs/server");
		fs.mkdirSync(configDir, { recursive: true });
		fs.writeFileSync(
			path.join(configDir, "defaultServerConfig.json"),
			JSON.stringify({ ...BASE_CONFIG, language: "en" }),
		);
		fs.writeFileSync(
			path.join(configDir, "serverConfig.json"),
			JSON.stringify({ language: "cs" }),
		);

		const core = new Core(rootDir);
		expect(core.config.language).toBe("cs");
	});

	it("injects rootDir into the final config", () => {
		const core = makeCore(rootDir);
		expect((core.config as unknown as Record<string, unknown>)["rootDir"]).toBe(rootDir);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// loadAndValidateManifest
// ─────────────────────────────────────────────────────────────────────────────

describe("Core.loadAndValidateManifest", () => {
	let rootDir: string;
	let core: Core;
	let modDir: string;

	beforeEach(() => {
		rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dalamirror-core-"));
		core = makeCore(rootDir);
		modDir = path.join(rootDir, "modules/mymod");
		fs.mkdirSync(modDir, { recursive: true });
	});

	afterEach(() => {
		fs.rmSync(rootDir, { recursive: true, force: true });
	});

	function writeManifest(obj: unknown): void {
		fs.writeFileSync(path.join(modDir, "module.json"), JSON.stringify(obj));
	}

	it("returns null when module.json is missing", () => {
		expect(core.loadAndValidateManifest(modDir, "mymod")).toBeNull();
	});

	it("returns null when module.json is not valid JSON", () => {
		fs.writeFileSync(path.join(modDir, "module.json"), "{ bad json !!!");
		expect(core.loadAndValidateManifest(modDir, "mymod")).toBeNull();
	});

	it("returns null when module.json declares an unknown permission", () => {
		writeManifest({
			name: "mymod",
			helper: { permissions: ["express.route", "evil.permission"] },
			client: { permissions: [] },
		});
		expect(core.loadAndValidateManifest(modDir, "mymod")).toBeNull();
	});

	it("returns the manifest when all permissions are known", () => {
		writeManifest({
			name: "mymod",
			helper: { permissions: ["express.route", "socket.namespace"] },
			client: { permissions: [] },
		});
		const result = core.loadAndValidateManifest(modDir, "mymod");
		expect(result).not.toBeNull();
		expect(result!.helper.permissions).toEqual(["express.route", "socket.namespace"]);
	});

	it("returns the manifest when the permissions array is empty", () => {
		writeManifest({ name: "mymod", helper: { permissions: [] }, client: { permissions: [] } });
		expect(core.loadAndValidateManifest(modDir, "mymod")).not.toBeNull();
	});

	it("accepts all six valid helper permissions without rejecting", () => {
		writeManifest({
			name: "mymod",
			helper: {
				permissions: [
					"express.route",
					"socket.namespace",
					"fs.read",
					"fs.write",
					"network.http",
					"network.ws",
				],
			},
			client: { permissions: [] },
		});
		const result = core.loadAndValidateManifest(modDir, "mymod");
		expect(result).not.toBeNull();
		expect(result!.helper.permissions).toHaveLength(6);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// getUsersPerClient
// ─────────────────────────────────────────────────────────────────────────────

describe("Core.getUsersPerClient", () => {
	let rootDir: string;
	let core: Core;

	beforeEach(() => {
		rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dalamirror-core-"));
		core = makeCore(rootDir);
	});

	afterEach(() => {
		fs.rmSync(rootDir, { recursive: true, force: true });
	});

	it("returns an empty array when no users are given", () => {
		expect(core.getUsersPerClient("bathroom", [])).toEqual([]);
	});

	it("returns path + parsed data for each user config file", () => {
		const usersDir = path.join(rootDir, "configs/bathroom/users");
		fs.mkdirSync(usersDir, { recursive: true });

		const dalaData = { name: "dala", modules: [{ module: "clock" }] };
		const momiData = { name: "momi", modules: [] };
		fs.writeFileSync(path.join(usersDir, "dala.json"), JSON.stringify(dalaData));
		fs.writeFileSync(path.join(usersDir, "momi.json"), JSON.stringify(momiData));

		const result = core.getUsersPerClient("bathroom", ["dala", "momi"]);

		expect(result).toHaveLength(2);
		expect(result[0]!.data).toEqual(dalaData);
		expect(result[1]!.data).toEqual(momiData);
		expect(result[0]!.path).toContain("dala.json");
	});

	it("throws when a user config file is missing", () => {
		const usersDir = path.join(rootDir, "configs/bathroom/users");
		fs.mkdirSync(usersDir, { recursive: true });

		expect(() => core.getUsersPerClient("bathroom", ["ghost"])).toThrow();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// differentModules
// ─────────────────────────────────────────────────────────────────────────────

describe("Core.differentModules", () => {
	let rootDir: string;
	let core: Core;

	beforeEach(() => {
		rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dalamirror-core-"));
		core = makeCore(rootDir);
	});

	afterEach(() => {
		fs.rmSync(rootDir, { recursive: true, force: true });
	});

	it("returns an empty array when allClients is empty", () => {
		core.allClients = {};
		expect(core.differentModules()).toEqual([]);
	});

	it("collects all unique module names from defaultModules", () => {
		core.allClients = {
			bathroom: {
				defaultModules: [{ module: "clock" }, { module: "alert" }],
				usersSpecific: [],
			},
		};
		expect(core.differentModules()).toEqual(expect.arrayContaining(["clock", "alert"]));
	});

	it("includes modules from usersSpecific configs", () => {
		core.allClients = {
			bathroom: {
				defaultModules: [{ module: "clock" }],
				usersSpecific: [
					{
						path: "/fake/path",
						data: { name: "dala", modules: [{ module: "helloworld" }] },
					},
				],
			},
		};
		const result = core.differentModules();
		expect(result).toContain("clock");
		expect(result).toContain("helloworld");
	});

	it("deduplicates modules that appear in multiple clients or users", () => {
		core.allClients = {
			bathroom: {
				defaultModules: [{ module: "clock" }],
				usersSpecific: [
					{ path: "/fake", data: { name: "dala", modules: [{ module: "clock" }] } },
				],
			},
			kitchen: {
				defaultModules: [{ module: "clock" }, { module: "alert" }],
				usersSpecific: [],
			},
		};
		const result = core.differentModules();
		expect(result.filter((m) => m === "clock")).toHaveLength(1);
		expect(result).toContain("alert");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// createModuleArray  (uses path.resolve('./configs/...') — needs chdir)
// ─────────────────────────────────────────────────────────────────────────────

describe("Core.createModuleArray", () => {
	let rootDir: string;
	let core: Core;

	beforeEach(() => {
		rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dalamirror-core-"));
	});

	afterEach(() => {
		fs.rmSync(rootDir, { recursive: true, force: true });
	});

	function writeClientConfig(clientName: string, obj: unknown): void {
		const dir = path.join(rootDir, "configs", clientName);
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, `${clientName}.json`), JSON.stringify(obj));
	}

	it("returns an empty map when clientConfigs is empty", () => {
		core = makeCore(rootDir, { clientConfigs: [] });
		expect(core.createModuleArray()).toEqual({});
	});

	it("builds the map with defaultModules for a valid client config", () => {
		writeClientConfig("bathroom", {
			name: "bathroom",
			type: "mirror",
			userSwitchMode: "DELETE",
			users: [],
			defaultModules: [{ module: "clock" }],
		});
		core = makeCore(rootDir, { clientConfigs: ["bathroom"] });

		const result = core.createModuleArray();

		expect(result["bathroom"]).toBeDefined();
		expect(result["bathroom"]!.defaultModules).toEqual([{ module: "clock" }]);
		expect(result["bathroom"]!.usersSpecific).toEqual([]);
	});

	it("populates usersSpecific when user config files exist", () => {
		const userData = { name: "dala", modules: [{ module: "helloworld" }] };
		const usersDir = path.join(rootDir, "configs/bathroom/users");
		fs.mkdirSync(usersDir, { recursive: true });
		fs.writeFileSync(path.join(usersDir, "dala.json"), JSON.stringify(userData));

		writeClientConfig("bathroom", {
			name: "bathroom",
			type: "mirror",
			userSwitchMode: "DELETE",
			users: ["dala"],
			defaultModules: [],
		});
		core = makeCore(rootDir, { clientConfigs: ["bathroom"] });

		const result = core.createModuleArray();
		expect(result["bathroom"]!.usersSpecific[0]!.data).toEqual(userData);
	});

	it("skips a client whose config file cannot be parsed, without throwing", () => {
		const dir = path.join(rootDir, "configs/badclient");
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, "badclient.json"), "{ bad json");

		core = makeCore(rootDir, { clientConfigs: ["badclient"] });
		const result = core.createModuleArray();

		expect(result["badclient"]).toBeUndefined();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// checkMirrorConfigs
// ─────────────────────────────────────────────────────────────────────────────

describe("Core.checkMirrorConfigs", () => {
	let rootDir: string;

	beforeEach(() => {
		rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dalamirror-core-"));
		fs.mkdirSync(path.join(rootDir, "workData"), { recursive: true });
	});

	afterEach(() => {
		fs.rmSync(rootDir, { recursive: true, force: true });
	});

	it("creates cTracker.json with mirror entries for each client plus a root dashboard entry", () => {
		const bathDir = path.join(rootDir, "configs/bathroom");
		fs.mkdirSync(bathDir, { recursive: true });
		fs.writeFileSync(path.join(bathDir, "bathroom.js"), ""); // .js already exists — no copy needed

		const core = makeCore(rootDir, { clientConfigs: ["bathroom"], rootConf: "root" });
		core.checkMirrorConfigs();

		const tracker = JSON.parse(
			fs.readFileSync(path.join(rootDir, "workData/cTracker.json"), "utf8"),
		) as Array<{ name: string; type: string }>;

		expect(tracker.find((t) => t.name === "bathroom")?.type).toBe("mirror");
		expect(tracker.find((t) => t.name === "root")?.type).toBe("dashboard");
	});

	it("does not overwrite an existing cTracker.json", () => {
		const existing = [{ name: "sentinel", type: "mirror" }];
		fs.writeFileSync(
			path.join(rootDir, "workData/cTracker.json"),
			JSON.stringify(existing),
		);

		const core = makeCore(rootDir, { clientConfigs: [], rootConf: "nonexistent" });
		core.checkMirrorConfigs();

		const tracker = JSON.parse(
			fs.readFileSync(path.join(rootDir, "workData/cTracker.json"), "utf8"),
		) as unknown[];
		expect(tracker).toEqual(existing);
	});

	it("removes a client from clientConfigs when its folder does not exist", () => {
		// bathroom folder is NOT created
		const core = makeCore(rootDir, { clientConfigs: ["bathroom"], rootConf: "nonexistent" });
		core.checkMirrorConfigs();

		expect(core.config.clientConfigs).not.toContain("bathroom");
	});

	it("copies mirror.js to create a missing client .js file", () => {
		const bathDir = path.join(rootDir, "configs/bathroom");
		fs.mkdirSync(bathDir, { recursive: true });
		// bathroom.js intentionally missing — should be created by copyFileSync

		const jsDir = path.join(rootDir, "js");
		fs.mkdirSync(jsDir, { recursive: true });
		fs.writeFileSync(path.join(jsDir, "mirror.js"), "// mirror template");

		const core = makeCore(rootDir, { clientConfigs: ["bathroom"], rootConf: "nonexistent" });
		core.checkMirrorConfigs();

		expect(fs.existsSync(path.join(rootDir, "configs/bathroom/bathroom.js"))).toBe(true);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// loadModules
// ─────────────────────────────────────────────────────────────────────────────

describe("Core.loadModules", () => {
	let rootDir: string;
	let core: Core;

	beforeEach(() => {
		rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dalamirror-core-"));
		core = makeCore(rootDir);
	});

	afterEach(() => {
		fs.rmSync(rootDir, { recursive: true, force: true });
	});

	// Stub createModuleArray so loadModules uses a controlled module list
	// without needing real client config files on disk.
	function stubModules(moduleNames: string[]): void {
		jest
			.spyOn(core, "createModuleArray")
			.mockReturnValue(
				Object.fromEntries(
					moduleNames.map((name) => [
						name,
						{ defaultModules: [{ module: name }], usersSpecific: [] },
					]),
				) as ClientModuleMap,
			);
	}

	function writeManifest(modDir: string, permissions: string[]): void {
		fs.writeFileSync(
			path.join(modDir, "module.json"),
			JSON.stringify({ name: "mod", helper: { permissions }, client: { permissions: [] } }),
		);
	}

	function writeHelper(modDir: string): void {
		// Minimal CJS helper class — does not extend Helper but implements
		// every method Core calls during loadModules (setName, setPath, loaded).
		fs.writeFileSync(
			path.join(modDir, "helper.js"),
			[
				"class TestHelper {",
				"  setName(n) { this.name = n; }",
				"  setPath(p) { this.path = p; }",
				"  loaded() {}",
				"  start() { return Promise.resolve(); }",
				"}",
				"module.exports = TestHelper;",
			].join("\n"),
		);
	}

	it("skips a module with a missing manifest", () => {
		const modDir = path.join(rootDir, "modules/mymod");
		fs.mkdirSync(modDir, { recursive: true });
		stubModules(["mymod"]);

		core.loadModules();

		expect(core.moduleHelpers).toHaveLength(0);
	});

	it("skips a module whose manifest declares an unknown permission", () => {
		const modDir = path.join(rootDir, "modules/mymod");
		fs.mkdirSync(modDir, { recursive: true });
		writeManifest(modDir, ["evil.permission"]);
		stubModules(["mymod"]);

		core.loadModules();

		expect(core.moduleHelpers).toHaveLength(0);
	});

	it("skips loading a helper when helper.js does not exist", () => {
		const modDir = path.join(rootDir, "modules/mymod");
		fs.mkdirSync(modDir, { recursive: true });
		writeManifest(modDir, ["express.route"]);
		// no helper.js written
		stubModules(["mymod"]);

		core.loadModules();

		expect(core.moduleHelpers).toHaveLength(0);
	});

	it("loads a helper when the manifest is valid and helper.js exists", () => {
		const modDir = path.join(rootDir, "modules/mymod");
		fs.mkdirSync(modDir, { recursive: true });
		writeManifest(modDir, ["express.route"]);
		writeHelper(modDir);
		stubModules(["mymod"]);

		core.loadModules();

		expect(core.moduleHelpers).toHaveLength(1);
		expect(core.moduleHelpers[0]!.helper.name).toBe("mymod");
		expect(core.moduleHelpers[0]!.manifest!.helper.permissions).toEqual(["express.route"]);
	});

	it("skips the manifest check for provided modules and loads their helper", () => {
		const modDir = path.join(rootDir, "modules/default/clock");
		fs.mkdirSync(modDir, { recursive: true });
		// no module.json — provided modules bypass the manifest gate
		writeHelper(modDir);
		stubModules(["clock"]);

		core = makeCore(rootDir, { providedModules: ["clock"] });
		jest
			.spyOn(core, "createModuleArray")
			.mockReturnValue({ clock: { defaultModules: [{ module: "clock" }], usersSpecific: [] } });

		core.loadModules();

		expect(core.moduleHelpers).toHaveLength(1);
		expect(core.moduleHelpers[0]!.manifest).toBeNull();
	});
});

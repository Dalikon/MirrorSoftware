import type { ClientRef, ActiveConfig } from "../clientState.js";
import type { ClientConfig } from "../../types/module.js";
import type { SessionInfo } from "../../types/index.js";

type CS = {
	setClient(c: ClientRef): void;
	getClient(): ClientRef;
	setClientConfig(c: ClientConfig): void;
	getClientConfig(): ClientConfig;
	setConfigInUse(c: ActiveConfig): void;
	getConfigInUse(): ActiveConfig;
	setFreshRegions(r: string): void;
	getFreshRegions(): string;
	setSession(s: SessionInfo | null): void;
	getSession(): SessionInfo | null;
};

describe("clientState", () => {
	let cs: CS;

	beforeEach(() => {
		jest.resetModules();
		cs = require("../clientState") as CS;
	});

	describe("client", () => {
		it("getClient throws before setClient", () => {
			expect(() => cs.getClient()).toThrow("Client not yet initialized");
		});

		it("setClient / getClient roundtrip", () => {
			const mockClient = {
				updateDom: jest.fn(),
				hideModule: jest.fn(),
				showModule: jest.fn(),
				sendNotification: jest.fn(),
				reload: jest.fn(),
				defModules: [],
				moduleObjs: [],
			} as ClientRef;
			cs.setClient(mockClient);
			expect(cs.getClient()).toBe(mockClient);
		});

		it("overwrites a previously set client", () => {
			const a = { updateDom: jest.fn(), hideModule: jest.fn(), showModule: jest.fn(), sendNotification: jest.fn(), reload: jest.fn(), defModules: [], moduleObjs: [] } as ClientRef;
			const b = { ...a };
			cs.setClient(a);
			cs.setClient(b);
			expect(cs.getClient()).toBe(b);
		});
	});

	describe("clientConfig", () => {
		it("getClientConfig throws before setClientConfig", () => {
			expect(() => cs.getClientConfig()).toThrow("ClientConfig not initialized");
		});

		it("setClientConfig / getClientConfig roundtrip", () => {
			const config = { name: "bathroom", type: "mirror", defaultModules: [], users: [] } as unknown as ClientConfig;
			cs.setClientConfig(config);
			expect(cs.getClientConfig()).toBe(config);
		});
	});

	describe("configInUse", () => {
		it("getConfigInUse throws before setConfigInUse", () => {
			expect(() => cs.getConfigInUse()).toThrow("ConfigInUse not initialized");
		});

		it("setConfigInUse / getConfigInUse roundtrip", () => {
			const config: ActiveConfig = { name: "bathroom", modules: [] };
			cs.setConfigInUse(config);
			expect(cs.getConfigInUse()).toBe(config);
		});
	});

	describe("freshRegions", () => {
		it("getFreshRegions returns empty string by default", () => {
			expect(cs.getFreshRegions()).toBe("");
		});

		it("setFreshRegions / getFreshRegions roundtrip", () => {
			cs.setFreshRegions("<div>content</div>");
			expect(cs.getFreshRegions()).toBe("<div>content</div>");
		});

		it("allows overwriting the value", () => {
			cs.setFreshRegions("first");
			cs.setFreshRegions("second");
			expect(cs.getFreshRegions()).toBe("second");
		});
	});

	describe("session", () => {
		it("getSession returns null by default", () => {
			expect(cs.getSession()).toBeNull();
		});

		it("setSession / getSession roundtrip", () => {
			const session: SessionInfo = { username: "dala", displayName: "Dala", role: "user" };
			cs.setSession(session);
			expect(cs.getSession()).toBe(session);
		});

		it("setSession accepts null to clear", () => {
			cs.setSession({ username: "dala", displayName: "Dala", role: "user" });
			cs.setSession(null);
			expect(cs.getSession()).toBeNull();
		});
	});

	it("state is fresh after resetModules", () => {
		// All state should be at defaults in a fresh require
		expect(() => cs.getClient()).toThrow();
		expect(() => cs.getClientConfig()).toThrow();
		expect(() => cs.getConfigInUse()).toThrow();
		expect(cs.getFreshRegions()).toBe("");
		expect(cs.getSession()).toBeNull();
	});
});

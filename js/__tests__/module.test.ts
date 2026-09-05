/**
 * @jest-environment jsdom
 */
import { Module, configMerge } from "../module.js";
import type { ModuleInfo } from "../../types/module.js";
import type { ClientPermission } from "../../types/index.js";

jest.mock("../clientState.js", () => ({
	getClient: jest.fn().mockReturnValue({
		updateDom: jest.fn(),
		hideModule: jest.fn(),
		showModule: jest.fn(),
		sendNotification: jest.fn(),
		reload: jest.fn(),
		defModules: [],
		moduleObjs: [],
	}),
}));

jest.mock("../clientSocket.js", () => ({
	ClientSocket: jest.fn().mockImplementation(() => ({
		socket: { on: jest.fn(), emit: jest.fn() },
		setNotificationCallback: jest.fn(),
		sendNotification: jest.fn(),
	})),
}));

function makeModuleInfo(overrides: Partial<ModuleInfo> = {}): ModuleInfo {
	return {
		index: 0,
		id: "clock_0",
		name: "clock",
		folder: "/modules/default/clock/",
		file: "clock.js",
		position: "top_left",
		hiddenOnStartup: false,
		hidden: false,
		header: "Clock",
		config: {},
		classes: "clock",
		...overrides,
	};
}

describe("configMerge", () => {
	it("copies flat properties from a source", () => {
		expect(configMerge({}, { a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
	});

	it("later source overrides earlier for scalar values", () => {
		expect(configMerge({}, { a: 1 }, { a: 2 })).toEqual({ a: 2 });
	});

	it("deep-merges nested objects", () => {
		const result = configMerge({}, { a: { x: 1, y: 2 } }, { a: { y: 3, z: 4 } });
		expect(result).toEqual({ a: { x: 1, y: 3, z: 4 } });
	});

	it("replaces arrays instead of merging them", () => {
		expect(configMerge({}, { arr: [1, 2, 3] }, { arr: [4, 5] })).toEqual({ arr: [4, 5] });
	});

	it("handles null values without throwing", () => {
		expect(configMerge({}, { a: null }, { b: null })).toEqual({ a: null, b: null });
	});

	it("accumulates keys from multiple sources", () => {
		expect(configMerge({}, { a: 1 }, { b: 2 }, { c: 3 })).toEqual({ a: 1, b: 2, c: 3 });
	});
});

describe("Module", () => {
	describe("constructor", () => {
		it("replaces defaults() method with an empty object on the instance", () => {
			const m = new Module();
			expect(typeof (m as unknown as Record<string, unknown>)["defaults"]).toBe("object");
			expect((m as unknown as Record<string, unknown>)["defaults"]).toEqual({});
		});

		it("uses subclass defaults() result in setConfig", () => {
			class ClockModule extends Module {
				defaults(): void {
					(this as unknown as Record<string, unknown>)["defaults"] = { showSeconds: true };
				}
			}
			const m = new ClockModule();
			m.setConfig({});
			expect(m.config).toEqual({ showSeconds: true });
		});

		it("provided config overrides subclass defaults", () => {
			class ClockModule extends Module {
				defaults(): void {
					(this as unknown as Record<string, unknown>)["defaults"] = { showSeconds: true };
				}
			}
			const m = new ClockModule();
			m.setConfig({ showSeconds: false });
			expect(m.config).toEqual({ showSeconds: false });
		});
	});

	describe("setData", () => {
		it("sets name, id, index, position from ModuleInfo", () => {
			const m = new Module();
			m.setData(makeModuleInfo({ name: "weather", id: "weather_2", index: 2, position: "bottom_right" }));
			expect(m.name).toBe("weather");
			expect(m.id).toBe("weather_2");
			expect(m.index).toBe(2);
			expect(m.position).toBe("bottom_right");
		});

		it("sets data.path to the module folder", () => {
			const m = new Module();
			m.setData(makeModuleInfo({ folder: "/modules/default/clock/" }));
			expect(m.data["path"]).toBe("/modules/default/clock/");
		});

		it("hidden is false when hiddenOnStartup is false", () => {
			const m = new Module();
			m.setData(makeModuleInfo({ hiddenOnStartup: false }));
			expect(m.hidden).toBe(false);
		});

		it("hidden is true when hiddenOnStartup is true", () => {
			const m = new Module();
			m.setData(makeModuleInfo({ hiddenOnStartup: true }));
			expect(m.hidden).toBe(true);
		});

		it("merges module config into this.config", () => {
			const m = new Module();
			m.setData(makeModuleInfo({ config: { timezone: "UTC" } }));
			expect(m.config).toEqual({ timezone: "UTC" });
		});
	});

	describe("setPermissions / hasPermission", () => {
		it("hasPermission returns false before setPermissions", () => {
			const m = new Module();
			expect(m.hasPermission("geo.location" as ClientPermission)).toBe(false);
		});

		it("hasPermission returns true for granted permissions", () => {
			const m = new Module();
			m.setPermissions(["geo.location", "user.name"] as ClientPermission[]);
			expect(m.hasPermission("geo.location" as ClientPermission)).toBe(true);
			expect(m.hasPermission("user.name" as ClientPermission)).toBe(true);
		});

		it("hasPermission returns false for ungranted permissions", () => {
			const m = new Module();
			m.setPermissions(["geo.location"] as ClientPermission[]);
			expect(m.hasPermission("camera" as ClientPermission)).toBe(false);
		});

		it("replaces the permission set on repeated calls", () => {
			const m = new Module();
			m.setPermissions(["geo.location"] as ClientPermission[]);
			m.setPermissions(["camera"] as ClientPermission[]);
			expect(m.hasPermission("geo.location" as ClientPermission)).toBe(false);
			expect(m.hasPermission("camera" as ClientPermission)).toBe(true);
		});
	});

	describe("file", () => {
		it("concatenates data.path with the filename", () => {
			const m = new Module();
			m.setData(makeModuleInfo({ folder: "/modules/default/clock/" }));
			expect(m.file("clock.css")).toBe("/modules/default/clock/clock.css");
		});
	});

	describe("getScripts / getStyles", () => {
		it("getScripts returns an empty array by default", () => {
			expect(new Module().getScripts()).toEqual([]);
		});

		it("getStyles returns an empty array by default", () => {
			expect(new Module().getStyles()).toEqual([]);
		});
	});

	describe("createDom", () => {
		it("returns a div HTMLElement", () => {
			const m = new Module();
			const el = m.createDom();
			expect(el).toBeInstanceOf(HTMLElement);
			expect((el as HTMLElement).tagName).toBe("DIV");
		});
	});

	describe("notificationReceived / socketNotificationReceived", () => {
		it("notificationReceived does not throw", () => {
			const m = new Module();
			expect(() => m.notificationReceived("TEST", {})).not.toThrow();
		});

		it("socketNotificationReceived does not throw", () => {
			const m = new Module();
			expect(() => m.socketNotificationReceived("TEST", {})).not.toThrow();
		});
	});

	describe("suspend / resume", () => {
		it("suspend does not throw", () => {
			expect(() => new Module().suspend()).not.toThrow();
		});

		it("resume does not throw", () => {
			expect(() => new Module().resume()).not.toThrow();
		});
	});
});

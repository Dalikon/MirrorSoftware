/**
 * Harness for testing browser-side module JS files in modules/default/NAME/NAME.js.
 *
 * Quick-start in a module's __tests__/NAME.test.ts:
 *
 *   // @jest-environment jsdom
 *   import { createHarness } from "../../../../js/testUtils/moduleHarness";
 *   import { Module } from "../../../../js/module";
 *
 *   jest.mock("../../../../js/clientState.js", () => ({
 *       getClient: jest.fn().mockReturnValue({ updateDom: jest.fn(), ... }),
 *   }));
 *   jest.mock("../../../../js/clientSocket.js", () => ({
 *       ClientSocket: jest.fn().mockImplementation(() => ({ ... })),
 *   }));
 *
 *   const h = createHarness(Module);
 *
 *   beforeAll(() => {
 *       h.setup();
 *       // eslint-disable-next-line @typescript-eslint/no-require-imports
 *       require("../NAME"); // sets window.NAME
 *   });
 *
 *   it("...", () => {
 *       const m = h.make("NAME", { tClientData: ..., clientConfig: ... });
 *       // test m.someMethod() ...
 *   });
 */

import type { ModuleInfo } from "../../types/module.js";

export interface MockSocket {
	on: jest.Mock;
	emit: jest.Mock;
	once: jest.Mock;
}

export interface MockTrackerSocket {
	sendNotification: jest.Mock;
	socket: MockSocket;
}

export interface Harness {
	/** Mock trackerSocket exposed on window. Use to assert sendNotification calls. */
	trackerSocket: MockTrackerSocket;
	/** Mock formatTime. Returns "01.01. 00:00:00" by default. */
	formatTime: jest.Mock;
	/** Mock fetchClientConfig. Returns a minimal ClientConfig by default. */
	fetchClientConfig: jest.Mock;
	/** Mock fetchUserConfig. Returns a minimal UserConfig by default. */
	fetchUserConfig: jest.Mock;
	/** Mock getSession. Returns null by default. */
	getSession: jest.Mock;
	/** Mock global.fetch. Returns undefined by default — override per test. */
	fetchMock: jest.Mock;

	/**
	 * Call in beforeAll() before require()-ing the module file.
	 * Assigns all globals that module JS files expect (Module, trackerSocket, …).
	 */
	setup(): void;

	/**
	 * Instantiate a module class that was registered on window by the module file.
	 * @param moduleName The key set on window (e.g. "clientDetailes").
	 * @param instanceProps Properties to assign directly onto the new instance.
	 */
	make<T = Record<string, unknown>>(moduleName: string, instanceProps?: Record<string, unknown>): T;

	/** Build a fully populated ModuleInfo with sensible defaults. */
	makeModuleInfo(overrides?: Partial<ModuleInfo>): ModuleInfo;
}

export function createHarness(ModuleClass: new () => object): Harness {
	const trackerSocket: MockTrackerSocket = {
		sendNotification: jest.fn(),
		socket: { on: jest.fn(), emit: jest.fn(), once: jest.fn() },
	};

	const formatTime = jest.fn().mockReturnValue("01.01. 00:00:00");
	const fetchClientConfig = jest.fn().mockResolvedValue({
		name: "test",
		users: [],
		defaultModules: [],
	});
	const fetchUserConfig = jest.fn().mockResolvedValue({ name: "user", modules: [] });
	const getSession = jest.fn().mockReturnValue(null);
	const fetchMock = jest.fn();

	function setup(): void {
		const g = global as unknown as Record<string, unknown>;
		g["Module"] = ModuleClass;
		g["trackerSocket"] = trackerSocket;
		g["formatTime"] = formatTime;
		g["fetchClientConfig"] = fetchClientConfig;
		g["fetchUserConfig"] = fetchUserConfig;
		g["getSession"] = getSession;
		global.fetch = fetchMock as typeof fetch;
	}

	function make<T = Record<string, unknown>>(
		moduleName: string,
		instanceProps: Record<string, unknown> = {},
	): T {
		const Cls = (window as unknown as Record<string, new () => unknown>)[moduleName];
		if (!Cls) {
			throw new Error(
				`Module "${moduleName}" not found on window — call h.setup() and require() the module file in beforeAll().`,
			);
		}
		const m = new Cls() as Record<string, unknown>;
		Object.assign(m, instanceProps);
		return m as T;
	}

	function makeModuleInfo(overrides: Partial<ModuleInfo> = {}): ModuleInfo {
		const name = overrides.name ?? "testModule";
		return {
			index: 0,
			id: `${name}_0`,
			name,
			folder: `/modules/default/${name}/`,
			file: `${name}.js`,
			position: "middle_center",
			hiddenOnStartup: false,
			hidden: false,
			header: "",
			config: {},
			classes: name,
			...overrides,
		};
	}

	return {
		trackerSocket,
		formatTime,
		fetchClientConfig,
		fetchUserConfig,
		getSession,
		fetchMock,
		setup,
		make,
		makeModuleInfo,
	};
}

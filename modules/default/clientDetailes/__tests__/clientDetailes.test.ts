/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHarness } from "../../../../js/testUtils/moduleHarness.js";
import { Module } from "../../../../js/module.js";

jest.mock("../../../../js/clientState.js", () => ({
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

jest.mock("../../../../js/clientSocket.js", () => ({
	ClientSocket: jest.fn().mockImplementation(() => ({
		socket: { on: jest.fn(), emit: jest.fn() },
		setNotificationCallback: jest.fn(),
		sendNotification: jest.fn(),
	})),
}));

const h = createHarness(Module);

beforeAll(() => {
	h.setup();
	h.fetchClientConfig.mockResolvedValue({ name: "bathroom", users: ["alice"], defaultModules: [] });
	h.fetchUserConfig.mockResolvedValue({ name: "alice", modules: [] });
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	require("../clientDetailes");
});

function make(props: Record<string, unknown> = {}): any {
	return h.make("clientDetailes", {
		tClientData: { name: "bathroom", status: "online", user: "default", connections: [] },
		clientConfig: { name: "bathroom", users: ["alice"], defaultModules: [] },
		...props,
	});
}

describe("clientDetailes", () => {
	describe("getStyles", () => {
		it("returns the clientDetailes CSS path", () => {
			expect(make().getStyles()).toEqual(["/css/clientDetailes.css"]);
		});
	});

	describe("createDom", () => {
		it("returns null", () => {
			expect(make().createDom()).toBeNull();
		});
	});

	describe("connectionsElement", () => {
		it("shows 'No active connections' when the list is empty", () => {
			const el = make().connectionsElement({ connections: [] });
			expect(el.querySelector(".popup-empty")?.textContent).toBe("No active connections");
		});

		it("renders one row per connection with IP and formatted time", () => {
			const el = make().connectionsElement({
				connections: [
					{ ip: "192.168.1.1", connectedAt: 0 },
					{ ip: "10.0.0.5", connectedAt: 0 },
				],
			});
			const rows = el.querySelectorAll(".connection-row");
			expect(rows).toHaveLength(2);
			expect(rows[0].querySelector(".connection-ip")?.textContent).toBe("192.168.1.1");
			expect(rows[0].querySelector(".connection-time")?.textContent).toBe("01.01. 00:00:00");
		});
	});

	describe("moduleControlElement", () => {
		it("renders the module name and position", () => {
			const row = make().moduleControlElement("bathroom", { module: "clock", position: "top_left" }, 0);
			expect(row.querySelector(".popup-module-name")?.textContent).toBe("clock");
			expect(row.querySelector(".popup-module-pos")?.textContent).toBe("top_left");
		});

		it("Hide button emits HIDE_MODULE_X and switches label to Show", () => {
			const row = make().moduleControlElement("bathroom", { module: "clock", position: "top_left" }, 0);
			const hideBtn = [...row.querySelectorAll(".popup-btn")].find((b: any) => b.textContent === "Hide") as HTMLButtonElement;
			hideBtn.click();
			expect(h.trackerSocket.sendNotification).toHaveBeenCalledWith("HIDE_MODULE_X", {
				module: "clock", id: "clock_0", client: "bathroom",
			});
			expect(hideBtn.textContent).toBe("Show");
		});

		it("Show button emits SHOW_MODULE_X and switches label back to Hide", () => {
			const row = make().moduleControlElement("bathroom", { module: "clock", position: "top_left" }, 0);
			const hideBtn = [...row.querySelectorAll(".popup-btn")].find((b: any) => b.textContent === "Hide") as HTMLButtonElement;
			hideBtn.click();
			hideBtn.click();
			expect(h.trackerSocket.sendNotification).toHaveBeenCalledWith("SHOW_MODULE_X", {
				module: "clock", id: "clock_0", client: "bathroom",
			});
			expect(hideBtn.textContent).toBe("Hide");
		});

		it("Suspend button emits SUSPEND_MODULE_X and switches label to Resume", () => {
			const row = make().moduleControlElement("bathroom", { module: "clock", position: "top_left" }, 0);
			const susBtn = [...row.querySelectorAll(".popup-btn")].find((b: any) => b.textContent === "Suspend") as HTMLButtonElement;
			susBtn.click();
			expect(h.trackerSocket.sendNotification).toHaveBeenCalledWith("SUSPEND_MODULE_X", {
				module: "clock", id: "clock_0", client: "bathroom",
			});
			expect(susBtn.textContent).toBe("Resume");
		});

		it("Resume button emits RESUME_MODULE_X and switches label back to Suspend", () => {
			const row = make().moduleControlElement("bathroom", { module: "clock", position: "top_left" }, 0);
			const susBtn = [...row.querySelectorAll(".popup-btn")].find((b: any) => b.textContent === "Suspend") as HTMLButtonElement;
			susBtn.click();
			susBtn.click();
			expect(h.trackerSocket.sendNotification).toHaveBeenCalledWith("RESUME_MODULE_X", {
				module: "clock", id: "clock_0", client: "bathroom",
			});
			expect(susBtn.textContent).toBe("Suspend");
		});
	});

	describe("moduleSettingsElement", () => {
		it("renders defaultModules when user is 'default'", () => {
			const m = make();
			m.tClientData.user = "default";
			m.clientConfig.defaultModules = [
				{ module: "clock", position: "top_left" },
				{ module: "weather", position: "top_right" },
			];
			const container = document.createElement("div");
			m.moduleSettingsElement(container);
			const names = [...container.querySelectorAll(".popup-module-name")].map((el) => el.textContent);
			expect(names).toEqual(["clock", "weather"]);
		});

		it("renders user-specific modules for a named user", () => {
			const m = make({ userConfigs: [{ name: "alice", modules: [{ module: "personalization" }] }] });
			m.tClientData.user = "alice";
			const container = document.createElement("div");
			m.moduleSettingsElement(container);
			const names = [...container.querySelectorAll(".popup-module-name")].map((el) => el.textContent);
			expect(names).toEqual(["personalization"]);
		});

		it("renders empty list when user has no override config", () => {
			const m = make({ userConfigs: [] });
			m.tClientData.user = "unknown";
			const container = document.createElement("div");
			m.moduleSettingsElement(container);
			expect(container.querySelectorAll(".popup-module")).toHaveLength(0);
		});
	});

	describe("fetchAndStoreUserConfig", () => {
		it("fetches and stores a user config", async () => {
			const cfg = { name: "alice", modules: [] };
			h.fetchUserConfig.mockResolvedValueOnce(cfg);
			const m = make();
			await m.fetchAndStoreUserConfig("bathroom", "alice");
			expect(h.fetchUserConfig).toHaveBeenCalledWith("bathroom", "alice");
			expect(m.userConfigs).toContain(cfg);
		});

		it("skips fetching when config is already cached", async () => {
			const m = make({ userConfigs: [{ name: "alice", modules: [] }] });
			await m.fetchAndStoreUserConfig("bathroom", "alice");
			expect(h.fetchUserConfig).not.toHaveBeenCalled();
		});
	});

	describe("userButtonsElement", () => {
		it("creates a button for 'default' plus each user in clientConfig", async () => {
			const m = make();
			m.clientConfig.users = ["alice", "bob"];
			const el = await m.userButtonsElement({ user: "alice" });
			const labels = [...el.querySelectorAll("button")].map((b: any) => b.textContent);
			expect(labels).toEqual(["default", "alice", "bob"]);
		});

		it("marks the current user's button as active", async () => {
			const m = make();
			m.clientConfig.users = ["alice"];
			const el = await m.userButtonsElement({ user: "alice" });
			expect((el.querySelector(".popup-user-btn.active") as HTMLElement)?.textContent).toBe("alice");
		});

		it("clicking an inactive button sends CHANGE_USER_X", async () => {
			const m = make();
			m.clientConfig.users = ["alice"];
			m.changeModuleSettings = jest.fn();
			const el = await m.userButtonsElement({ user: "default" });
			const aliceBtn = [...el.querySelectorAll("button")].find((b: any) => b.textContent === "alice") as HTMLButtonElement;
			aliceBtn.click();
			expect(h.trackerSocket.sendNotification).toHaveBeenCalledWith("CHANGE_USER_X", {
				client: "bathroom", user: "alice",
			});
		});

		it("clicking the already-active button does not send a notification", async () => {
			const m = make();
			m.clientConfig.users = ["alice"];
			const el = await m.userButtonsElement({ user: "alice" });
			(el.querySelector(".popup-user-btn.active") as HTMLButtonElement).click();
			expect(h.trackerSocket.sendNotification).not.toHaveBeenCalled();
		});
	});

	describe("notificationReceived", () => {
		it("calls showPopup for SHOW_CLIENT_DETAILES", () => {
			const m = make();
			m.showPopup = jest.fn();
			const payload = { name: "bathroom" };
			m.notificationReceived("SHOW_CLIENT_DETAILES", payload);
			expect(m.showPopup).toHaveBeenCalledWith(payload);
		});

		it("ignores unrecognized notifications", () => {
			const m = make();
			m.showPopup = jest.fn();
			m.notificationReceived("SOMETHING_ELSE", {});
			expect(m.showPopup).not.toHaveBeenCalled();
		});
	});

	describe("showPopup", () => {
		beforeEach(() => {
			document.body.innerHTML = '<div id="all-regions"></div>';
		});

		it("appends a #popup element to #all-regions", async () => {
			await make().showPopup({ name: "bathroom", status: "online", user: "default", connections: [] });
			expect(document.getElementById("popup")).not.toBeNull();
		});

		it("shows the client name in the popup header", async () => {
			await make().showPopup({ name: "bathroom", status: "online", user: "default", connections: [] });
			expect(document.querySelector(".popup-header h2")?.textContent).toBe("bathroom");
		});

		it("close button removes the popup", async () => {
			await make().showPopup({ name: "bathroom", status: "online", user: "default", connections: [] });
			(document.getElementById("close-popup") as HTMLButtonElement).click();
			expect(document.getElementById("popup")).toBeNull();
		});

		it("replaces an existing popup instead of appending a second one", async () => {
			const m = make();
			await m.showPopup({ name: "bathroom", status: "online", user: "default", connections: [] });
			await m.showPopup({ name: "bathroom", status: "online", user: "default", connections: [] });
			expect(document.querySelectorAll("#popup")).toHaveLength(1);
		});
	});
});

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
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	require("../clientDisplay");
});

const ONLINE_CLIENT = {
	id: "c1",
	name: "bathroom",
	status: "online",
	user: "dala",
	type: "mirror",
	connections: [{ ip: "192.168.1.5", connectedAt: 1000 }],
	lastOnline: 2000,
	connectedAt: 1000,
};

const OFFLINE_CLIENT = {
	...ONLINE_CLIENT,
	status: "offline",
	connections: [],
};

function make(props: Record<string, unknown> = {}): any {
	return h.make("clientDisplay", props);
}

describe("clientDisplay", () => {
	describe("getStyles", () => {
		it("returns the clientDisplay CSS path", () => {
			expect(make().getStyles()).toEqual(["/css/clientDisplay.css"]);
		});
	});

	describe("statusElement", () => {
		it("shows the status text with an 'online' class for an online client", () => {
			const el = make().statusElement(ONLINE_CLIENT);
			const span = el.querySelector("span");
			expect(span?.textContent).toBe("online");
			expect(span?.classList.contains("online")).toBe(true);
		});

		it("shows the status text with an 'offline' class for an offline client", () => {
			const el = make().statusElement(OFFLINE_CLIENT);
			const span = el.querySelector("span");
			expect(span?.textContent).toBe("offline");
			expect(span?.classList.contains("offline")).toBe(true);
		});
	});

	describe("lastOnlineElement", () => {
		it("creates a paragraph starting with 'Last seen: '", () => {
			const el = make().lastOnlineElement(OFFLINE_CLIENT);
			expect(el.textContent).toContain("Last seen: ");
			expect(el.querySelector("span")?.textContent).toBe("01.01. 00:00:00");
		});
	});

	describe("connectedElement", () => {
		it("creates a paragraph starting with 'Connected: '", () => {
			const el = make().connectedElement(ONLINE_CLIENT);
			expect(el.textContent).toContain("Connected: ");
			expect(el.querySelector("span")?.textContent).toBe("01.01. 00:00:00");
		});
	});

	describe("loggedUserElement", () => {
		it("shows the current user in a span", () => {
			const el = make().loggedUserElement(ONLINE_CLIENT);
			expect(el.textContent).toContain("Logged user: ");
			expect(el.querySelector("span")?.textContent).toBe("dala");
		});
	});

	describe("connectionNumElement", () => {
		it("shows the number of active connections", () => {
			const el = make().connectionNumElement(ONLINE_CLIENT);
			expect(el.textContent).toContain("Connections: ");
			expect(el.querySelector("span")?.textContent).toBe("1");
		});

		it("shows 0 when no connections", () => {
			const el = make().connectionNumElement(OFFLINE_CLIENT);
			expect(el.querySelector("span")?.textContent).toBe("0");
		});
	});

	describe("typeElement", () => {
		it("shows the client type", () => {
			const el = make().typeElement(ONLINE_CLIENT);
			expect(el.textContent).toContain("Type: ");
			expect(el.querySelector("span")?.textContent).toBe("mirror");
		});
	});

	describe("createDom", () => {
		it("returns a #client-container div", async () => {
			const m = make({ trackedC: [ONLINE_CLIENT] });
			const el = await m.createDom();
			expect(el.id).toBe("client-container");
		});

		it("renders one .client-div per tracked client", async () => {
			const m = make({ trackedC: [ONLINE_CLIENT, OFFLINE_CLIENT] });
			const el = await m.createDom();
			expect(el.querySelectorAll(".client-div")).toHaveLength(2);
		});

		it("shows client name in h4", async () => {
			const m = make({ trackedC: [ONLINE_CLIENT] });
			const el = await m.createDom();
			expect(el.querySelector("h4")?.textContent).toBe("bathroom");
		});

		it("online client uses connectedElement (not lastOnlineElement)", async () => {
			const m = make({ trackedC: [ONLINE_CLIENT] });
			const el = await m.createDom();
			expect(el.textContent).toContain("Connected: ");
			expect(el.textContent).not.toContain("Last seen: ");
		});

		it("offline client uses lastOnlineElement (not connectedElement)", async () => {
			const m = make({ trackedC: [OFFLINE_CLIENT] });
			const el = await m.createDom();
			expect(el.textContent).toContain("Last seen: ");
			expect(el.textContent).not.toContain("Connected: ");
		});

		it("'View Details' button sends SHOW_CLIENT_DETAILES notification", async () => {
			const mockSendNotification = jest.fn();
			const m = make({ trackedC: [ONLINE_CLIENT] });
			m.sendNotification = mockSendNotification;
			const el = await m.createDom();
			const btn = el.querySelector(".view-client") as HTMLButtonElement;
			btn.click();
			expect(mockSendNotification).toHaveBeenCalledWith("SHOW_CLIENT_DETAILES", ONLINE_CLIENT);
		});
	});

	describe("start", () => {
		it("registers a 'trackersData' listener on rootSocket", async () => {
			const m = make();
			await m.start();
			const events = (h.trackerSocket.socket.on.mock.calls as [string, unknown][]).map(([ev]) => ev);
			expect(events).toContain("trackersData");
		});

		it("updates trackedC and calls updateDom when trackersData arrives", async () => {
			const m = make();
			m.updateDom = jest.fn();
			await m.start();
			const calls = h.trackerSocket.socket.on.mock.calls as [string, (data: unknown) => void][];
			const handler = calls.find(([ev]) => ev === "trackersData")?.[1]!;
			handler([ONLINE_CLIENT]);
			expect(m.trackedC).toEqual([ONLINE_CLIENT]);
			expect(m.updateDom).toHaveBeenCalled();
		});
	});

	describe("getTrackers", () => {
		it("does not emit retrieveTrackers when trackedC is already set", async () => {
			const m = make({ trackedC: [ONLINE_CLIENT] });
			await m.getTrackers();
			expect(h.trackerSocket.socket.emit).not.toHaveBeenCalledWith("retrieveTrackers");
		});

		it("emits retrieveTrackers and waits for trackersData when trackedC is not set", async () => {
			const m = make();
			const getTrackersPromise = m.getTrackers();

			// Simulate the server responding with trackersData
			const calls = h.trackerSocket.socket.once.mock.calls as [string, (data: unknown) => void][];
			const handler = calls.find(([ev]) => ev === "trackersData")?.[1]!;
			handler([ONLINE_CLIENT]);

			await getTrackersPromise;

			expect(h.trackerSocket.socket.emit).toHaveBeenCalledWith("retrieveTrackers");
			expect(m.trackedC).toEqual([ONLINE_CLIENT]);
		});
	});
});

import { ClientSocket } from "../clientSocket.js";

const mockSocket = {
	on: jest.fn(),
	emit: jest.fn(),
	onevent: undefined as unknown,
};

jest.mock("socket.io-client", () => ({
	io: jest.fn(() => mockSocket),
}));

describe("ClientSocket", () => {
	describe("constructor", () => {
		it("throws when moduleName is not a string", () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect(() => new ClientSocket(123 as any)).toThrow("Please set the module name for the ClientSocket.");
		});

		it("connects to /{moduleName} for named modules", () => {
			const { io } = require("socket.io-client") as { io: jest.Mock };
			new ClientSocket("clock");
			expect(io).toHaveBeenCalledWith("/clock", expect.objectContaining({ path: "/socket.io" }));
		});

		it("connects to / with provided query for the tracker socket", () => {
			const { io } = require("socket.io-client") as { io: jest.Mock };
			new ClientSocket("/", { clientName: "bathroom", clientType: "mirror" });
			expect(io).toHaveBeenCalledWith("/", expect.objectContaining({
				path: "/socket.io",
				query: { clientName: "bathroom", clientType: "mirror" },
			}));
		});

		it("uses empty query when / is given with no query argument", () => {
			const { io } = require("socket.io-client") as { io: jest.Mock };
			new ClientSocket("/");
			expect(io).toHaveBeenCalledWith("/", expect.objectContaining({ query: {} }));
		});

		it("registers a '*' listener on the socket", () => {
			new ClientSocket("clock");
			const registeredEvents = (mockSocket.on.mock.calls as [string, unknown][]).map(([ev]) => ev);
			expect(registeredEvents).toContain("*");
		});
	});

	describe("sendNotification", () => {
		it("calls socket.emit with the notification and payload", () => {
			const cs = new ClientSocket("clock");
			cs.sendNotification("TEST_EVENT", { data: 42 });
			expect(mockSocket.emit).toHaveBeenCalledWith("TEST_EVENT", { data: 42 });
		});
	});

	describe("setNotificationCallback", () => {
		it("routes incoming events to the registered callback", () => {
			const cs = new ClientSocket("clock");
			const cb = jest.fn();
			cs.setNotificationCallback(cb);

			const calls = mockSocket.on.mock.calls as [string, (...args: unknown[]) => void][];
			const starHandler = calls.find(([ev]) => ev === "*")?.[1];
			expect(starHandler).toBeDefined();

			starHandler?.("SOME_EVENT", { value: 1 });
			expect(cb).toHaveBeenCalledWith("SOME_EVENT", { value: 1 });
		});

		it("does not forward the synthetic '*' event itself to the callback", () => {
			const cs = new ClientSocket("clock");
			const cb = jest.fn();
			cs.setNotificationCallback(cb);

			const calls = mockSocket.on.mock.calls as [string, (...args: unknown[]) => void][];
			const starHandler = calls.find(([ev]) => ev === "*")?.[1];
			starHandler?.("*", {});

			expect(cb).not.toHaveBeenCalled();
		});

		it("replaces a previously registered callback", () => {
			const cs = new ClientSocket("clock");
			const cb1 = jest.fn();
			const cb2 = jest.fn();
			cs.setNotificationCallback(cb1);
			cs.setNotificationCallback(cb2);

			const calls = mockSocket.on.mock.calls as [string, (...args: unknown[]) => void][];
			const starHandler = calls.find(([ev]) => ev === "*")?.[1];
			starHandler?.("PING", null);

			expect(cb1).not.toHaveBeenCalled();
			expect(cb2).toHaveBeenCalledWith("PING", null);
		});
	});
});

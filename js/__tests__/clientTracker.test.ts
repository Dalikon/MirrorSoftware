import ClientTracker from "../clientTracker.js";

describe("ClientTracker", () => {
	describe("constructor", () => {
		it("applies documented defaults for a freshly created tracker", () => {
			const tracker = new ClientTracker("bathroom", "mirror");

			expect(tracker.name).toBe("bathroom");
			expect(tracker.type).toBe("mirror");
			expect(tracker.status).toBe("online");
			expect(tracker.user).toBe("default");
			expect(tracker.lastOnline).toBeNull();
			expect(tracker.connectedAt).toBeNull();
			expect(tracker.connections).toEqual([]);
		});

		it("converts string/Date inputs for lastOnline and connectedAt into Date instances", () => {
			const tracker = new ClientTracker(
				"bathroom",
				"mirror",
				"2026-01-01T00:00:00.000Z",
				new Date("2026-01-02T00:00:00.000Z"),
			);

			expect(tracker.lastOnline).toBeInstanceOf(Date);
			expect(tracker.connectedAt).toBeInstanceOf(Date);
			expect(tracker.lastOnline?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
		});

		it("keeps explicit status, user and connections when provided", () => {
			const connections = [{ ip: "10.0.0.5", connectedAt: new Date("2026-01-01T00:00:00.000Z") }];
			const tracker = new ClientTracker(
				"root",
				"dashboard",
				null,
				null,
				"offline",
				connections,
				"dala",
			);

			expect(tracker.status).toBe("offline");
			expect(tracker.user).toBe("dala");
			expect(tracker.connections).toBe(connections);
		});
	});

	describe("fromObject", () => {
		it("rehydrates a tracker from its JSON-serialized shape (cTracker.json)", () => {
			const stored = {
				name: "bathroom",
				type: "mirror" as const,
				lastOnline: "2026-01-01T12:00:00.000Z",
				connectedAt: "2026-01-01T12:05:00.000Z",
				status: "online" as const,
				user: "dala",
				connections: [{ ip: "10.0.0.5", connectedAt: new Date("2026-01-01T12:05:00.000Z") }],
			};

			const tracker = ClientTracker.fromObject(stored);

			expect(tracker).toBeInstanceOf(ClientTracker);
			expect(tracker.name).toBe("bathroom");
			expect(tracker.user).toBe("dala");
			expect(tracker.lastOnline).toBeInstanceOf(Date);
			expect(tracker.lastOnline?.toISOString()).toBe("2026-01-01T12:00:00.000Z");
			expect(tracker.connections).toEqual(stored.connections);
		});

		it("handles null lastOnline/connectedAt (a tracker that has never connected)", () => {
			const stored = {
				name: "kitchen",
				type: "mirror" as const,
				lastOnline: null,
				connectedAt: null,
				status: "offline" as const,
				user: "default",
				connections: [],
			};

			const tracker = ClientTracker.fromObject(stored);

			expect(tracker.lastOnline).toBeNull();
			expect(tracker.connectedAt).toBeNull();
		});
	});
});

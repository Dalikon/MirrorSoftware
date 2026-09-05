import { AuthService, COOKIE_NAME } from "../authService.js";
import { initDb } from "../db/index.js";
import { accounts as accountsTable } from "../db/schema.js";
import type { Db } from "../db/index.js";

describe("AuthService", () => {
	let db: Db;

	beforeEach(() => {
		db = initDb(":memory:");
	});

	describe("bootstrap", () => {
		it("creates a default admin/admin account when none exist", () => {
			new AuthService(db);

			const rows = db.select().from(accountsTable).all();
			expect(rows).toHaveLength(1);
			expect(rows[0]!.username).toBe("admin");
			expect(rows[0]!.role).toBe("admin");
		});

		it("does not overwrite existing accounts", () => {
			db.insert(accountsTable).values({
				username: "someone",
				displayName: "Someone",
				role: "user",
				passwordHash: "x",
				salt: "y",
			}).run();

			new AuthService(db);

			const rows = db.select().from(accountsTable).all();
			expect(rows).toHaveLength(1);
			expect(rows[0]!.username).toBe("someone");
		});
	});

	describe("login", () => {
		it("succeeds with default admin/admin credentials and returns a session", () => {
			const auth = new AuthService(db);
			const session = auth.login("admin", "admin");

			expect(session).not.toBeNull();
			expect(session?.username).toBe("admin");
			expect(session?.role).toBe("admin");
			expect(typeof session?.token).toBe("string");
		});

		it("returns null for a wrong password", () => {
			const auth = new AuthService(db);
			expect(auth.login("admin", "wrong-password")).toBeNull();
		});

		it("returns null for an unknown username", () => {
			const auth = new AuthService(db);
			expect(auth.login("nobody", "admin")).toBeNull();
		});
	});

	describe("sessions", () => {
		it("resolves a valid token via getSession", () => {
			const auth = new AuthService(db);
			const session = auth.login("admin", "admin")!;

			expect(auth.getSession(session.token)).toEqual({
				username: "admin",
				displayName: "Admin",
				role: "admin",
			});
		});

		it("returns null for an unknown token", () => {
			const auth = new AuthService(db);
			expect(auth.getSession("not-a-real-token")).toBeNull();
		});

		it("expires a session once past its TTL", () => {
			const auth = new AuthService(db);
			const session = auth.login("admin", "admin")!;

			const realNow = Date.now;
			try {
				Date.now = () => realNow() + 8 * 24 * 60 * 60 * 1000;
				expect(auth.getSession(session.token)).toBeNull();
			} finally {
				Date.now = realNow;
			}

			expect(auth.getSession(session.token)).toBeNull();
		});

		it("invalidates the token on logout", () => {
			const auth = new AuthService(db);
			const session = auth.login("admin", "admin")!;
			auth.logout(session.token);
			expect(auth.getSession(session.token)).toBeNull();
		});

		it("persists sessions to the DB so a new AuthService instance sees them", () => {
			const first = new AuthService(db);
			const session = first.login("admin", "admin")!;

			// Second instance shares same DB — simulates restart with same persistent DB
			const second = new AuthService(db);
			expect(second.getSession(session.token)).toEqual({
				username: "admin",
				displayName: "Admin",
				role: "admin",
			});
		});
	});

	describe("account management", () => {
		it("creates a new account that can then log in", () => {
			const auth = new AuthService(db);
			auth.createAccount("dala", "Dala", "user", "hunter2");

			const session = auth.login("dala", "hunter2");
			expect(session?.username).toBe("dala");
			expect(session?.role).toBe("user");
		});

		it("refuses to create a duplicate username", () => {
			const auth = new AuthService(db);
			auth.createAccount("dala", "Dala", "user", "hunter2");

			expect(() => auth.createAccount("dala", "Someone Else", "user", "x")).toThrow(
				/already exists/,
			);
		});

		it("listAccounts never leaks passwordHash or salt", () => {
			const auth = new AuthService(db);
			const listed = auth.listAccounts();

			expect(listed).toHaveLength(1);
			expect(listed[0]).not.toHaveProperty("passwordHash");
			expect(listed[0]).not.toHaveProperty("salt");
		});

		it("updateAccount changes the password", () => {
			const auth = new AuthService(db);
			auth.updateAccount("admin", { password: "new-password" });

			expect(auth.login("admin", "admin")).toBeNull();
			expect(auth.login("admin", "new-password")?.username).toBe("admin");
		});

		it("updateAccount on an unknown user throws", () => {
			const auth = new AuthService(db);
			expect(() => auth.updateAccount("nobody", { displayName: "x" })).toThrow(/not found/);
		});

		it("deleteAccount removes the account and invalidates its sessions", () => {
			const auth = new AuthService(db);
			auth.createAccount("dala", "Dala", "user", "hunter2");
			const session = auth.login("dala", "hunter2")!;

			auth.deleteAccount("dala");

			expect(auth.listAccounts().find((a) => a.username === "dala")).toBeUndefined();
			expect(auth.getSession(session.token)).toBeNull();
		});

		it("deleteAccount on an unknown user throws", () => {
			const auth = new AuthService(db);
			expect(() => auth.deleteAccount("nobody")).toThrow(/not found/);
		});
	});

	describe("parseCookie", () => {
		it("extracts the named cookie from a cookie header", () => {
			const auth = new AuthService(db);
			const header = `other=1; ${COOKIE_NAME}=abc123; another=2`;
			expect(auth.parseCookie(header, COOKIE_NAME)).toBe("abc123");
		});

		it("returns undefined when the cookie is absent", () => {
			const auth = new AuthService(db);
			expect(auth.parseCookie("other=1", COOKIE_NAME)).toBeUndefined();
		});

		it("returns undefined when the header itself is undefined", () => {
			const auth = new AuthService(db);
			expect(auth.parseCookie(undefined, COOKIE_NAME)).toBeUndefined();
		});
	});
});

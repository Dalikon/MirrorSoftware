import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AuthService, COOKIE_NAME } from "../authService.js";

// AuthService takes rootDir in its constructor and reads/writes real files
// under `${rootDir}/configs/users/accounts.json` and
// `${rootDir}/workData/sessions.json`. That makes it easy to test against
// a throwaway temp directory instead of mocking `fs` — each test gets a
// clean, isolated filesystem instead of shared state or fragile mocks.
describe("AuthService", () => {
	let rootDir: string;

	beforeEach(() => {
		rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dalamirror-auth-"));
	});

	afterEach(() => {
		fs.rmSync(rootDir, { recursive: true, force: true });
	});

	describe("bootstrap", () => {
		it("creates a default admin/admin account when none exists yet", () => {
			new AuthService(rootDir);

			const accounts = JSON.parse(
				fs.readFileSync(path.join(rootDir, "configs/users/accounts.json"), "utf8"),
			);
			expect(accounts).toHaveLength(1);
			expect(accounts[0].username).toBe("admin");
			expect(accounts[0].role).toBe("admin");
		});

		it("does not overwrite an existing accounts file", () => {
			const accountsPath = path.join(rootDir, "configs/users/accounts.json");
			fs.mkdirSync(path.dirname(accountsPath), { recursive: true });
			fs.writeFileSync(
				accountsPath,
				JSON.stringify([
					{
						username: "someone",
						displayName: "Someone",
						role: "user",
						passwordHash: "x",
						salt: "y",
					},
				]),
			);

			new AuthService(rootDir);

			const accounts = JSON.parse(fs.readFileSync(accountsPath, "utf8"));
			expect(accounts).toHaveLength(1);
			expect(accounts[0].username).toBe("someone");
		});
	});

	describe("login", () => {
		it("succeeds with the default admin/admin credentials and returns a session", () => {
			const auth = new AuthService(rootDir);
			const session = auth.login("admin", "admin");

			expect(session).not.toBeNull();
			expect(session?.username).toBe("admin");
			expect(session?.role).toBe("admin");
			expect(typeof session?.token).toBe("string");
		});

		it("returns null for a wrong password", () => {
			const auth = new AuthService(rootDir);
			expect(auth.login("admin", "wrong-password")).toBeNull();
		});

		it("returns null for an unknown username", () => {
			const auth = new AuthService(rootDir);
			expect(auth.login("nobody", "admin")).toBeNull();
		});
	});

	describe("sessions", () => {
		it("resolves a valid token via getSession", () => {
			const auth = new AuthService(rootDir);
			const session = auth.login("admin", "admin")!;

			const info = auth.getSession(session.token);
			expect(info).toEqual({ username: "admin", displayName: "Admin", role: "admin" });
		});

		it("returns null for an unknown token", () => {
			const auth = new AuthService(rootDir);
			expect(auth.getSession("not-a-real-token")).toBeNull();
		});

		it("expires a session once past its TTL", () => {
			const auth = new AuthService(rootDir);
			const session = auth.login("admin", "admin")!;

			const realNow = Date.now;
			try {
				// 8 days ahead — past the 7-day session TTL
				Date.now = () => realNow() + 8 * 24 * 60 * 60 * 1000;
				expect(auth.getSession(session.token)).toBeNull();
			} finally {
				Date.now = realNow;
			}

			// the expired session should have been evicted, not just hidden
			expect(auth.getSession(session.token)).toBeNull();
		});

		it("invalidates the token on logout", () => {
			const auth = new AuthService(rootDir);
			const session = auth.login("admin", "admin")!;

			auth.logout(session.token);

			expect(auth.getSession(session.token)).toBeNull();
		});

		it("persists sessions across a restart (new AuthService instance, same rootDir)", () => {
			const first = new AuthService(rootDir);
			const session = first.login("admin", "admin")!;

			const second = new AuthService(rootDir);
			expect(second.getSession(session.token)).toEqual({
				username: "admin",
				displayName: "Admin",
				role: "admin",
			});
		});
	});

	describe("account management", () => {
		it("creates a new account that can then log in", () => {
			const auth = new AuthService(rootDir);
			auth.createAccount("dala", "Dala", "user", "hunter2");

			const session = auth.login("dala", "hunter2");
			expect(session?.username).toBe("dala");
			expect(session?.role).toBe("user");
		});

		it("refuses to create a duplicate username", () => {
			const auth = new AuthService(rootDir);
			auth.createAccount("dala", "Dala", "user", "hunter2");

			expect(() => auth.createAccount("dala", "Someone Else", "user", "x")).toThrow(
				/already exists/,
			);
		});

		it("listAccounts never leaks passwordHash or salt", () => {
			const auth = new AuthService(rootDir);
			const accounts = auth.listAccounts();

			expect(accounts).toHaveLength(1);
			expect(accounts[0]).not.toHaveProperty("passwordHash");
			expect(accounts[0]).not.toHaveProperty("salt");
		});

		it("updateAccount changes the password (old password stops working)", () => {
			const auth = new AuthService(rootDir);
			auth.updateAccount("admin", { password: "new-password" });

			expect(auth.login("admin", "admin")).toBeNull();
			expect(auth.login("admin", "new-password")?.username).toBe("admin");
		});

		it("updateAccount on an unknown user throws", () => {
			const auth = new AuthService(rootDir);
			expect(() => auth.updateAccount("nobody", { displayName: "x" })).toThrow(/not found/);
		});

		it("deleteAccount removes the account and invalidates its sessions", () => {
			const auth = new AuthService(rootDir);
			auth.createAccount("dala", "Dala", "user", "hunter2");
			const session = auth.login("dala", "hunter2")!;

			auth.deleteAccount("dala");

			expect(auth.listAccounts().find((a) => a.username === "dala")).toBeUndefined();
			expect(auth.getSession(session.token)).toBeNull();
		});

		it("deleteAccount on an unknown user throws", () => {
			const auth = new AuthService(rootDir);
			expect(() => auth.deleteAccount("nobody")).toThrow(/not found/);
		});
	});

	describe("parseCookie", () => {
		it("extracts the named cookie from a cookie header", () => {
			const auth = new AuthService(rootDir);
			const header = `other=1; ${COOKIE_NAME}=abc123; another=2`;
			expect(auth.parseCookie(header, COOKIE_NAME)).toBe("abc123");
		});

		it("returns undefined when the cookie is absent", () => {
			const auth = new AuthService(rootDir);
			expect(auth.parseCookie("other=1", COOKIE_NAME)).toBeUndefined();
		});

		it("returns undefined when the header itself is undefined", () => {
			const auth = new AuthService(rootDir);
			expect(auth.parseCookie(undefined, COOKIE_NAME)).toBeUndefined();
		});
	});
});

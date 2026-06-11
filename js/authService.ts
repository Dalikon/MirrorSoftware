import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Account, Session, SessionInfo } from "../types/auth.js";

export const COOKIE_NAME = "hms-session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class AuthService {
    private rootDir: string;
    private sessions = new Map<string, Session>();

    private get accountsPath(): string {
        return path.resolve(this.rootDir, "configs/users/accounts.json");
    }

    private get sessionsPath(): string {
        return path.resolve(this.rootDir, "workData/sessions.json");
    }

    constructor(rootDir: string) {
        this.rootDir = rootDir;
        this.ensureAccounts();
        this.loadSessions();
    }

    private ensureAccounts(): void {
        if (fs.existsSync(this.accountsPath)) return;

        const salt = crypto.randomBytes(16).toString("hex");
        const defaultAccount: Account = {
            username: "admin",
            displayName: "Admin",
            role: "admin",
            passwordHash: this.hashPassword("admin", salt),
            salt,
        };
        fs.mkdirSync(path.dirname(this.accountsPath), { recursive: true });
        fs.writeFileSync(this.accountsPath, JSON.stringify([defaultAccount], null, 2));
        console.warn("[Auth] No accounts file found. Created default admin/admin account. Change the password immediately.");
    }

    private loadSessions(): void {
        if (!fs.existsSync(this.sessionsPath)) return;
        try {
            const data = JSON.parse(fs.readFileSync(this.sessionsPath, "utf8")) as Session[];
            const now = Date.now();
            for (const s of data) {
                if (s.expiresAt > now) this.sessions.set(s.token, s);
            }
            console.log(`[Auth] Loaded ${this.sessions.size} active session(s).`);
        } catch {
            console.warn("[Auth] Failed to load sessions file, starting fresh.");
        }
    }

    private saveSessions(): void {
        fs.writeFileSync(this.sessionsPath, JSON.stringify(Array.from(this.sessions.values()), null, 2));
    }

    private hashPassword(password: string, salt: string): string {
        return crypto.scryptSync(password, salt, 64).toString("hex");
    }

    private loadAccounts(): Account[] {
        return JSON.parse(fs.readFileSync(this.accountsPath, "utf8")) as Account[];
    }

    login(username: string, password: string): Session | null {
        const account = this.loadAccounts().find(a => a.username === username);
        if (!account) return null;
        if (this.hashPassword(password, account.salt) !== account.passwordHash) return null;

        const token = crypto.randomUUID();
        const session: Session = {
            token,
            username: account.username,
            displayName: account.displayName,
            role: account.role,
            expiresAt: Date.now() + SESSION_TTL_MS,
        };
        this.sessions.set(token, session);
        this.saveSessions();
        return session;
    }

    getSession(token: string): SessionInfo | null {
        const session = this.sessions.get(token);
        if (!session) return null;
        if (session.expiresAt < Date.now()) {
            this.sessions.delete(token);
            return null;
        }
        return { username: session.username, displayName: session.displayName, role: session.role };
    }

    logout(token: string): void {
        this.sessions.delete(token);
        this.saveSessions();
    }

    parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
        return cookieHeader
            ?.split(";")
            .map(c => c.trim().split("="))
            .find(([k]) => k === name)?.[1];
    }
}

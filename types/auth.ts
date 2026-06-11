export type UserRole = "admin" | "user";

export interface Account {
    username: string;
    displayName: string;
    role: UserRole;
    passwordHash: string;
    salt: string;
}

export interface Session {
    token: string;
    username: string;
    displayName: string;
    role: UserRole;
    expiresAt: number;
}

export interface SessionInfo {
    username: string;
    displayName: string;
    role: UserRole;
}

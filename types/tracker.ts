import type { ClientType } from "./module";

export type ClientStatus = "online" | "offline";

export interface ClientConnection {
    ip: string;
    connectedAt: Date;
}

export interface ClientTrackerData {
    name: string;
    type: ClientType;
    lastOnline: Date | null;
    connectedAt: Date | null;
    status: ClientStatus;
    user: string;
    connections: ClientConnection[];
}

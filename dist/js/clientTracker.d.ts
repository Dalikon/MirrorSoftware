import type { ClientStatus, ClientConnection, ClientTrackerData } from "../types/tracker.js";
import type { ClientType } from "../types/module.js";
interface ClientTrackerJSON {
    name: string;
    type: ClientType;
    lastOnline: string | null;
    connectedAt: string | null;
    status: ClientStatus;
    user: string;
    connections: ClientConnection[];
}
declare class ClientTracker implements ClientTrackerData {
    name: string;
    type: ClientType;
    lastOnline: Date | null;
    connectedAt: Date | null;
    status: ClientStatus;
    user: string;
    connections: ClientConnection[];
    constructor(name: string, type: ClientType, lastOnline?: string | Date | null, connectedAt?: string | Date | null, status?: ClientStatus, connections?: ClientConnection[], user?: string);
    static fromObject(obj: ClientTrackerJSON): ClientTracker;
    start(): void;
    end(): void;
}
export default ClientTracker;

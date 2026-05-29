// Payloads for module visibility/lifecycle events
// Sent from dashboard/root → server → target mirror client
export interface ModuleSocketPayload {
    client: string;
    id: string;
}

// Payload for user switch events
export interface UserSocketPayload {
    client: string;
    user: string;
}

// All socket event names and their payload types
export interface ServerSocketEvents {
    HIDE_MODULE_X: ModuleSocketPayload;
    SHOW_MODULE_X: ModuleSocketPayload;
    SUSPEND_MODULE_X: ModuleSocketPayload;
    RESUME_MODULE_X: ModuleSocketPayload;
    CHANGE_USER_X: UserSocketPayload;
    heartbeat: void;
    retrieveTrackers: void;
}

export interface ClientSocketEvents {
    HIDE_MODULE_Y: ModuleSocketPayload;
    SHOW_MODULE_Y: ModuleSocketPayload;
    SUSPEND_MODULE_Y: ModuleSocketPayload;
    RESUME_MODULE_Y: ModuleSocketPayload;
    CHANGE_USER_Y: UserSocketPayload;
    trackersData: unknown;
}

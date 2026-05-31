import { io, Socket } from "socket.io-client";

export class ClientSocket {
    moduleName: string;
    socket: Socket;
    private notificationCallback: (notification: string, payload: unknown) => void;

    constructor(moduleName: string, query: Record<string, string> | null = null) {
        if (typeof moduleName !== "string") {
            throw new Error("Please set the module name for the ClientSocket.");
        }

        this.moduleName = moduleName;
        this.notificationCallback = () => {};

        if (moduleName !== "/") {
            this.socket = io(`/${moduleName}`, { path: "/socket.io" });
        } else {
            this.socket = io("/", { path: "/socket.io", query: query ?? {} });
        }

        // Intercept all events and re-emit as "*" for catch-all module handling
        const onevent = (this.socket as unknown as Record<string, unknown>)["onevent"] as
            (packet: { data?: unknown[] }) => void;

        (this.socket as unknown as Record<string, unknown>)["onevent"] = (packet: { data?: unknown[] }) => {
            if (packet?.data) {
                const args = packet.data;
                onevent.call(this.socket, packet);
                packet.data = (["*"] as unknown[]).concat(args);
                onevent.call(this.socket, packet);
            }
        };

        (this.socket as unknown as { on(ev: string, cb: (...a: unknown[]) => void): void })
            .on("*", (...args: unknown[]) => {
                const [notification, payload] = args as [string, unknown];
                if (notification !== "*") {
                    this.notificationCallback(notification, payload);
                }
            });
    }

    setNotificationCallback(callback: (notification: string, payload: unknown) => void): void {
        this.notificationCallback = callback;
    }

    sendNotification(notification: string, payload: unknown): void {
        this.socket.emit(notification, payload);
    }
}

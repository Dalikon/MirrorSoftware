import express from "express";
import type { Server as SocketIOServer, Socket } from "socket.io";

class Helper {
    name!: string;
    path!: string;
    expressApp!: express.Application;
    socketio!: SocketIOServer;

    constructor() {
        this.init();
    }

    init(): void {
        console.log(`Initializing new module helper`);
    }

    loaded(): void {
        console.log(`Helper loaded for module: ${this.name}`);
    }

    start(): Promise<void> {
        console.log(`Starting helper: ${this.name}`);
        return Promise.resolve();
    }

    stop(): void {
        console.log(`Stopping helper: ${this.name}`);
    }

    socketNotificationReceived(notification: string, payload: unknown): void {
        console.log(`${this.name} received a socket notification: ${notification} - Payload: ${payload}`);
    }

    sendSocketNotification(notification: string, payload: unknown): void {
        this.socketio.of(this.name).emit(notification, payload);
    }

    setName(name: string): void {
        this.name = name;
    }

    setPath(path: string): void {
        this.path = path;
    }

    setExpressApp(app: express.Application): void {
        this.expressApp = app;
        this.expressApp.use(`/${this.name}`, express.static(`${this.path}/public`));
    }

    setSocketIO(socketio: SocketIOServer): void {
        this.socketio = socketio;

        console.log(`Connecting socketio for: ${this.name}`);

        this.socketio.of(this.name).on("connection", (socket: Socket) => {
            // socket.onevent is an internal Socket.IO API used here to intercept
            // all events and re-emit them as "*" for catch-all handling in modules
            const s = socket as unknown as Record<string, unknown>;
            const onevent = s["onevent"] as (packet: { data?: unknown[] }) => void;
            s["onevent"] = function (packet: { data?: unknown[] }) {
                if (packet?.data) {
                    const args = packet.data;
                    onevent.call(this, packet);
                    packet.data = (["*"] as unknown[]).concat(args);
                    onevent.call(this, packet);
                }
            };

            (socket as unknown as { on(event: string, cb: (...args: unknown[]) => void): void })
                .on("*", (...args: unknown[]) => {
                    const [notification, payload = {}] = args as [string, unknown];
                    if (notification !== "*") {
                        this.socketNotificationReceived(notification, payload);
                    }
                });
        });
    }
}

export default Helper;

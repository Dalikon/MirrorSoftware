import express from "express";
import type { Server as SocketIOServer } from "socket.io";
declare class Helper {
    name: string;
    path: string;
    expressApp: express.Application;
    socketio: SocketIOServer;
    constructor();
    init(): void;
    loaded(): void;
    start(): Promise<void>;
    stop(): void;
    socketNotificationReceived(notification: string, payload: unknown): void;
    sendSocketNotification(notification: string, payload: unknown): void;
    setName(name: string): void;
    setPath(path: string): void;
    setExpressApp(app: express.Application): void;
    setSocketIO(socketio: SocketIOServer): void;
}
export default Helper;

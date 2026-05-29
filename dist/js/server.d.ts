import http from "node:http";
import https from "node:https";
import net from "node:net";
import express from "express";
import { Server as SocketIOServer, Socket as SocketIOSocket } from "socket.io";
import ClientTracker from "./clientTracker.js";
import type { ServerConfig } from "../types/config.js";
declare class Server {
    app: express.Application;
    port: number | string;
    serverSockets: Set<net.Socket>;
    server: http.Server | https.Server | null;
    config: ServerConfig;
    clientMap: Map<string, SocketIOSocket>;
    trackedClients: ClientTracker[];
    io: SocketIOServer;
    constructor(config: ServerConfig);
    newHtml(confName: string): void;
    userServiceEndpoints(): void;
    loadTrackerFile(): void;
    trackerSetup(): void;
    open(): Promise<{
        app: express.Application;
        io: SocketIOServer;
    }>;
    close(): Promise<void>;
}
export default Server;

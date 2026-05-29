"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
class Helper {
    name;
    path;
    expressApp;
    socketio;
    constructor() {
        this.init();
    }
    init() {
        console.log(`Initializing new module helper`);
    }
    loaded() {
        console.log(`Helper loaded for module: ${this.name}`);
    }
    start() {
        console.log(`Starting helper: ${this.name}`);
        return Promise.resolve();
    }
    stop() {
        console.log(`Stopping helper: ${this.name}`);
    }
    socketNotificationReceived(notification, payload) {
        console.log(`${this.name} received a socket notification: ${notification} - Payload: ${payload}`);
    }
    sendSocketNotification(notification, payload) {
        this.socketio.of(this.name).emit(notification, payload);
    }
    setName(name) {
        this.name = name;
    }
    setPath(path) {
        this.path = path;
    }
    setExpressApp(app) {
        this.expressApp = app;
        this.expressApp.use(`/${this.name}`, express_1.default.static(`${this.path}/public`));
    }
    setSocketIO(socketio) {
        this.socketio = socketio;
        console.log(`Connecting socketio for: ${this.name}`);
        this.socketio.of(this.name).on("connection", (socket) => {
            // socket.onevent is an internal Socket.IO API used here to intercept
            // all events and re-emit them as "*" for catch-all handling in modules
            const s = socket;
            const onevent = s["onevent"];
            s["onevent"] = function (packet) {
                if (packet?.data) {
                    const args = packet.data;
                    onevent.call(this, packet);
                    packet.data = ["*"].concat(args);
                    onevent.call(this, packet);
                }
            };
            socket
                .on("*", (...args) => {
                const [notification, payload = {}] = args;
                if (notification !== "*") {
                    this.socketNotificationReceived(notification, payload);
                }
            });
        });
    }
}
exports.default = Helper;

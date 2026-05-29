"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
const node_path_1 = __importDefault(require("node:path"));
const express_1 = __importDefault(require("express"));
const socket_io_1 = require("socket.io");
const clientTracker_js_1 = __importDefault(require("./clientTracker.js"));
class Server {
    app;
    port;
    serverSockets;
    server;
    config;
    clientMap;
    trackedClients;
    io;
    constructor(config) {
        this.app = (0, express_1.default)();
        this.port = config.port || 8080;
        this.serverSockets = new Set();
        this.server = null;
        this.config = config;
        this.clientMap = new Map();
        this.trackedClients = [];
    }
    newHtml(confName) {
        const mirrorName = confName + ".js";
        node_fs_1.default.readFile(node_path_1.default.resolve("./index.html"), "utf8", (err, data) => {
            if (err) {
                console.log(err.message);
                return;
            }
            const newFile = data.replace("#CLIENTCONFIG#", mirrorName);
            node_fs_1.default.writeFile("./configs/" + confName + "/index.html", newFile, "utf8", (writeErr) => {
                if (writeErr)
                    console.log(writeErr.message);
            });
        });
    }
    userServiceEndpoints() {
        this.app.post("/get-user/:userName", (req, res) => {
            const userName = req.params.userName;
            const fileName = `${userName}.json`;
            let clientName = "";
            req.on("data", (chunk) => {
                clientName += chunk.toString();
            });
            req.on("end", () => {
                let filePath = node_path_1.default.join(node_path_1.default.resolve(__dirname, "../.."), "/configs", "/" + clientName, "/users", "/" + fileName);
                if (!node_fs_1.default.existsSync(filePath)) {
                    filePath = node_path_1.default.join(node_path_1.default.resolve(__dirname, "../.."), "/configs", "/users", "/" + fileName);
                    if (!node_fs_1.default.existsSync(filePath)) {
                        res.status(404).json({ error: "User config not found" });
                        return;
                    }
                }
                const userConfig = JSON.parse(node_fs_1.default.readFileSync(filePath, "utf8"));
                res.json(userConfig);
            });
        });
    }
    loadTrackerFile() {
        try {
            const data = node_fs_1.default.readFileSync("./workData/cTracker.json", "utf8");
            const tracked = JSON.parse(data);
            this.trackedClients = tracked.map((obj) => clientTracker_js_1.default.fromObject(obj));
            console.log("Client tracker data loaded.");
        }
        catch (error) {
            console.error("Error loading cTracker.json:", error.message);
            this.trackedClients = [];
        }
    }
    trackerSetup() {
        this.io.on("connection", (socket) => {
            const rawClientName = socket.handshake.query.clientName;
            const clientName = Array.isArray(rawClientName) ? rawClientName[0] : (rawClientName ?? "");
            const clientIp = socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
            this.clientMap.set(clientName, socket);
            let beats = 0;
            const client = this.trackedClients.find((c) => c.name === clientName);
            if (!client) {
                console.error(`Unknown client connected: ${clientName}`);
                socket.disconnect();
                return;
            }
            client.lastOnline = new Date();
            client.connectedAt = new Date();
            client.status = "online";
            if (!client.connections.find((c) => c.ip === clientIp)) {
                client.connections.push({ ip: clientIp, connectedAt: client.connectedAt });
            }
            node_fs_1.default.writeFileSync("./workData/cTracker.json", JSON.stringify(this.trackedClients, null, 2), "utf8");
            let missedHeartbeats = 0;
            const checkHeartbeat = () => {
                if (client.status === "online") {
                    missedHeartbeats += 1;
                    if (missedHeartbeats >= 4) {
                        console.log(`Client ${client.name} is unresponsive. Disconnecting...`);
                        socket.disconnect();
                        return;
                    }
                    setTimeout(checkHeartbeat, 10000);
                }
            };
            const heartbeatTimer = setTimeout(checkHeartbeat, 10000);
            socket.on("heartbeat", () => {
                client.lastOnline = new Date();
                console.log(`Heartbeat received from ${client.name}`);
                missedHeartbeats = 0;
                beats += 1;
                if (beats === 3) {
                    node_fs_1.default.writeFileSync("./workData/cTracker.json", JSON.stringify(this.trackedClients, null, 2), "utf8");
                    beats = 0;
                }
            });
            socket.on("retrieveTrackers", () => {
                if (client.name === "root") {
                    console.log("Root requested client tracker data");
                    socket.emit("trackersData", this.trackedClients);
                }
            });
            socket.on("HIDE_MODULE_X", (payload) => {
                console.log(payload);
                this.clientMap.get(payload.client)?.emit("HIDE_MODULE_Y", payload);
            });
            socket.on("SHOW_MODULE_X", (payload) => {
                console.log(payload);
                this.clientMap.get(payload.client)?.emit("SHOW_MODULE_Y", payload);
            });
            socket.on("SUSPEND_MODULE_X", (payload) => {
                console.log(payload);
                this.clientMap.get(payload.client)?.emit("SUSPEND_MODULE_Y", payload);
            });
            socket.on("RESUME_MODULE_X", (payload) => {
                console.log(payload);
                this.clientMap.get(payload.client)?.emit("RESUME_MODULE_Y", payload);
            });
            socket.on("CHANGE_USER_X", (payload) => {
                console.log(payload);
                const editClient = this.trackedClients.find((c) => c.name === payload.client);
                if (editClient)
                    editClient.user = payload.user;
                this.clientMap.get(payload.client)?.emit("CHANGE_USER_Y", payload);
            });
            socket.on("disconnect", () => {
                console.log(`Client disconnected from server: ${client.name}`);
                const index = client.connections.findIndex((conn) => conn.ip === clientIp);
                if (index !== -1) {
                    client.connections.splice(index, 1);
                }
                if (client.connections.length === 0) {
                    client.status = "offline";
                    this.clientMap.delete(client.name);
                }
                client.user = "default";
                node_fs_1.default.writeFileSync("./workData/cTracker.json", JSON.stringify(this.trackedClients, null, 2), "utf8");
                clearTimeout(heartbeatTimer);
            });
        });
    }
    open() {
        return new Promise((resolve) => {
            console.log("Starting express server");
            if (this.config.https) {
                const options = {
                    key: node_fs_1.default.readFileSync(this.config.httpsPrivateKey),
                    cert: node_fs_1.default.readFileSync(this.config.httpsCertificate)
                };
                this.server = node_https_1.default.createServer(options, this.app);
            }
            else {
                this.server = node_http_1.default.createServer(this.app);
            }
            this.io = new socket_io_1.Server(this.server, {
                cors: { origin: /.*$/, credentials: true }
            });
            this.loadTrackerFile();
            this.trackerSetup();
            this.server.on("connection", (socket) => {
                this.serverSockets.add(socket);
                socket.on("close", () => this.serverSockets.delete(socket));
            });
            this.server.listen(Number(this.port), this.config.address || "0.0.0.0");
            for (const conf of this.config.clientConfigs) {
                const confBase = node_path_1.default.resolve("./configs") + "/" + conf;
                if (node_fs_1.default.existsSync(confBase + "/" + conf + ".js")) {
                    if (!node_fs_1.default.existsSync(confBase + "/index.html"))
                        this.newHtml(conf);
                    this.app.use("/" + conf, express_1.default.static(node_path_1.default.resolve("./configs/" + conf)));
                }
            }
            const rootBase = node_path_1.default.resolve("./configs") + "/" + this.config.rootConf;
            if (node_fs_1.default.existsSync(rootBase + "/" + this.config.rootConf + ".js")) {
                if (!node_fs_1.default.existsSync(rootBase + "/index.html"))
                    this.newHtml(this.config.rootConf);
                this.app.use("/", express_1.default.static(node_path_1.default.resolve("./configs/" + this.config.rootConf)));
            }
            this.app.use("/configs", express_1.default.static("./configs"));
            this.app.use("/modules", express_1.default.static("./modules"));
            this.app.use("/css", express_1.default.static("./css"));
            this.app.use("/js", express_1.default.static("./js"));
            this.userServiceEndpoints();
            this.server.on("listening", () => resolve({ app: this.app, io: this.io }));
        });
    }
    close() {
        return new Promise((resolve) => {
            for (const socket of this.serverSockets.values())
                socket.destroy();
            this.server.close(() => resolve());
        });
    }
}
exports.default = Server;

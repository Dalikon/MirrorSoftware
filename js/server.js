
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const express = require("express");
const ipfilter = require("express-ipfilter").IpFilter;
const helmet = require("helmet");
const socketio = require("socket.io");

const clientTracker = require("./clientTracker");

/**
 * Class representing a server that serves all files necessery to run a mirror client
 */
class Server {
    constructor(config) {
        this.app = express();
        this.port = config.port || 8080;
        this.serverSockets = new Set();
        this.server = null;
        this.config = config;
        this.clientMap = new Map();
        this.trackedClients = [];
    }

    /**
     * Creates new html file for a client if the defined folder does not have one
     * @param {string} - confName name of the configuration to place into the html tamplate (it is the client name)
     */
    newHtml(confName) {
        let mirrorName = confName + ".js"
        fs.readFile(path.resolve("./index.html"), 'utf8', (err, data) => {
            if (err) {
                console.log(err.message)
            }

            const newFile = data.replace("#CLIENTCONFIG#", mirrorName)
            console.log("./configs/" + confName + "/index.html")
            fs.writeFile("./configs/" + confName + "/index.html", newFile, 'utf8', (err) => {if (err) console.log(err.message)})
        });
    }

    userServiceEndpoints() {
        this.app.post("/get-user/:userName", (req, res) => {
            const userName = req.params.userName;
            const fileName = `${userName}.json`;
            let clientName = '';

            req.on('data', chunk => {
                clientName += chunk.toString();
            });

            req.on('end', () => {
                let filePath = path.join(__dirname.slice(0, -3), "/configs", "/" + clientName, "/users", "/" + fileName);
                if (!fs.existsSync(filePath)) {
                    filePath = path.join(__dirname.slice(0, -3), "/configs", "/users", "/" + fileName);
                    if (!fs.existsSync(filePath)) {
                        res.status(404).json({error: 'User config not found'});
                    }
                }

                let userConfig = fs.readFileSync(filePath);
                userConfig = JSON.parse(userConfig);
                res.json(userConfig);
            });
        });
    }

    loadTrackerFile() {
        try {
            const data = fs.readFileSync('./workData/cTracker.json', "utf8");
            let tracked = JSON.parse(data);
            this.trackedClients = tracked.map(clientTracker.fromObject);
            console.log("Client tracker data loaded.");
        } catch (error) {
            console.error("Error loading cTracker.json:", error.message);
            this.trackedClients = []
        }
    }

    trackerSetup() {
        this.io.on("connection", (socket) => {
            console.log(`Client connected: ${socket.handshake.query.clientName}`);


            const clientName = socket.handshake.query.clientName;
            const clientIp = socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
            this.clientMap.set(clientName, socket)
            let beats = 0;

            let client = this.trackedClients.find((c) => c.name === clientName);

            client.lastOnline = new Date();
            client.connectedAt = new Date();
            client.status = "online";
            if (client.connections.find((c) => c.ip === clientIp) == null) {
                client.connections.push({
                    "ip": clientIp,
                    "connectedAt": client.connectedAt
                });
            }

            fs.writeFileSync('./workData/cTracker.json', JSON.stringify(this.trackedClients, null, 2), "utf8");

            let missedHeartbeats = 0;

            const checkHeartbeat = () => {
                if (client.status === "online") {
                    missedHeartbeats += 1;
                    if (missedHeartbeats >= 4) {
                        console.log(`Client ${client.name} is unresponsive. Disconnecting...`);
                        socket.disconnect(); // Disconnect the client
                        return;
                    }
                    setTimeout(checkHeartbeat, 10000);
                }
            };

            let heartbeatTimer = setTimeout(checkHeartbeat, 10000);

            socket.on("heartbeat", () => {
                client.lastOnline = new Date();
                console.log(`Heartbeat received from ${client.name}`);
                missedHeartbeats = 0;
                beats += 1;
                if (beats === 3) {
                    fs.writeFileSync('./workData/cTracker.json', JSON.stringify(this.trackedClients, null, 2), "utf8");
                    beats = 0;
                }
            });

            socket.on("retrieveTrackers", () => {
                if (client.name == "root") {
                    console.log("Root requested client tracker data");
                    socket.emit("trackersData", this.trackedClients)
                }
            });

            socket.on("HIDE_MODULE_X", (payload) => {
                console.log(payload);
                this.clientMap.get(payload.client).emit("HIDE_MODULE_Y", payload);

            });

            socket.on("SHOW_MODULE_X", (payload) => {
                console.log(payload)
                this.clientMap.get(payload.client).emit("SHOW_MODULE_Y", payload);
            });

            socket.on("SUSPEND_MODULE_X", (payload) => {
                console.log(payload)
                this.clientMap.get(payload.client).emit("SUSPEND_MODULE_Y", payload);
            });

            socket.on("RESUME_MODULE_X", (payload) => {
                console.log(payload)
                this.clientMap.get(payload.client).emit("RESUME_MODULE_Y", payload);
            });

            socket.on("CHANGE_USER_X", (payload) => {
                console.log(payload);
                let editClient = this.trackedClients.find((c) => c.name === payload.client);
                editClient.user = payload.user;
                this.clientMap.get(payload.client).emit("CHANGE_USER_Y", payload);
            });

            socket.on("disconnect", () => {
                console.log(`Client disconnected from server: ${client.name}`);
                const index = client.connections.findIndex(connection => connection.ip === clientIp);

                if (index !== -1) {
                    client.connections.splice(index, 1); // Remove the object at the found index
                }

                if (client.connections.length == 0) {
                    client.status = "offline"
                    this.clientMap.delete(client.name)
                }

                client.user = "default";

                fs.writeFileSync('./workData/cTracker.json', JSON.stringify(this.trackedClients, null, 2), "utf8");

                clearTimeout(heartbeatTimer);
            });
        });
    }

    /**
     * Main server method. It creates express and socketio objects
     * @returns {Promise} - Promise that resolves into an object of the express app object and socket io object
     */
    open() {
        return new Promise((resolve) => {
            console.log("Starting express server")
            if (this.config.https) {
                const options = {
                    key: fs.readFileSync(config.httpsPrivateKey),
                    cert: fs.readFileSync(config.httpsCertificate)
                };
                this.server = https.Server(options, this.app);
            } else {
                this.server = http.Server(this.app);
            }

            this.io = socketio(this.server, {
                cors: {
                    origin: /.*$/,
                    credentials: true
                },
            });

            /*
                * Load client tracker file
            */
            this.loadTrackerFile();

            this.trackerSetup();

            this.server.on("connection", (socket) => {
                this.serverSockets.add(socket);
                socket.on("close", () => {
                    this.serverSockets.delete(socket);
                });
            });

            this.server.listen(this.port, this.config.address || "0.0.0.0");

            //for every defined client, create html file and an endpoint
            for (const conf of this.config.clientConfigs) {
                if (fs.existsSync(path.resolve("./configs") + "/" + conf + "/" + conf + ".js")) {
                    if (!fs.existsSync(path.resolve("./configs") + "/" + conf + "/index.html")) {
                        this.newHtml(conf);
                    }
                    this.app.use("/" + conf, express.static(path.resolve("./configs/" + conf)));
                }
            }

            //if js file for root client exists, create a html file for it and host it
            if (fs.existsSync(path.resolve("./configs") + "/" + this.config.rootConf + "/" + this.config.rootConf + ".js")) {
                if (!fs.existsSync(path.resolve("./configs") + "/" + this.config.rootConf + "/index.html")) {
                    this.newHtml(this.config.rootConf);
                }
                this.app.use("/", express.static(path.resolve("./configs/" + this.config.rootConf)));
            }

            this.app.use("/configs", express.static("./configs"));
            this.app.use("/modules", express.static("./modules"));
            this.app.use("/css", express.static("./css"));
            this.app.use("/js", express.static("./js"));

            //TODO Create a default page (maybe basic controlls and stats?)
            //            this.app.get("/", (req, res) => {
            //              let html = fs.readFileSync(path.resolve('./index.html'), { encoding: "utf8" });
            //            res.send(html);
            //      });

            this.userServiceEndpoints();

            this.server.on("listening", () => {
                resolve({
                    app: this.app,
                    io: this.io
                });
            });
        });
    }

    /**
     * When terminating the program
     */
    close() {
        return new Promise((resolve) => {
            for (const socket of this.serverSockets.values()) {
                socket.destroy();
            }
            this.server.close(resolve);
        })
    }
}

module.exports = Server;

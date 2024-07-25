
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const express = require("express");
const ipfilter = require("express-ipfilter").IpFilter;
const helmet = require("helmet");
const socketio = require("socket.io");

class Server {
    constructor (config) {
        this.app = express();
        this.port = config.port || 8080;
        this.serverSockets = new Set();
        this.server = null;
        this.config = config
    }

    newHtml (confName) {
        fs.readFile(path.resolve("./index.html"), 'utf8', (err, data) => {
            if (err) {
                console.log(err.message)
            }

            const newFile = data.replace("#CLIENTCONFIG#", confName)
            console.log("./configs/" + confName.slice(0,-3) + "/index.html")
            fs.writeFile("./configs/" + confName.slice(0,-3) + "/index.html", newFile, 'utf8', (err) => {if(err) console.log(err.message)})
        });
    }

    open () {
        return new Promise((resolve) => {
            if (this.config.https) {
                const options = {
                    key: fs.readFileSync(config.httpsPrivateKey),
                    cert: fs.readFileSync(config.httpsCertificate)
                };
                this.server = https.Server(options, this.app);
            } else {
                this.server = http.Server(this.app);
            }

            /*
             * move to backend
            const io = socketio(server, {
                cors: {
                    origin: /.*$/,
                    credentials: true
                },
                allowEIO3: true
            })
            */

            this.server.on("connection", (socket) => {
                this.serverSockets.add(socket);
                socket.on("close", () => {
                    this.serverSockets.delete(socket);
                });
            });

            this.server.listen(this.port, this.config.address || "localhost");

            for (const conf of this.config.clientConfigs) {
                let confName = conf.slice(0, -3);
                if (fs.existsSync(path.resolve("./configs") + "/" + confName + "/" + conf)){
                    if (!fs.existsSync(path.resolve("./configs") + "/" + confName + "/index.html")) {
                        this.newHtml(conf);
                    }
                    this.app.use("/" + confName, express.static(path.resolve("./configs/" + confName)));
                }
            }

            this.app.use("/modules", express.static("./modules"));
            this.app.use("/css", express.static("./css"));
            this.app.use("/js", express.static("./js"));

            this.app.get("/", (req, res) => {
                let html = fs.readFileSync(path.resolve('./index.html'), { encoding: "utf8" });
                res.send(html);
            });

            this.server.on("listening", () => {
                resolve({
                    testik: "its running"
                });
            });
        });
    }

    close () {
        return new Promise((resolve) => {
            for (const socket of this.serverSockets.values()) {
                socket.destroy();
            }
            this.server.close(resolve);
        })
    }
}

module.exports = Server;


const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const express = require("express");
const ipfilter = require("express-ipfilter").IpFilter;
const helmet = require("helmet");
const socketio = require("socket.io");

/*
 * Class representing a server that serves all files necessery to run a mirror client
 */
class Server {
    constructor (config) {
        this.app = express();
        this.port = config.port || 8080;
        this.serverSockets = new Set();
        this.server = null;
        this.config = config
    }

    /*
     * Creates new html file for a client if the defined folder does not have one
     * @param {string} confName name of the configuration to place into the html tamplate (it is the client name)
     */
    newHtml (confName) {
        let mirrorName = confName + ".js"
        fs.readFile(path.resolve("./index.html"), 'utf8', (err, data) => {
            if (err) {
                console.log(err.message)
            }

            const newFile = data.replace("#CLIENTCONFIG#", mirrorName)
            console.log("./configs/" + confName + "/index.html")
            fs.writeFile("./configs/" + confName + "/index.html", newFile, 'utf8', (err) => {if(err) console.log(err.message)})
        });
    }

    /*
     * Main server method. It creates express and socketio objects
     * @returns {Promise} Promise that resolves into an object of the express app object and socket io object
     */
    open () {
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

            this.server.on("connection", (socket) => {
                this.serverSockets.add(socket);
                socket.on("close", () => {
                    this.serverSockets.delete(socket);
                });
            });

            this.server.listen(this.port, this.config.address || "localhost");

            //for every defined client, create html file and an endpoint
            for (const conf of this.config.clientConfigs) {
                if (fs.existsSync(path.resolve("./configs") + "/" + conf + "/" + conf + ".js")){
                    if (!fs.existsSync(path.resolve("./configs") + "/" + conf + "/index.html")) {
                        this.newHtml(conf);
                    }
                    this.app.use("/" + conf, express.static(path.resolve("./configs/" + conf)));
                }
            }

            this.app.use("/configs", express.static("./configs"));
            this.app.use("/modules", express.static("./modules"));
            this.app.use("/css", express.static("./css"));
            this.app.use("/js", express.static("./js"));

            //TODO Create a default page (maybe basic controlls and stats?)
            this.app.get("/", (req, res) => {
                let html = fs.readFileSync(path.resolve('./index.html'), { encoding: "utf8" });
                res.send(html);
            });

            this.server.on("listening", () => {
                resolve({
                    app: this.app,
                    io: this.io
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

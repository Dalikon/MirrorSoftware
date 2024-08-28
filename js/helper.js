const express = require("express");

class Helper {
    constructor () {
        this.init();
    }

    init () {
        console.log(`Initializing new module helper`);
    }

    loaded () {
        console.log(`Helper loaded for module: ${this.name}`);
    }

    start () {
        console.log(`Starting helper: ${this.name}`);
    }

    stop () {
        console.log(`Stopping helper: ${this.name}`);
    }

    socketNotificationReceived (notification, payload) {
        console.log(`${this.name} received a socket notification: ${notification} - Payload: ${payload}`);
    }

    sendSocketNotification (notification, payload) {
        this.socketio.of(this.name).emit(notification, payload);
    }

    setName (name) {
        this.name = name;
    }

    setPath (path) {
        this.path = path;
    }

    setExpressApp (app) {
        this.expressApp = app

        this.expressApp.use(`/${this.name}`, express.static(`${this.path}/public`));
    }

    setSocketIO (socketio) {
        this.socketio = socketio;

        console.log(`Connecting socketio for: ${this.name}`);

        this.socketio.of(this.name).on("connection", (socket) => {
            const onevent = socket.onevent;
            socket.onevent = function (packet) {
                console.log("DEBUG: Received packet: ", packet.data);
                if (packet && packet.data){
                    const args = packet.data || [];
                    onevent.call(this, packet);
                    packet.data = ["*"].concat(args);
                    onevent.call(this, packet);
                }
            };

            socket.on("*", (notification, payload = {}) => {
                if (notification !== "*") {
                    //if (notification === "CLIENT_CONNECTED")
                    this.socketNotificationReceived(notification, payload);
                }
            });
        });
    }
}

module.exports = Helper;

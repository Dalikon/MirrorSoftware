
const fs = require("node:fs");
const path = require("node:path");
const envsub = require("envsub");
const express = require("express");
const socket = require("socket.io");

const Server = require('./server');



class Core {
    constructor () {
        this.defaults = require('./defaultMasterConfig')
        this.config = this.defaults
    }

    async start () {
        let httpServer = new Server(this.config);
        await httpServer.open();
    }

}

let core = new Core().start()



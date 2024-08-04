
const fs = require("node:fs");
const path = require("node:path");
const envsub = require("envsub");
const express = require("express");
const socket = require("socket.io");

const Server = require('./server');

//make array of all mirrors and their modules
//check for module files
    //if no main file, remove it from config
    //if helper exists, start it

/*
 * The main program class.
 * It manages the server, backed to modules, and connection to the rest of mirror system.
 */
class Core {
    constructor () {
        this.defaults = require('./defaultMasterConfig')
        this.config = this.defaults
        this.rootDir = __dirname.slice(0,-3);
    }

    /*
     * Creates an array of objects representing an user for a conctrete client
     * userData property of said object is the whole config of a specific user
     */
    getUsersPerClient (client) {
        let users = [];
        let folder = `${this.rootDir}/configs/${client}/users`;
        let files = fs.readdirSync(folder, { withFileTypes: true })

        for (const file of files) {
            let filePath = path.join(folder, file.name);
            if (file.isFile() && path.extname(file.name) === '.json') {
                let data = fs.readFileSync(filePath, 'utf8');
                let userData = JSON.parse(data);
                users.push({path: filePath, data: userData});
            }
        }
        return users;
    }

    /*
     * Creates an object that holds all modules defined in configs devided by the clients
     * next by default modules for the client and then by users for specific client
     */
    createModuleArray () {
        let modulesInMirrors = {};
        for (let client of this.config.clientConfigs) {
            let jsonData;
            try {
                const data = fs.readFileSync(path.resolve(`./configs/${client}/${client}.json`), 'utf8');
                jsonData = JSON.parse(data);
            } catch (parseErr) {
                console.error(`Error parsing ${client} module config `, parseErr);
            }

            modulesInMirrors[client] = {};
            modulesInMirrors[client]['defaultModules'] = jsonData.defaultModules;

            modulesInMirrors[client]['usersSpecific'] = this.getUsersPerClient(client);

            return modulesInMirrors;
        }
    }

    /*
     * Goes through all modules defined in all client and user configs
     * and creates an array of all unique modules defined in them
     */
    differentModules () {
        let diffs = []
        for (let client in this.allClients) {
            console.log(this.allClients[client].defaultModules);
            for (let module of this.allClients[client].defaultModules) {
                if (!diffs.includes(module.module)) {
                    diffs.push(module.module);
                }
            }

            console.log("============");
            for (let user of this.allClients[client].usersSpecific) {
                //console.log(user.data);
                for (let userModule of user.data.modules) {
                    if (!diffs.includes(userModule.module)) {
                        diffs.push(userModule.module)
                    }
                }
            }
        }


        console.log("======================");
        console.log(diffs);

        return diffs;
    }

    /*
     * Loads all modules and starts needed helpers
     */
    loadModules () {
        //createModuleArray
        //check for module directory, core module file, helper

        this.allClients = this.createModuleArray();
        this.diffModules = this.differentModules();

        //start the helper if there is any
    }

    /*
     *
     */
    checkMirrorConfigs () {
        let clients = this.config.clientConfigs;
        for (let client of clients) {
            let folder = `./configs/${client}/`;
            if (!fs.existsSync(path.resolve(folder))) {
                console.error("No folder for defined client in config!")
                let index = this.config.clientConfigs.indexOf(client);
                this.config.clientConfigs.splice(index,1);
            }

            if (!fs.existsSync(path.resolve(folder) + `${client}.js`)){
                let mirrorConf = client + ".js"
                fs.copyFileSync(path.resolve('./js/mirror.js'), path.resolve(`./configs/${client}/${mirrorConf}`))
            }
        }
    }

    /*
     * Main method to kick off the whole system
     */
    async start () {
        //check mirrors config structure
            //folder exists
            //mirror.js exists (else create it, it is all the same file just renamed)
        this.checkMirrorConfigs();
        //load modules
        this.loadModules();
        let httpServer = new Server(this.config);
        await httpServer.open();
    }

}

let core = new Core().start()



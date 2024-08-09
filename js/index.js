
const fs = require("node:fs");
const path = require("node:path");
const envsub = require("envsub");
const express = require("express");
const socket = require("socket.io");

const Server = require('./server');
const Helper = require('./helper');

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
        this.moduleHelpers = [];
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
     * and creates an array of all unique modules NAMES defined in them
     */
    differentModules () {
        let diffs = []
        for (let client in this.allClients) {
           // console.log(this.allClients[client].defaultModules);
            for (let module of this.allClients[client].defaultModules) {
                if (!diffs.includes(module.module)) {
                    diffs.push(module.module);
                }
            }

            for (let user of this.allClients[client].usersSpecific) {
                for (let userModule of user.data.modules) {
                    if (!diffs.includes(userModule.module)) {
                        diffs.push(userModule.module)
                    }
                }
            }
        }


       // console.log("======================");
        //console.log(diffs);

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
        for (module of this.diffModules) {
            let moduleFile = `${this.rootDir}/modules/${module}/${module}.js`
            try {
                fs.accessSync(moduleFile, fs.R_OK);
            } catch (e) {
                console.log(`No ${moduleFile} found for module ${module}.`)
            }

            let helperPath = `${this.rootDir}/modules/${module}/helper.js`;
            let helperExists = true;
            try {
                fs.accessSync(helperPath, fs.R_OK);
            } catch (e) {
                helperExists = false;
                console.log(`No helper found for module ${module}`);
            }

            if (helperExists) {
                const Helper = require(helperPath.slice(0,-3));
                let helper = new Helper();

                helper.setName(module);
                helper.setPath(path.resolve(`${this.rootDir}/modules/${module}`))
                this.moduleHelpers.push(helper);

                helper.loaded();
            }
        }
    }

    /*
     * Checks master and client configs and automaticaly prepare for usage
     */
    checkMirrorConfigs () {
        //check the master config

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

        this.httpServer = new Server(this.config);

        const apps = await this.httpServer.open();
        this.expressApp = apps.app;
        this.socketio = apps.io;

        const helperPromises = [];
        for (let moduleHelper of this.moduleHelpers) {
            moduleHelper.setExpressApp(this.expressApp);
            moduleHelper.setSocketIO(this.socketio);

            try {
                helperPromises.push(moduleHelper.start());
            } catch (error) {
                console.error(`Error when starting helper for module ${moduleHelper.name}: ${error}`);
            }
        }

        const results = await Promise.allSettled(helperPromises);

        results.forEach((result) => {
            if (result.status === "rejected") {
                console.log(result.reason);
            }
        });
    }

}

let core = new Core().start()



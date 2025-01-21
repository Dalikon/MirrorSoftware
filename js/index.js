const fs = require("node:fs");
const path = require("node:path");
const envsub = require("envsub");
const lodash = require('lodash');

const Server = require('./server');

/**
 * The main program class.
 * It manages the server, backed to modules, and connection to the rest of mirror system.
 */
class Core {
    constructor() {
        //root dir of the project
        this.rootDir = __dirname.slice(0, -3);

        this.defaults = JSON.parse(fs.readFileSync(this.rootDir + "/configs/server/defaultServerConfig.json"));

        this.config = fs.readFileSync(this.rootDir + "/configs/server/serverConfig.json", 'utf8');

        if (this.config) {
            this.config = lodash.merge({rootDir: this.rootDir}, this.defaults, JSON.parse(this.config));
        } else {
            console.warn("Warning: No custom server config found");
            this.config = lodash.merge({rootDir: this.rootDir}, this.defaults);
        }

        //objects of the helpers aka backends for modules
        this.moduleHelpers = [];
    }

    /**
     * Creates an array of objects representing an user for a conctrete client
     * userData property of said object is the whole config of a specific user
     * @param {string} - client name of the client mirror for which to gether users for.
     * @returns {array} - array of objects of users, first property is the path for the client specific user conf and second is the conf data itself
     */
    getUsersPerClient(client, users) {
        let folder = `${this.rootDir}/configs/${client}/users`;
        let userObjs = []

        for (const user of users) {
            let filePath = path.join(folder, user + ".json");
            if (1) {
                let data = fs.readFileSync(filePath, 'utf8');
                let userData = JSON.parse(data);
                userObjs.push({path: filePath, data: userData});
            }
        }

        return userObjs;
    }

    /**
     * Creates an object that holds all modules defined in configs devided by the clients
     * next by default modules for the client and then by users for specific client
     * @returns {Object} - top level attributes are the client names, second level is an array of default client modules and users. The last level are user specific modules under every user.
     */
    createModuleArray() {
        console.log("Searching for modules")
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

            modulesInMirrors[client]['usersSpecific'] = this.getUsersPerClient(client, jsonData.users);

            return modulesInMirrors;
        }
    }

    /**
     * Goes through all modules defined in all client and user configs
     * and creates an array of all unique modules NAMES defined in them
     * @returns {array} - An array of all modules, that are defined in all configs across all clients and users and which are unique
     */
    differentModules() {
        console.log("Finding all unique modules")
        let diffs = [];
        for (let client in this.allClients) {
            for (let module of this.allClients[client].defaultModules) {
                if (!diffs.includes(module.module)) {
                    diffs.push(module.module);
                }
            }

            //TODO Do not diff every user by default.
            //
            for (let user of this.allClients[client].usersSpecific) {
                for (let userModule of user.data.modules) {
                    if (!diffs.includes(userModule.module)) {
                        diffs.push(userModule.module)
                    }
                }
            }
        }
        return diffs;
    }

    /**
     * Loads all modules and starts needed helpers
     */
    loadModules() {
        console.log("Loading modules")
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
                console.log(`Starting helper for module: ${module}`)
                const Helper = require(helperPath.slice(0, -3));
                let helper = new Helper();

                helper.setName(module);
                helper.setPath(path.resolve(`${this.rootDir}/modules/${module}`))
                this.moduleHelpers.push(helper);

                helper.loaded();
            }
        }
    }

    /**
     * Checks master and client configs and automaticaly prepare for usage
     */
    checkMirrorConfigs() {
        console.log("Checking if configs are correct");
        //TODO check the master config

        //check for client tracker file
        let trackerFileExists = true;
        let clientTrackers = []
        if (!fs.existsSync(path.resolve(`./workData/cTracker.json`))) trackerFileExists = false;

        let rootConfig = this.config.rootConf;
        let clients = this.config.clientConfigs;
        for (let client of clients) {
            let folder = `./configs/${client}/`;
            if (!fs.existsSync(path.resolve(folder))) {
                //remove the user from confing object and go as usual (no harm done)
                console.error("No folder for defined client in config!");
                let index = this.config.clientConfigs.indexOf(client);
                this.config.clientConfigs.splice(index, 1);
            }

            if (!fs.existsSync(path.resolve(folder) + `/${client}.js`)) {
                console.log(`Creating .js file for client: ${client}`);
                //this file is the same for all clients, it just loads the client json file dependant on the name
                //thats why it is ok to just copy it there
                let mirrorConf = client + ".js"
                fs.copyFileSync(path.resolve('./js/mirror.js'), path.resolve(`./configs/${client}/${mirrorConf}`))
            }

            if (!trackerFileExists) {
                let tracker = new clientTracker(client, type = "mirror");
                clientTrackers.push(tracker);
            }
        }

        if (!trackerFileExists) {
            try {
                fs.writeFileSync('./workData/cTracker.json', JSON.stringify(clientTrackers, null, 2), "utf8");
                console.log("Client tracker data saved.");
            } catch (error) {
                console.error("Error saving cTracker.json:", error.message);
            }
        }

        let rootConfFolder = `./configs/${rootConfig}/`
        if (fs.existsSync(path.resolve(rootConfFolder))) {
            if (!fs.existsSync(path.resolve(rootConfFolder) + `/${rootConfig}.js`)) {
                console.log(`Creating .js file for client: ${rootConfig}`);
                //this file is the same for all clients, it just loads the client json file dependant on the name
                //thats why it is ok to just copy it there
                let mirrorConf = rootConfig + ".js"
                fs.copyFileSync(path.resolve('./js/mirror.js'), path.resolve(`./configs/${rootConfig}/${mirrorConf}`))
            }
        }
    }


    /**
     * Main method to kick off the whole system
     */
    async start() {
        this.checkMirrorConfigs();

        this.loadModules();

        //create the server aka express app and socketio and set the basic endpoints
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

            const results = await Promise.allSettled(helperPromises);

            results.forEach((result) => {
                if (result.status === "rejected") {
                    console.log(result.reason);
                }
            });
            console.log("All helpers started");
        }

    }

let core = new Core().start();

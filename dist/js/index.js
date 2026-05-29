"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const lodash_1 = require("lodash");
const server_js_1 = __importDefault(require("./server.js"));
const clientTracker_js_1 = __importDefault(require("./clientTracker.js"));
class Core {
    rootDir;
    config;
    moduleHelpers;
    allClients;
    diffModules;
    httpServer;
    expressApp;
    socketio;
    constructor() {
        this.rootDir = node_path_1.default.resolve(__dirname, "../..");
        const defaults = JSON.parse(node_fs_1.default.readFileSync(this.rootDir + "/configs/server/defaultServerConfig.json", "utf8"));
        const rawConfig = node_fs_1.default.readFileSync(this.rootDir + "/configs/server/serverConfig.json", "utf8");
        if (rawConfig) {
            this.config = (0, lodash_1.merge)({ rootDir: this.rootDir }, defaults, JSON.parse(rawConfig));
        }
        else {
            console.warn("Warning: No custom server config found");
            this.config = (0, lodash_1.merge)({ rootDir: this.rootDir }, defaults);
        }
        this.moduleHelpers = [];
    }
    getUsersPerClient(client, users) {
        const folder = `${this.rootDir}/configs/${client}/users`;
        return users.map((user) => {
            const filePath = node_path_1.default.join(folder, user + ".json");
            const data = node_fs_1.default.readFileSync(filePath, "utf8");
            return { path: filePath, data: JSON.parse(data) };
        });
    }
    createModuleArray() {
        console.log("Searching for modules");
        const modulesInMirrors = {};
        for (const client of this.config.clientConfigs) {
            let jsonData;
            try {
                const data = node_fs_1.default.readFileSync(node_path_1.default.resolve(`./configs/${client}/${client}.json`), "utf8");
                jsonData = JSON.parse(data);
            }
            catch (parseErr) {
                console.error(`Error parsing ${client} module config`, parseErr);
                continue;
            }
            modulesInMirrors[client] = {
                defaultModules: jsonData.defaultModules,
                usersSpecific: this.getUsersPerClient(client, jsonData.users),
            };
        }
        return modulesInMirrors;
    }
    differentModules() {
        console.log("Finding all unique modules");
        const diffs = [];
        for (const client in this.allClients) {
            for (const mod of this.allClients[client].defaultModules) {
                if (!diffs.includes(mod.module))
                    diffs.push(mod.module);
            }
            for (const user of this.allClients[client].usersSpecific) {
                for (const userMod of user.data.modules) {
                    if (!diffs.includes(userMod.module))
                        diffs.push(userMod.module);
                }
            }
        }
        return diffs;
    }
    loadModules() {
        console.log("Loading modules");
        this.allClients = this.createModuleArray();
        this.diffModules = this.differentModules();
        for (const moduleName of this.diffModules) {
            const moduleFile = this.config.providedModules.includes(moduleName)
                ? `${this.rootDir}/modules/default/${moduleName}/${moduleName}.js`
                : `${this.rootDir}/modules/${moduleName}/${moduleName}.js`;
            try {
                node_fs_1.default.accessSync(moduleFile, node_fs_1.default.constants.R_OK);
            }
            catch {
                console.log(`No ${moduleFile} found for module ${moduleName}.`);
            }
            const helperPath = `${this.rootDir}/modules/${moduleName}/helper.js`;
            let helperExists = true;
            try {
                node_fs_1.default.accessSync(helperPath, node_fs_1.default.constants.R_OK);
            }
            catch {
                helperExists = false;
                console.log(`No helper found for module ${moduleName}`);
            }
            if (helperExists) {
                console.log(`Starting helper for module: ${moduleName}`);
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const HelperClass = require(helperPath.slice(0, -3));
                const helper = new HelperClass();
                helper.setName(moduleName);
                helper.setPath(node_path_1.default.resolve(`${this.rootDir}/modules/${moduleName}`));
                this.moduleHelpers.push(helper);
                helper.loaded();
            }
        }
    }
    checkMirrorConfigs() {
        console.log("Checking if configs are correct");
        let trackerFileExists = true;
        const clientTrackers = [];
        if (!node_fs_1.default.existsSync(node_path_1.default.resolve("./workData/cTracker.json")))
            trackerFileExists = false;
        const clients = this.config.clientConfigs;
        for (const client of clients) {
            const folder = `./configs/${client}/`;
            if (!node_fs_1.default.existsSync(node_path_1.default.resolve(folder))) {
                console.error("No folder for defined client in config!");
                const index = this.config.clientConfigs.indexOf(client);
                this.config.clientConfigs.splice(index, 1);
                continue;
            }
            if (!node_fs_1.default.existsSync(node_path_1.default.resolve(folder) + `/${client}.js`)) {
                console.log(`Creating .js file for client: ${client}`);
                node_fs_1.default.copyFileSync(node_path_1.default.resolve("./js/mirror.js"), node_path_1.default.resolve(`./configs/${client}/${client}.js`));
            }
            if (!trackerFileExists) {
                clientTrackers.push(new clientTracker_js_1.default(client, "mirror"));
            }
        }
        if (!trackerFileExists) {
            clientTrackers.push(new clientTracker_js_1.default("root", "dashboard"));
            try {
                node_fs_1.default.writeFileSync("./workData/cTracker.json", JSON.stringify(clientTrackers, null, 2), "utf8");
                console.log("Client tracker data saved.");
            }
            catch (error) {
                console.error("Error saving cTracker.json:", error.message);
            }
        }
        const rootConfFolder = `./configs/${this.config.rootConf}/`;
        if (node_fs_1.default.existsSync(node_path_1.default.resolve(rootConfFolder))) {
            if (!node_fs_1.default.existsSync(node_path_1.default.resolve(rootConfFolder) + `/${this.config.rootConf}.js`)) {
                console.log(`Creating .js file for client: ${this.config.rootConf}`);
                node_fs_1.default.copyFileSync(node_path_1.default.resolve("./js/mirror.js"), node_path_1.default.resolve(`./configs/${this.config.rootConf}/${this.config.rootConf}.js`));
            }
        }
    }
    async start() {
        this.checkMirrorConfigs();
        this.loadModules();
        this.httpServer = new server_js_1.default(this.config);
        const apps = await this.httpServer.open();
        this.expressApp = apps.app;
        this.socketio = apps.io;
        const helperPromises = [];
        for (const moduleHelper of this.moduleHelpers) {
            moduleHelper.setExpressApp(this.expressApp);
            moduleHelper.setSocketIO(this.socketio);
            try {
                helperPromises.push(moduleHelper.start());
            }
            catch (error) {
                console.error(`Error when starting helper for module ${moduleHelper.name}: ${error}`);
            }
        }
        const results = await Promise.allSettled(helperPromises);
        results.forEach((result) => {
            if (result.status === "rejected")
                console.log(result.reason);
        });
        console.log("All helpers started");
    }
}
new Core().start();

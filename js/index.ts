import fs from "node:fs";
import path from "node:path";
import { merge } from "lodash";
import type { Application } from "express";
import type { Server as SocketIOServer } from "socket.io";

import Server from "./server.js";
import ClientTracker from "./clientTracker.js";
import Helper from "./helper.js";

import type { ServerConfig } from "../types/config.js";
import type { ModuleDefinition, ClientConfig, UserConfig } from "../types/module.js";

type UserObj = { path: string; data: UserConfig };
type ClientModuleMap = Record<string, {
    defaultModules: ModuleDefinition[];
    usersSpecific: UserObj[];
}>;

class Core {
    rootDir: string;
    config: ServerConfig;
    moduleHelpers: Helper[];
    allClients!: ClientModuleMap;
    diffModules!: string[];
    httpServer!: Server;
    expressApp!: Application;
    socketio!: SocketIOServer;

    constructor() {
        this.rootDir = path.resolve(__dirname, "../..");

        const defaults = JSON.parse(
            fs.readFileSync(this.rootDir + "/configs/server/defaultServerConfig.json", "utf8")
        ) as ServerConfig;

        const rawConfig = fs.readFileSync(this.rootDir + "/configs/server/serverConfig.json", "utf8");

        if (rawConfig) {
            this.config = merge({ rootDir: this.rootDir }, defaults, JSON.parse(rawConfig) as Partial<ServerConfig>);
        } else {
            console.warn("Warning: No custom server config found");
            this.config = merge({ rootDir: this.rootDir }, defaults);
        }

        this.moduleHelpers = [];
    }

    getUsersPerClient(client: string, users: string[]): UserObj[] {
        const folder = `${this.rootDir}/configs/${client}/users`;

        return users.map((user) => {
            const filePath = path.join(folder, user + ".json");
            const data = fs.readFileSync(filePath, "utf8");
            return { path: filePath, data: JSON.parse(data) as UserConfig };
        });
    }

    createModuleArray(): ClientModuleMap {
        console.log("Searching for modules");
        const modulesInMirrors: ClientModuleMap = {};

        for (const client of this.config.clientConfigs) {
            let jsonData: ClientConfig;
            try {
                const data = fs.readFileSync(path.resolve(`./configs/${client}/${client}.json`), "utf8");
                jsonData = JSON.parse(data) as ClientConfig;
            } catch (parseErr) {
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

    differentModules(): string[] {
        console.log("Finding all unique modules");
        const diffs: string[] = [];

        for (const client in this.allClients) {
            for (const mod of this.allClients[client].defaultModules) {
                if (!diffs.includes(mod.module)) diffs.push(mod.module);
            }
            for (const user of this.allClients[client].usersSpecific) {
                for (const userMod of user.data.modules) {
                    if (!diffs.includes(userMod.module)) diffs.push(userMod.module);
                }
            }
        }

        return diffs;
    }

    loadModules(): void {
        console.log("Loading modules");
        this.allClients = this.createModuleArray();
        this.diffModules = this.differentModules();

        for (const moduleName of this.diffModules) {
            const moduleFile = this.config.providedModules.includes(moduleName)
                ? `${this.rootDir}/modules/default/${moduleName}/${moduleName}.js`
                : `${this.rootDir}/modules/${moduleName}/${moduleName}.js`;

            try {
                fs.accessSync(moduleFile, fs.constants.R_OK);
            } catch {
                console.log(`No ${moduleFile} found for module ${moduleName}.`);
            }

            const helperPath = `${this.rootDir}/modules/${moduleName}/helper.js`;
            let helperExists = true;
            try {
                fs.accessSync(helperPath, fs.constants.R_OK);
            } catch {
                helperExists = false;
                console.log(`No helper found for module ${moduleName}`);
            }

            if (helperExists) {
                console.log(`Starting helper for module: ${moduleName}`);
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const HelperClass = require(helperPath.slice(0, -3)) as typeof Helper;
                const helper = new HelperClass();

                helper.setName(moduleName);
                helper.setPath(path.resolve(`${this.rootDir}/modules/${moduleName}`));
                this.moduleHelpers.push(helper);
                helper.loaded();
            }
        }
    }

    checkMirrorConfigs(): void {
        console.log("Checking if configs are correct");

        let trackerFileExists = true;
        const clientTrackers: ClientTracker[] = [];
        if (!fs.existsSync(path.resolve("./workData/cTracker.json"))) trackerFileExists = false;

        const clients = this.config.clientConfigs;
        for (const client of clients) {
            const folder = `./configs/${client}/`;
            if (!fs.existsSync(path.resolve(folder))) {
                console.error("No folder for defined client in config!");
                const index = this.config.clientConfigs.indexOf(client);
                this.config.clientConfigs.splice(index, 1);
                continue;
            }

            if (!fs.existsSync(path.resolve(folder) + `/${client}.js`)) {
                console.log(`Creating .js file for client: ${client}`);
                fs.copyFileSync(path.resolve("./js/mirror.js"), path.resolve(`./configs/${client}/${client}.js`));
            }

            if (!trackerFileExists) {
                clientTrackers.push(new ClientTracker(client, "mirror"));
            }
        }

        if (!trackerFileExists) {
            clientTrackers.push(new ClientTracker("root", "dashboard"));
            try {
                fs.writeFileSync("./workData/cTracker.json", JSON.stringify(clientTrackers, null, 2), "utf8");
                console.log("Client tracker data saved.");
            } catch (error) {
                console.error("Error saving cTracker.json:", (error as Error).message);
            }
        }

        const rootConfFolder = `./configs/${this.config.rootConf}/`;
        if (fs.existsSync(path.resolve(rootConfFolder))) {
            if (!fs.existsSync(path.resolve(rootConfFolder) + `/${this.config.rootConf}.js`)) {
                console.log(`Creating .js file for client: ${this.config.rootConf}`);
                fs.copyFileSync(
                    path.resolve("./js/mirror.js"),
                    path.resolve(`./configs/${this.config.rootConf}/${this.config.rootConf}.js`)
                );
            }
        }
    }

    async start(): Promise<void> {
        this.checkMirrorConfigs();
        this.loadModules();

        this.httpServer = new Server(this.config);
        const apps = await this.httpServer.open();
        this.expressApp = apps.app;
        this.socketio = apps.io;

        const helperPromises: Promise<void>[] = [];
        for (const moduleHelper of this.moduleHelpers) {
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
            if (result.status === "rejected") console.log(result.reason);
        });
        console.log("All helpers started");
    }
}

new Core().start();

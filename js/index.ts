import fs from "node:fs";
import path from "node:path";
import { merge } from "lodash";
import { Router } from "express";
import type { Application } from "express";
import type { Server as SocketIOServer } from "socket.io";

import Server from "./server.js";
import ClientTracker from "./clientTracker.js";
import Helper from "./helper.js";

import type { ServerConfig } from "../types/config.js";
import type {
  ModuleDefinition,
  ClientConfig,
  UserConfig,
} from "../types/module.js";
import type { ModuleManifest, HelperPermission } from "../types/index.js";

type UserObj = { path: string; data: UserConfig };
type ClientModuleMap = Record<
  string,
  {
    defaultModules: ModuleDefinition[];
    usersSpecific: UserObj[];
  }
>;

type LoadedHelper = { helper: Helper; manifest: ModuleManifest | null };

class Core {
  rootDir: string;
  config: ServerConfig;
  moduleHelpers: LoadedHelper[];
  allClients!: ClientModuleMap;
  diffModules!: string[];
  httpServer!: Server;
  expressApp!: Application;
  socketio!: SocketIOServer;

  constructor() {
    this.rootDir = path.resolve(__dirname, "../..");

    const defaults = JSON.parse(
      fs.readFileSync(
        this.rootDir + "/configs/server/defaultServerConfig.json",
        "utf8",
      ),
    ) as ServerConfig;

    const rawConfig = fs.readFileSync(
      this.rootDir + "/configs/server/serverConfig.json",
      "utf8",
    );

    if (rawConfig) {
      this.config = merge(
        { rootDir: this.rootDir },
        defaults,
        JSON.parse(rawConfig) as Partial<ServerConfig>,
      );
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
        const data = fs.readFileSync(
          path.resolve(`./configs/${client}/${client}.json`),
          "utf8",
        );
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

  loadAndValidateManifest(
    moduleFolder: string,
    moduleName: string,
  ): ModuleManifest | null {
    const manifestPath = `${moduleFolder}/module.json`;

    let raw: string;
    try {
      raw = fs.readFileSync(manifestPath, "utf8");
    } catch {
      console.warn(
        `[Security] ${moduleName}: module.json missing — helper will not load`,
      );
      return null;
    }

    let manifest: ModuleManifest;
    try {
      manifest = JSON.parse(raw) as ModuleManifest;
    } catch {
      console.warn(
        `[Security] ${moduleName}: module.json is not valid JSON — helper will not load`,
      );
      return null;
    }

    const knownPermissions = new Set<HelperPermission>([
      "express.route",
      "socket.namespace",
      "fs.read",
      "fs.write",
      "network.http",
      "network.ws",
    ]);

    const declared = manifest.helper?.permissions ?? [];
    const unknown = declared.filter((p) => !knownPermissions.has(p));

    if (unknown.length > 0) {
      console.warn(
        `[Security] ${moduleName}: unknown permissions [${unknown.join(", ")}] — rejecting manifest, helper will not load`,
      );
      return null;
    }

    console.log(
      `[Security] ${moduleName}: manifest valid, granted [${declared.join(", ") || "none"}]`,
    );
    return manifest;
  }

  loadModules(): void {
    console.log("Loading modules");
    this.allClients = this.createModuleArray();
    this.diffModules = this.differentModules();

    for (const moduleName of this.diffModules) {
      const moduleFolder = this.config.providedModules.includes(moduleName)
        ? `${this.rootDir}/modules/default/${moduleName}`
        : `${this.rootDir}/modules/${moduleName}`;

      const moduleFile = `${moduleFolder}/${moduleName}.js`;

      let manifest: ModuleManifest | null = null;
      if (!this.config.providedModules.includes(moduleName)) {
        manifest = this.loadAndValidateManifest(moduleFolder, moduleName);
        if (!manifest) continue;
      }

      try {
        fs.accessSync(moduleFile, fs.constants.R_OK);
      } catch {
        console.log(`No ${moduleFile} found for module ${moduleName}.`);
      }

      const helperPath = `${moduleFolder}/helper.js`;
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
        helper.setPath(path.resolve(`${moduleFolder}`));
        this.moduleHelpers.push({ helper, manifest });
        helper.loaded();
      }
    }
  }

  checkMirrorConfigs(): void {
    console.log("Checking if configs are correct");

    let trackerFileExists = true;
    const clientTrackers: ClientTracker[] = [];
    if (!fs.existsSync(path.resolve("./workData/cTracker.json")))
      trackerFileExists = false;

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
        fs.copyFileSync(
          path.resolve("./js/mirror.js"),
          path.resolve(`./configs/${client}/${client}.js`),
        );
      }

      if (!trackerFileExists) {
        clientTrackers.push(new ClientTracker(client, "mirror"));
      }
    }

    if (!trackerFileExists) {
      clientTrackers.push(new ClientTracker("root", "dashboard"));
      try {
        fs.writeFileSync(
          "./workData/cTracker.json",
          JSON.stringify(clientTrackers, null, 2),
          "utf8",
        );
        console.log("Client tracker data saved.");
      } catch (error) {
        console.error("Error saving cTracker.json:", (error as Error).message);
      }
    }

    const rootConfFolder = `./configs/${this.config.rootConf}/`;
    if (fs.existsSync(path.resolve(rootConfFolder))) {
      if (
        !fs.existsSync(
          path.resolve(rootConfFolder) + `/${this.config.rootConf}.js`,
        )
      ) {
        console.log(`Creating .js file for client: ${this.config.rootConf}`);
        fs.copyFileSync(
          path.resolve("./js/mirror.js"),
          path.resolve(
            `./configs/${this.config.rootConf}/${this.config.rootConf}.js`,
          ),
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
    for (const { helper, manifest } of this.moduleHelpers) {
      const hasPermission = (perm: HelperPermission): boolean =>
        manifest === null || manifest.helper.permissions.includes(perm);

      if (hasPermission("express.route")) {
        const router = Router();
        this.expressApp.use(`/${helper.name}`, router);
        helper.setExpressApp(router);
      }

      if (hasPermission("socket.namespace")) {
        const namespace = this.socketio.of(helper.name);
        helper.setSocketIO(namespace);
      }

      if (hasPermission("fs.read")) {
      }
      if (hasPermission("fs.write")) {
      }
      if (hasPermission("network.ws")) {
      }
      if (hasPermission("network.http")) {
      }
      try {
        helperPromises.push(helper.start());
      } catch (error) {
        console.error(
          `Error when starting helper for module ${helper.name}: ${error}`,
        );
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

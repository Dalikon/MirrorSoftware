import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import { Server as SocketIOServer, Socket as SocketIOSocket } from "socket.io";

import ClientTracker from "./clientTracker.js";
import type { ServerConfig } from "../types/config.js";
import type {
  ModuleSocketPayload,
  UserSocketPayload,
} from "../types/socket.js";

class Server {
  app: express.Application;
  port: number | string;
  serverSockets: Set<net.Socket>;
  server: http.Server | https.Server | null;
  config: ServerConfig;
  clientMap: Map<string, SocketIOSocket>;
  trackedClients: ClientTracker[];
  io!: SocketIOServer;

  constructor(config: ServerConfig) {
    this.app = express();
    this.port = config.port || 8080;
    this.serverSockets = new Set();
    this.server = null;
    this.config = config;
    this.clientMap = new Map();
    this.trackedClients = [];
  }

  newHtml(confName: string): void {
    const mirrorName = confName + ".js";
    fs.readFile(path.resolve("./index.html"), "utf8", (err, data) => {
      if (err) {
        console.log(err.message);
        return;
      }

      const clientCssLink = fs.existsSync(path.resolve(`./css/${confName}.css`))
        ? `<link rel="stylesheet" type="text/css" href="/css/${confName}.css" />`
        : "";

      const newFile = data
        .replace("#CLIENTCONFIG#", mirrorName)
        .replace("#CLIENTSTYLE#", clientCssLink);

      fs.writeFile(
        "./configs/" + confName + "/index.html",
        newFile,
        "utf8",
        (writeErr) => {
          if (writeErr) console.log(writeErr.message);
        },
      );
    });
  }

  userServiceEndpoints(): void {
    this.app.post("/get-user/:userName", (req, res) => {
      const userName = req.params.userName;
      const fileName = `${userName}.json`;
      let clientName = "";

      req.on("data", (chunk) => {
        clientName += chunk.toString();
      });

      req.on("end", () => {
        let filePath = path.join(
          path.resolve(__dirname, "../.."),
          "/configs",
          "/" + clientName,
          "/users",
          "/" + fileName,
        );
        if (!fs.existsSync(filePath)) {
          filePath = path.join(
            path.resolve(__dirname, "../.."),
            "/configs",
            "/users",
            "/" + fileName,
          );
          if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: "User config not found" });
            return;
          }
        }

        const userConfig = JSON.parse(fs.readFileSync(filePath, "utf8"));
        res.json(userConfig);
      });
    });
  }

  loadTrackerFile(): void {
    try {
      const data = fs.readFileSync("./workData/cTracker.json", "utf8");
      const tracked: unknown[] = JSON.parse(data);
      this.trackedClients = tracked.map((obj) =>
        ClientTracker.fromObject(
          obj as Parameters<typeof ClientTracker.fromObject>[0],
        ),
      );
      console.log("Client tracker data loaded.");
    } catch (error) {
      console.error("Error loading cTracker.json:", (error as Error).message);
      this.trackedClients = [];
    }
  }

  trackerSetup(): void {
    this.io.on("connection", (socket: SocketIOSocket) => {
      const rawClientName = socket.handshake.query.clientName;
      const clientName = Array.isArray(rawClientName)
        ? rawClientName[0]
        : (rawClientName ?? "");
      const clientIp =
        (socket.handshake.headers["x-forwarded-for"] as string) ||
        socket.handshake.address;

      this.clientMap.set(clientName, socket);
      let beats = 0;

      const client = this.trackedClients.find((c) => c.name === clientName);
      if (!client) {
        console.error(`Unknown client connected: ${clientName}`);
        socket.disconnect();
        return;
      }

      client.lastOnline = new Date();
      client.connectedAt = new Date();
      client.status = "online";
      if (!client.connections.find((c) => c.ip === clientIp)) {
        client.connections.push({
          ip: clientIp,
          connectedAt: client.connectedAt,
        });
      }

      fs.writeFileSync(
        "./workData/cTracker.json",
        JSON.stringify(this.trackedClients, null, 2),
        "utf8",
      );

      let missedHeartbeats = 0;

      const checkHeartbeat = () => {
        if (client.status === "online") {
          missedHeartbeats += 1;
          if (missedHeartbeats >= 4) {
            console.log(
              `Client ${client.name} is unresponsive. Disconnecting...`,
            );
            socket.disconnect();
            return;
          }
          setTimeout(checkHeartbeat, 10000);
        }
      };

      const heartbeatTimer = setTimeout(checkHeartbeat, 10000);

      socket.on("heartbeat", () => {
        client.lastOnline = new Date();
        console.log(`Heartbeat received from ${client.name}`);
        missedHeartbeats = 0;
        beats += 1;
        if (beats === 3) {
          fs.writeFileSync(
            "./workData/cTracker.json",
            JSON.stringify(this.trackedClients, null, 2),
            "utf8",
          );
          beats = 0;
        }
      });

      socket.on("retrieveTrackers", () => {
        if (client.name === "root") {
          console.log("Root requested client tracker data");
          socket.emit("trackersData", this.trackedClients);
        }
      });

      socket.on("HIDE_MODULE_X", (payload: ModuleSocketPayload) => {
        console.log(payload);
        this.clientMap.get(payload.client)?.emit("HIDE_MODULE_Y", payload);
      });

      socket.on("SHOW_MODULE_X", (payload: ModuleSocketPayload) => {
        console.log(payload);
        this.clientMap.get(payload.client)?.emit("SHOW_MODULE_Y", payload);
      });

      socket.on("SUSPEND_MODULE_X", (payload: ModuleSocketPayload) => {
        console.log(payload);
        this.clientMap.get(payload.client)?.emit("SUSPEND_MODULE_Y", payload);
      });

      socket.on("RESUME_MODULE_X", (payload: ModuleSocketPayload) => {
        console.log(payload);
        this.clientMap.get(payload.client)?.emit("RESUME_MODULE_Y", payload);
      });

      socket.on("CHANGE_USER_X", (payload: UserSocketPayload) => {
        console.log(payload);
        const editClient = this.trackedClients.find(
          (c) => c.name === payload.client,
        );
        if (editClient) editClient.user = payload.user;
        this.clientMap.get(payload.client)?.emit("CHANGE_USER_Y", payload);
      });

      socket.on("disconnect", () => {
        console.log(`Client disconnected from server: ${client.name}`);
        const index = client.connections.findIndex(
          (conn) => conn.ip === clientIp,
        );
        if (index !== -1) {
          client.connections.splice(index, 1);
        }
        if (client.connections.length === 0) {
          client.status = "offline";
          this.clientMap.delete(client.name);
        }
        client.user = "default";
        fs.writeFileSync(
          "./workData/cTracker.json",
          JSON.stringify(this.trackedClients, null, 2),
          "utf8",
        );
        clearTimeout(heartbeatTimer);
      });
    });
  }

  open(): Promise<{ app: express.Application; io: SocketIOServer }> {
    return new Promise((resolve) => {
      console.log("Starting express server");
      if (this.config.https) {
        const options = {
          key: fs.readFileSync(this.config.httpsPrivateKey!),
          cert: fs.readFileSync(this.config.httpsCertificate!),
        };
        this.server = https.createServer(options, this.app);
      } else {
        this.server = http.createServer(this.app);
      }

      this.io = new SocketIOServer(this.server, {
        cors: { origin: /.*$/, credentials: true },
      });

      this.app.use(
        helmet({
          contentSecurityPolicy:
            this.config.httpHeaders.contentSecurityPolicy || false,
          crossOriginOpenerPolicy:
            this.config.httpHeaders.crossOriginOpenerPolicy || false,
          crossOriginEmbedderPolicy:
            this.config.httpHeaders.crossOriginEmbedderPolicy || false,
          crossOriginResourcePolicy:
            this.config.httpHeaders.crossOriginResourcePolicy || false,
          originAgentCluster:
            this.config.httpHeaders.originAgentCluster || false,
        }),
      );

      this.loadTrackerFile();
      this.trackerSetup();

      this.server.on("connection", (socket: net.Socket) => {
        this.serverSockets.add(socket);
        socket.on("close", () => this.serverSockets.delete(socket));
      });

      this.server.listen(Number(this.port), this.config.address || "0.0.0.0");

      for (const conf of this.config.clientConfigs) {
        const confBase = path.resolve("./configs") + "/" + conf;
        if (fs.existsSync(confBase + "/" + conf + ".js")) {
          if (!fs.existsSync(confBase + "/index.html")) this.newHtml(conf);
          this.app.use(
            "/" + conf,
            express.static(path.resolve("./configs/" + conf)),
          );
        }
      }

      const rootBase = path.resolve("./configs") + "/" + this.config.rootConf;
      if (fs.existsSync(rootBase + "/" + this.config.rootConf + ".js")) {
        if (!fs.existsSync(rootBase + "/index.html"))
          this.newHtml(this.config.rootConf);
        this.app.use(
          "/",
          express.static(path.resolve("./configs/" + this.config.rootConf)),
        );
        // Also mount at /root/ so fetchConfig() can resolve root.json consistently with other clients
        this.app.use(
          "/" + this.config.rootConf,
          express.static(path.resolve("./configs/" + this.config.rootConf)),
        );
      }

      this.app.use("/configs", express.static("./configs"));
      this.app.use("/modules", express.static("./modules"));
      this.app.use("/css", express.static("./css"));
      this.app.use("/js", express.static("./dist/client"));

      this.userServiceEndpoints();

      this.server.on("listening", () =>
        resolve({ app: this.app, io: this.io }),
      );
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      for (const socket of this.serverSockets.values()) socket.destroy();
      this.server!.close(() => resolve());
    });
  }
}

export default Server;

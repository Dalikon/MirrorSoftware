import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import { Server as SocketIOServer, Socket as SocketIOSocket } from "socket.io";

import ClientTracker from "./clientTracker.js";
import { AuthService, COOKIE_NAME } from "./authService.js";
import type { ServerConfig } from "../types/config.js";
import type {
  ModuleSocketPayload,
  UserSocketPayload,
  CursorSocketPayload,
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
  auth!: AuthService;

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

  userEndpoints(): void {
    const rootDir = path.resolve(__dirname, "../..");

    const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
      const token = this.auth.parseCookie(req.headers.cookie, COOKIE_NAME);
      if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
      const session = this.auth.getSession(token);
      if (!session) { res.status(401).json({ error: "Session expired" }); return; }
      (req as express.Request & { sessionInfo: typeof session }).sessionInfo = session;
      next();
    };

    const readUserConfig = (username: string, clientName?: string): object => {
      if (clientName) {
        const clientPath = path.join(rootDir, "configs", clientName, "users", `${username}.json`);
        if (fs.existsSync(clientPath)) return JSON.parse(fs.readFileSync(clientPath, "utf8")) as object;
      }
      const globalPath = path.join(rootDir, "configs/users", `${username}.json`);
      if (fs.existsSync(globalPath)) return JSON.parse(fs.readFileSync(globalPath, "utf8")) as object;
      return { name: username, modules: [] };
    };

    const writeUserConfig = (username: string, modules: unknown[], clientName?: string): void => {
      const filePath = clientName
        ? path.join(rootDir, "configs", clientName, "users", `${username}.json`)
        : path.join(rootDir, "configs/users", `${username}.json`);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify({ name: username, modules }, null, 2));
    };

    this.app.get("/user/config", requireAuth, (req, res) => {
      const { username } = (req as express.Request & { sessionInfo: { username: string } }).sessionInfo;
      try { res.json(readUserConfig(username)); } catch { res.status(500).json({ error: "Failed to read config" }); }
    });

    this.app.get("/user/config/:client", requireAuth, (req, res) => {
      const { username } = (req as express.Request & { sessionInfo: { username: string } }).sessionInfo;
      const clientName = req.params["client"] as string;
      try { res.json(readUserConfig(username, clientName)); } catch { res.status(500).json({ error: "Failed to read config" }); }
    });

    this.app.get("/user/clients", requireAuth, (req, res) => {
      const { username } = (req as express.Request & { sessionInfo: { username: string } }).sessionInfo;
      const assigned = this.config.clientConfigs.filter(name => {
        try {
          const cfg = JSON.parse(fs.readFileSync(path.join(rootDir, "configs", name, `${name}.json`), "utf8")) as { users?: string[] };
          return (cfg.users ?? []).includes(username);
        } catch { return false; }
      });
      res.json(assigned);
    });

    this.app.get("/user/modules/available", requireAuth, (_req, res) => {
      const adminOnly = new Set(["alert", "clientDetailes", "clientDisplay", "userManager", "personalization"]);
      const userDefaultModules = ["clock", "dbbutton"].filter(m => !adminOnly.has(m));

      let thirdParty: string[] = [];
      try {
        const modulesDir = path.join(rootDir, "modules");
        thirdParty = fs.readdirSync(modulesDir).filter(name => {
          if (name === "default") return false;
          return fs.statSync(path.join(modulesDir, name)).isDirectory();
        });
      } catch { /* no modules dir */ }

      res.json([...userDefaultModules, ...thirdParty]);
    });

    this.app.put("/user/config", requireAuth, (req, res) => {
      const { username } = (req as express.Request & { sessionInfo: { username: string } }).sessionInfo;
      const body = req.body as { modules?: unknown };
      if (!Array.isArray(body.modules)) { res.status(400).json({ error: "modules must be an array" }); return; }
      try { writeUserConfig(username, body.modules as unknown[]); res.json({ ok: true }); }
      catch { res.status(500).json({ error: "Failed to save config" }); }
    });

    this.app.put("/user/config/:client", requireAuth, (req, res) => {
      const { username } = (req as express.Request & { sessionInfo: { username: string } }).sessionInfo;
      const clientName = req.params["client"] as string;
      const body = req.body as { modules?: unknown };
      if (!Array.isArray(body.modules)) { res.status(400).json({ error: "modules must be an array" }); return; }
      try { writeUserConfig(username, body.modules as unknown[], clientName); res.json({ ok: true }); }
      catch { res.status(500).json({ error: "Failed to save config" }); }
    });
  }

  adminEndpoints(): void {
    const rootDir = path.resolve(__dirname, "../..");

    const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
      const token = this.auth.parseCookie(req.headers.cookie, COOKIE_NAME);
      if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
      const session = this.auth.getSession(token);
      if (!session) { res.status(401).json({ error: "Session expired" }); return; }
      if (session.role !== "admin") { res.status(403).json({ error: "Admin required" }); return; }
      next();
    };

    this.app.get("/admin/users", requireAdmin, (_req, res) => {
      res.json(this.auth.listAccounts());
    });

    this.app.post("/admin/users", requireAdmin, (req, res) => {
      const { username, displayName, role, password } = req.body as Record<string, string>;
      if (!username || !displayName || !role || !password) {
        res.status(400).json({ error: "All fields required" }); return;
      }
      try {
        this.auth.createAccount(username, displayName, role as "admin" | "user", password);
        // Auto-create global mirror config if it doesn't exist
        const configPath = path.join(rootDir, "configs/users", `${username}.json`);
        if (!fs.existsSync(configPath)) {
          fs.mkdirSync(path.dirname(configPath), { recursive: true });
          fs.writeFileSync(configPath, JSON.stringify({ name: username, modules: [] }, null, 2));
        }
        res.status(201).json({ ok: true });
      } catch (e) {
        res.status(409).json({ error: (e as Error).message });
      }
    });

    this.app.patch("/admin/users/:username", requireAdmin, (req, res) => {
      try {
        this.auth.updateAccount(req.params["username"] as string, req.body as { displayName?: string; role?: "admin" | "user"; password?: string });
        res.json({ ok: true });
      } catch (e) {
        res.status(404).json({ error: (e as Error).message });
      }
    });

    this.app.delete("/admin/users/:username", requireAdmin, (req, res) => {
      const username = req.params["username"] as string;
      try {
        this.auth.deleteAccount(username);
        // Remove from all client users lists
        for (const clientName of this.config.clientConfigs) {
          const cfgPath = path.join(rootDir, "configs", clientName, `${clientName}.json`);
          try {
            const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as { users?: string[] };
            if (cfg.users?.includes(username)) {
              cfg.users = cfg.users.filter(u => u !== username);
              fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
            }
          } catch { /* ignore unreadable configs */ }
        }
        res.json({ ok: true });
      } catch (e) {
        res.status(404).json({ error: (e as Error).message });
      }
    });

    this.app.get("/admin/clients", requireAdmin, (_req, res) => {
      const clients = this.config.clientConfigs.map(name => {
        const configPath = path.join(rootDir, "configs", name, `${name}.json`);
        let users: string[] = [];
        try {
          users = (JSON.parse(fs.readFileSync(configPath, "utf8")) as { users?: string[] }).users ?? [];
        } catch { /* ignore unreadable configs */ }
        return { name, users };
      });
      res.json(clients);
    });

    this.app.put("/admin/clients/:client/users", requireAdmin, (req, res) => {
      const clientName = req.params["client"] as string;
      if (!this.config.clientConfigs.includes(clientName)) {
        res.status(404).json({ error: "Client not found" }); return;
      }
      const { users } = req.body as { users?: string[] };
      if (!Array.isArray(users)) { res.status(400).json({ error: "users must be an array" }); return; }
      const configPath = path.join(rootDir, "configs", clientName, `${clientName}.json`);
      try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown>;
        config.users = users;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        res.json({ ok: true });
      } catch {
        res.status(500).json({ error: "Failed to update client config" });
      }
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
      this.trackedClients = tracked.map((obj) => {
        const tracker = ClientTracker.fromObject(
          obj as Parameters<typeof ClientTracker.fromObject>[0],
        );
        tracker.status = "offline";
        tracker.connections = [];
        return tracker;
      });
      console.log("Client tracker data loaded.");
    } catch (error) {
      console.error("Error loading cTracker.json:", (error as Error).message);
      this.trackedClients = [];
    }
  }

  pushTrackersToRoot(): void {
    this.clientMap.get(this.config.rootConf)?.emit("trackersData", this.trackedClients);
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
      this.pushTrackersToRoot();

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

      socket.on("TOGGLE_CURSOR_X", (payload: CursorSocketPayload) => {
        this.clientMap.get(payload.client)?.emit("TOGGLE_CURSOR_Y", payload);
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
        this.pushTrackersToRoot();
      });
    });
  }

  authEndpoints(): void {
    const rootDir = path.resolve(__dirname, "../..");
    const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

    this.app.get("/login", (_req, res) => {
      res.sendFile(path.resolve(rootDir, "public/login.html"));
    });

    this.app.post("/auth/login", (req, res) => {
      const { username, password } = req.body as { username?: string; password?: string };
      if (!username || !password) {
        res.status(400).json({ error: "Username and password required" });
        return;
      }
      const session = this.auth.login(username, password);
      if (!session) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }
      res.setHeader("Set-Cookie", `${COOKIE_NAME}=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE}`);
      res.json({ username: session.username, displayName: session.displayName, role: session.role });
    });

    this.app.post("/auth/logout", (req, res) => {
      const token = this.auth.parseCookie(req.headers.cookie, COOKIE_NAME);
      if (token) this.auth.logout(token);
      res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
      res.json({ ok: true });
    });

    this.app.get("/auth/me", (req, res) => {
      const token = this.auth.parseCookie(req.headers.cookie, COOKIE_NAME);
      if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
      const session = this.auth.getSession(token);
      if (!session) { res.status(401).json({ error: "Session expired" }); return; }
      res.json(session);
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

      this.app.use(express.json());

      this.auth = new AuthService(path.resolve(__dirname, "../.."));

      this.authEndpoints();
      this.userEndpoints();
      this.adminEndpoints();

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

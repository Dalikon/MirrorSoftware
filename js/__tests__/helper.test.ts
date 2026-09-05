import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express, { Router } from "express";
import request from "supertest";
import { Server as SocketIOServer } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";

import Helper from "../helper.js";

describe("Helper", () => {
	describe("registerRoute / setExpressApp", () => {
		let tempDir: string;

		beforeEach(() => {
			tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dalamirror-helper-"));
		});

		afterEach(() => {
			fs.rmSync(tempDir, { recursive: true, force: true });
		});

		it("attaches a registered route under the module's router", async () => {
			const helper = new Helper();
			helper.setName("testmod");
			helper.setPath(tempDir);

			const app = express();
			const router = Router();
			app.use("/testmod", router);
			helper.setExpressApp(router);
			helper.registerRoute("get", "/ping", (_req, res) => res.json({ ok: true }));

			const res = await request(app).get("/testmod/ping");
			expect(res.status).toBe(200);
			expect(res.body).toEqual({ ok: true });
		});

		it("serves static files from <modulePath>/public", async () => {
			fs.mkdirSync(path.join(tempDir, "public"), { recursive: true });
			fs.writeFileSync(path.join(tempDir, "public", "hello.txt"), "hi there");

			const helper = new Helper();
			helper.setName("testmod");
			helper.setPath(tempDir);

			const app = express();
			const router = Router();
			app.use("/testmod", router);
			helper.setExpressApp(router);

			const res = await request(app).get("/testmod/hello.txt");
			expect(res.status).toBe(200);
			expect(res.text).toBe("hi there");
		});

		it("404s for a static file that doesn't exist, rather than throwing", async () => {
			const helper = new Helper();
			helper.setName("testmod");
			helper.setPath(tempDir); // no public/ dir created at all

			const app = express();
			const router = Router();
			app.use("/testmod", router);
			helper.setExpressApp(router);

			const res = await request(app).get("/testmod/nothing.txt");
			expect(res.status).toBe(404);
		});
	});

	describe("socket notifications", () => {
		let httpServer: http.Server;
		let port: number;

		afterEach(async () => {
			await new Promise<void>((resolve) => httpServer.close(() => resolve()));
		});

		async function setup(): Promise<Helper> {
			const helper = new Helper();
			helper.setName("testmod");
			httpServer = http.createServer();
			const io = new SocketIOServer(httpServer);
			const namespace = io.of("/testmod");
			helper.setSocketIO(namespace);

			await new Promise<void>((resolve) => httpServer.listen(0, resolve));
			port = (httpServer.address() as AddressInfo).port;
			return helper;
		}

		function connect(): ClientSocket {
			return ioClient(`http://localhost:${port}/testmod`, {
				path: "/socket.io",
				forceNew: true,
				transports: ["websocket"],
			});
		}

		it("routes an arbitrary incoming event to socketNotificationReceived via the catch-all", async () => {
			const helper = await setup();
			const received = jest.spyOn(helper, "socketNotificationReceived");

			const client = connect();
			await new Promise<void>((resolve) => client.once("connect", () => resolve()));

			client.emit("SOME_MODULE_EVENT", { foo: "bar" });
			await new Promise((resolve) => setTimeout(resolve, 200));

			expect(received).toHaveBeenCalledWith("SOME_MODULE_EVENT", { foo: "bar" });

			client.close();
		});

		it("does not re-deliver the internal '*' marker as a real notification", async () => {
			const helper = await setup();
			const received = jest.spyOn(helper, "socketNotificationReceived");

			const client = connect();
			await new Promise<void>((resolve) => client.once("connect", () => resolve()));

			client.emit("ANOTHER_EVENT", { n: 1 });
			await new Promise((resolve) => setTimeout(resolve, 200));

			const notifications = received.mock.calls.map(([notification]) => notification);
			expect(notifications).not.toContain("*");

			client.close();
		});

		it("sendSocketNotification broadcasts to clients connected on the module's namespace", async () => {
			const helper = await setup();
			const client = connect();
			await new Promise<void>((resolve) => client.once("connect", () => resolve()));

			const received = new Promise((resolve) => client.once("PONG", resolve));
			helper.sendSocketNotification("PONG", { ok: true });

			await expect(received).resolves.toEqual({ ok: true });

			client.close();
		});
	});
});

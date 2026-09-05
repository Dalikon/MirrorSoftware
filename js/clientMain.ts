import { Module, configMerge } from "./module.js";
import { ClientSocket } from "./clientSocket.js";
import { formatTime, fetchClientConfig, fetchUserConfig } from "./utils.js";
import { getSession } from "./clientState.js";
import { startClient } from "./client.js";

// Expose base classes and utilities on window for dynamically loaded module JS files
(window as unknown as Record<string, unknown>)["Module"] = Module;
(window as unknown as Record<string, unknown>)["ClientSocket"] = ClientSocket;
(window as unknown as Record<string, unknown>)["configMerge"] = configMerge;
(window as unknown as Record<string, unknown>)["formatTime"] = formatTime;
(window as unknown as Record<string, unknown>)["fetchClientConfig"] = fetchClientConfig;
(window as unknown as Record<string, unknown>)["fetchUserConfig"] = fetchUserConfig;
(window as unknown as Record<string, unknown>)["getSession"] = getSession;

startClient();

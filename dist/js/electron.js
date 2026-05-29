"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_fs_1 = __importDefault(require("node:fs"));
// Config
let config;
if (process.env["config"]) {
    config = JSON.parse(process.env["config"]);
}
else {
    if (!node_fs_1.default.existsSync("configs/electron/eleDefaults.json")) {
        console.error("No default config for electron found!");
        process.exit(1);
    }
    const defaults = JSON.parse(node_fs_1.default.readFileSync("configs/electron/eleDefaults.json", "utf8"));
    let overrides = {};
    if (node_fs_1.default.existsSync("configs/electron/eleConfig.json")) {
        overrides = JSON.parse(node_fs_1.default.readFileSync("configs/electron/eleConfig.json", "utf8"));
    }
    config = Object.assign({}, defaults, overrides);
}
if (process.env["ELECTRON_ENABLE_GPU"] !== "1" || !config.gpu) {
    electron_1.app.disableHardwareAcceleration();
}
let mainWindow;
function createWindow() {
    let electronSize = { width: 800, height: 600 };
    try {
        electronSize = electron_1.screen.getPrimaryDisplay().workAreaSize;
    }
    catch {
        console.warn("Could not get display size, using defaults ...");
    }
    const switchesDefaults = ["autoplay-policy", "no-user-gesture-required"];
    const allSwitches = new Set([...switchesDefaults, ...(config.electronSwitches ?? [])]);
    for (const sw of allSwitches) {
        electron_1.app.commandLine.appendSwitch(sw);
    }
    const electronOptionsDefaults = {
        width: electronSize.width,
        height: electronSize.height,
        x: 0,
        y: 0,
        darkTheme: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            zoomFactor: config.zoom
        },
        backgroundColor: "#000000"
    };
    const electronOptions = Object.assign({}, electronOptionsDefaults, config.electronOptions ?? {});
    mainWindow = new electron_1.BrowserWindow(electronOptions);
    const prefix = config.https ? "https://" : "http://";
    const isUnroutable = config.address === "undefined" || config.address === "" || config.address === "0.0.0.0";
    const address = isUnroutable ? "localhost" : config.address;
    mainWindow.loadURL(`${prefix}${address}:${config.port}/${config.clientName}`);
    mainWindow.webContents.on("dom-ready", () => {
        mainWindow?.webContents.sendInputEvent({ type: "mouseMove", x: 0, y: 0 });
    });
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        let curHeaders = details.responseHeaders ?? {};
        if (config.ignoreXOriginHeader) {
            curHeaders = Object.fromEntries(Object.entries(curHeaders).filter(([key]) => !(/x-frame-options/i).test(key)));
        }
        if (config.ignoreContentSecurityPolicy) {
            curHeaders = Object.fromEntries(Object.entries(curHeaders).filter(([key]) => !(/content-security-policy/i).test(key)));
        }
        callback({ responseHeaders: curHeaders });
    });
    mainWindow.once("ready-to-show", () => {
        mainWindow?.show();
    });
}
electron_1.app.on("window-all-closed", () => {
    if (process.env["JEST_WORKER_ID"] !== undefined) {
        electron_1.app.quit();
    }
    else {
        createWindow();
    }
});
electron_1.app.on("activate", () => {
    if (mainWindow === null)
        createWindow();
});
electron_1.app.on("before-quit", async (event) => {
    console.log("Shutting down server...");
    event.preventDefault();
    process.exit(0);
});
electron_1.app.on("certificate-error", (event, _webContents, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(true);
});
electron_1.app.whenReady().then(() => {
    console.log("Launching client viewer application.");
    createWindow();
});

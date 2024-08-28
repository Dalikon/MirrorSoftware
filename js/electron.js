"use strict";

const electron = require("electron");
const fs = require("node:fs")

// Config
let config = {}
if (process.env.config){
    config = JSON.parse(process.env.config);
} else {
    if (!fs.existsSync(`configs/electron/eleDefaults.json`)) {
        console.error("No default config for electron found!");
    } else {
        let defaults = JSON.parse(fs.readFileSync("configs/electron/eleDefaults.json"));
        let newConfig = {}
        if (fs.existsSync("configs/electron/eleConfig.json")) {
            newConfig = JSON.parse(fs.readFileSync("configs/electron/eleConfig.json"));
        }
        config = Object.assign({}, defaults, newConfig);
    }
}

// Module to control application life.
const eleApp = electron.app;

// Per default electron is started with --disable-gpu flag, if you want the gpu enabled,
// you must set the env var ELECTRON_ENABLE_GPU=1 on startup or set config option "gpu" to true.
// See https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering for more info.
if (process.env.ELECTRON_ENABLE_GPU !== "1" || !config.gpu) {
	eleApp.disableHardwareAcceleration();
}

// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

/*
 * Create a window that fills the screen's available work area.
 */
function createWindow () {
	let electronSize = (800, 600);
	try {
		electronSize = electron.screen.getPrimaryDisplay().workAreaSize;
	} catch {
		console.log.warn("Could not get display size, using defaults ...");
	}

	let electronSwitchesDefaults = ["autoplay-policy", "no-user-gesture-required"];
	eleApp.commandLine.appendSwitch(...new Set(electronSwitchesDefaults, config.electronSwitches));
	let electronOptionsDefaults = {
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


	const electronOptions = Object.assign({}, electronOptionsDefaults, config.electronOptions);

	// Create the browser window.
	mainWindow = new BrowserWindow(electronOptions);

	let prefix;
	if (config.https) {
		prefix = "https://";
	} else {
		prefix = "http://";
	}

	let address = (config.address === "undefined") | (config.address === "") | (config.address === "0.0.0.0") ? (config.address = "localhost") : config.address;
	const port = config.port;
    let client = config.clientName;
	mainWindow.loadURL(`${prefix}${address}:${port}/${client}`);

	// simulate mouse move to hide black cursor on start
	mainWindow.webContents.on("dom-ready", (event) => {
		mainWindow.webContents.sendInputEvent({ type: "mouseMove", x: 0, y: 0 });
	});

	// Set responders for window events.
	mainWindow.on("closed", function () {
		mainWindow = null;
	});

	//remove response headers that prevent sites of being embedded into iframes if configured
	mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
		let curHeaders = details.responseHeaders;
		if (config["ignoreXOriginHeader"] || false) {
			curHeaders = Object.fromEntries(Object.entries(curHeaders).filter((header) => !(/x-frame-options/i).test(header[0])));
		}

		if (config["ignoreContentSecurityPolicy"] || false) {
			curHeaders = Object.fromEntries(Object.entries(curHeaders).filter((header) => !(/content-security-policy/i).test(header[0])));
		}

		callback({ responseHeaders: curHeaders });
	});

	mainWindow.once("ready-to-show", () => {
		mainWindow.show();
	});
}

// Quit when all windows are closed.
eleApp.on("window-all-closed", function () {
	if (process.env.JEST_WORKER_ID !== undefined) {
		// if we are running with jest
		eleApp.quit();
	} else {
		createWindow();
	}
});

/*
 * On OS X it's common to re-create a window in the eleApp when the
 * dock icon is clicked and there are no other windows open.
 */
eleApp.on("activate", function () {
	if (mainWindow === null) {
		createWindow();
	}
});

/* This method will be called when SIGINT is received and will call
 * each node_helper's stop function if it exists. Added to fix #1056
 *
 * Note: this is only used if running Electron. Otherwise
 * core.stop() is called by process.on("SIGINT"... in `eleApp.js`
 */
eleApp.on("before-quit", async (event) => {
	console.log("Shutting down server...");
	event.preventDefault();
	process.exit(0);
});

/**
 * Handle errors from self-signed certificates
 */
eleApp.on("certificate-error", (event, webContents, url, error, certificate, callback) => {
	event.preventDefault();
	callback(true);
});

eleApp.whenReady().then(() => {
    console.log("Launching client viewer application.");
	createWindow();
});

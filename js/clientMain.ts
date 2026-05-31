import { Module, configMerge } from "./module.js";
import { ClientSocket } from "./clientSocket.js";
import { UserService } from "./UserService.js";
import { resetDOM, fetchConfig, fetchClientConfig, fetchUserConfig, formatTime } from "./utils.js";
import {
    setClient, setClientConfig, setConfigInUse, setFreshRegions,
    getConfigInUse, type ActiveConfig
} from "./clientState.js";
import type { ClientConfig, ModuleInfo, ModulePosition } from "../types/module.js";

// Expose base classes and utilities on window for dynamically loaded module JS files
(window as unknown as Record<string, unknown>)["Module"] = Module;
(window as unknown as Record<string, unknown>)["ClientSocket"] = ClientSocket;
(window as unknown as Record<string, unknown>)["configMerge"] = configMerge;
(window as unknown as Record<string, unknown>)["formatTime"] = formatTime;
(window as unknown as Record<string, unknown>)["fetchClientConfig"] = fetchClientConfig;
(window as unknown as Record<string, unknown>)["fetchUserConfig"] = fetchUserConfig;

class Client {
    moduleObjs: Module[] = [];
    modulesInfo: ModuleInfo[] = [];
    loadedModules: string[] = [];
    users: string[] = [];

    readonly defModules = ["clock", "dbbutton", "clientDisplay", "clientDetailes"];

    readonly modulePositions: ModulePosition[] = [
        "top_bar", "top_left", "top_center", "top_right",
        "upper_third", "middle_center", "lower_third",
        "bottom_left", "bottom_center", "bottom_right", "bottom_bar",
        "fullscreen_above", "fullscreen_below"
    ];

    selectPosition(position: ModulePosition): Element | null {
        const posClasses = position.replace("_", " ");
        const posDiv = document.getElementsByClassName(posClasses);
        if (posDiv.length > 0) {
            const wrapper = posDiv[0].getElementsByClassName("container");
            if (wrapper.length > 0) return wrapper[0];
        }
        return null;
    }

    updateWrapperStates(): void {
        for (const position of this.modulePositions) {
            const wrapper = this.selectPosition(position);
            if (!wrapper) continue;
            const moduleWrappers = wrapper.getElementsByClassName("module");
            let showWrapper = false;
            for (const mw of Array.from(moduleWrappers)) {
                const style = (mw as HTMLElement).style.position;
                if (style === "" || style === "static") { showWrapper = true; break; }
            }
            (wrapper as HTMLElement).style.display = showWrapper ? "block" : "none";
        }
    }

    hideModule(module: Module, speed: number, callback: () => void, _options: unknown = {}): void {
        const moduleWrapper = document.getElementById(module.id);
        if (moduleWrapper) {
            moduleWrapper.style.transition = `opacity ${speed / 1000}s`;
            moduleWrapper.style.opacity = "0";
            moduleWrapper.classList.add("hidden");
            module.showHideTimer = setTimeout(() => {
                moduleWrapper.style.position = "fixed";
                this.updateWrapperStates();
                callback();
            }, speed);
        } else {
            callback();
        }
    }

    showModule(module: Module, speed: number, callback: () => void, _options: unknown = {}): void {
        const moduleWrapper = document.getElementById(module.id);
        if (moduleWrapper) {
            moduleWrapper.style.transition = `opacity ${speed / 1000}s`;
            moduleWrapper.style.position = "static";
            moduleWrapper.classList.remove("hidden");
            this.updateWrapperStates();
            void moduleWrapper.parentElement?.parentElement?.offsetHeight; // force reflow
            moduleWrapper.style.opacity = "1";
            module.showHideTimer = setTimeout(callback, speed);
        } else {
            callback();
        }
    }

    async loadFile(url: string, type: "module" | "script" | "style"): Promise<void> {
        if (type === "style") {
            return new Promise((resolve) => {
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.type = "text/css";
                link.href = url;
                link.onload = () => resolve();
                link.onerror = () => { console.error("Error loading style:", url); resolve(); };
                document.head.appendChild(link);
            });
        }

        if (type === "module" && this.loadedModules.includes(url)) return;

        return new Promise((resolve) => {
            const script = document.createElement("script");
            script.type = "text/javascript";
            script.src = url;
            script.onload = () => resolve();
            script.onerror = () => {
                console.error("Error loading script:", url);
                resolve();
            };
            document.body.appendChild(script);
            if (type === "module") this.loadedModules.push(url);
        });
    }

    loadModulesInfo(): void {
        const configInUse = getConfigInUse();
        configInUse.modules.forEach((moduleConfig, index) => {
            const moduleName = moduleConfig.module;
            const folder = this.defModules.includes(moduleName)
                ? `/modules/default/${moduleName}/`
                : `/modules/${moduleName}/`;

            this.modulesInfo.push({
                index,
                id: `${moduleName}_${index}`,
                name: moduleName,
                folder,
                file: moduleName + ".js",
                position: moduleConfig.position ?? "middle_center",
                hiddenOnStartup: moduleConfig.hiddenOnStartup,
                hidden: moduleConfig.hiddenOnStartup,
                header: moduleConfig.header,
                config: moduleConfig.config ?? {},
                classes: moduleConfig.classes ? `${moduleConfig.classes} ${moduleName}` : moduleName
            });
        });
    }

    resolveScriptUrl(script: string, moduleFolder: string): string {
        if (script.startsWith("http") || script.startsWith("/")) return script;
        if (script.includes("/")) return moduleFolder + "node_modules/" + script;
        // bare filename like "moment.js" — resolve as a same-named package folder
        const packageName = script.replace(/\.js$/, "");
        return moduleFolder + "node_modules/" + packageName + "/" + script;
    }

    async loadModule(moduleInfo: ModuleInfo): Promise<void> {
        const url = moduleInfo.folder + moduleInfo.file;
        await this.loadFile(url, "module");

        const ModuleClass = (window as unknown as Record<string, new () => Module>)[moduleInfo.name];
        if (!ModuleClass) {
            console.error(`Module class not found on window: ${moduleInfo.name}`);
            return;
        }
        const module = new ModuleClass();

        for (const script of module.getScripts()) {
            await this.loadFile(this.resolveScriptUrl(script, moduleInfo.folder), "script");
        }

        for (const style of module.getStyles()) {
            const styleUrl = style.startsWith("http") || style.startsWith("/")
                ? style
                : moduleInfo.folder + style;
            await this.loadFile(styleUrl, "style");
        }

        module.setData(moduleInfo);
        this.moduleObjs.push(module);
        console.log(`Module loaded: ${module.name}`);
    }

    async loadModules(): Promise<void> {
        this.loadModulesInfo();
        for (const moduleInfo of this.modulesInfo) {
            await this.loadModule(moduleInfo);
        }
    }

    async createDomObjects(): Promise<void> {
        for (const moduleObj of this.moduleObjs) {
            const newWrapper = await moduleObj.createDom();
            if (newWrapper) {
                newWrapper.className = moduleObj.classes + " module";
                newWrapper.id = moduleObj.id;
                this.selectPosition(moduleObj.position)?.appendChild(newWrapper);
            }
        }
    }

    moduleNeedsUpdate(module: Module, newContent: HTMLElement): boolean {
        const moduleWrapper = document.getElementById(module.id);
        if (!moduleWrapper) return false;
        const temp = document.createElement("div");
        temp.appendChild(newContent);
        return temp.innerHTML !== moduleWrapper.innerHTML;
    }

    updateModuleContent(module: Module, newContent?: HTMLElement): void {
        const moduleWrapper = document.getElementById(module.id);
        if (!moduleWrapper) return;
        moduleWrapper.innerHTML = "";
        if (newContent) moduleWrapper.appendChild(newContent);
    }

    updateDom(module: Module, _updateOptions: unknown = null): void {
        let contentPromise = module.createDom();
        if (!(contentPromise instanceof Promise)) {
            contentPromise = Promise.resolve(contentPromise);
        }
        contentPromise.then((newContent) => {
            if (!module.hidden && this.moduleNeedsUpdate(module, newContent)) {
                this.updateModuleContent(module, newContent);
            }
        }).catch((err) => console.error(err));
    }

    sendNotification(notification: string, payload: unknown, sender: Module, sendTo?: Module): void {
        for (const module of this.moduleObjs) {
            if (module !== sender && (!sendTo || module === sendTo)) {
                module.notificationReceived(notification, payload, sender);
            }
        }
    }

    findModuleByID(moduleID: string): Module | undefined {
        return this.moduleObjs.find((m) => m.id === moduleID);
    }

    async startModules(): Promise<void> {
        for (const module of this.moduleObjs) {
            await module.start();
        }
        this.sendNotification("ALL_MODULES_STARTED", "", {} as Module);
    }

    async init(): Promise<void> {
        await this.loadModules();
        await this.createDomObjects();
        await this.startModules();
    }

    async reload(): Promise<void> {
        this.modulesInfo = [];
        for (const module of this.moduleObjs) module.suspend();
        this.moduleObjs = [];
        await this.init();
    }
}

function setupTrackerSocket(tracker: ClientSocket): void {
    tracker.socket.on("connect", () => {
        setInterval(() => {
            tracker.socket.emit("heartbeat");
        }, 10000);
    });

    tracker.socket.on("HIDE_MODULE_Y", (payload: { id: string }) => {
        const client = (window as unknown as Record<string, Client>)["_client"];
        client?.findModuleByID(payload.id)?.hide(300);
    });

    tracker.socket.on("SHOW_MODULE_Y", (payload: { id: string }) => {
        const client = (window as unknown as Record<string, Client>)["_client"];
        client?.findModuleByID(payload.id)?.show(300);
    });

    tracker.socket.on("SUSPEND_MODULE_Y", (payload: { id: string }) => {
        const client = (window as unknown as Record<string, Client>)["_client"];
        client?.findModuleByID(payload.id)?.suspend();
    });

    tracker.socket.on("RESUME_MODULE_Y", (payload: { id: string }) => {
        const client = (window as unknown as Record<string, Client>)["_client"];
        client?.findModuleByID(payload.id)?.resume();
    });

    tracker.socket.on("CHANGE_USER_Y", (payload: { user: string }) => {
        const userService = (window as unknown as Record<string, UserService>)["_userService"];
        userService?.changeUser(payload.user);
    });
}

async function startClient(): Promise<void> {
    try {
        const clientConfig = await fetchConfig() as ClientConfig;
        setClientConfig(clientConfig);

        const configInUse: ActiveConfig = { name: clientConfig.name, modules: clientConfig.defaultModules };
        setConfigInUse(configInUse);

        const freshRegions = document.getElementById("all-regions")?.innerHTML ?? "";
        setFreshRegions(freshRegions);

        const trackerSocket = new ClientSocket("/", { clientName: clientConfig.name, clientType: "mirror" });
        (window as unknown as Record<string, unknown>)["trackerSocket"] = trackerSocket;
        setupTrackerSocket(trackerSocket);

        const client = new Client();
        setClient(client);

        // Also expose on window for setupTrackerSocket callbacks
        (window as unknown as Record<string, unknown>)["_client"] = client;

        const userService = new UserService();
        (window as unknown as Record<string, unknown>)["_userService"] = userService;

        await client.init();
    } catch (error) {
        console.error("Error during client startup:", error);
    }
}

startClient();

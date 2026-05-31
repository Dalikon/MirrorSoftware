import { fetchConfig } from "./utils.js";
import { getClient, getClientConfig, setConfigInUse } from "./clientState.js";
import type { ClientConfig, UserConfig } from "../types/module.js";
import { resetDOM } from "./utils.js";

interface UserModuleStorage {
    name: string;
    moduleObjs: unknown[];
}

export class UserService {
    private userModulesStorage: UserModuleStorage[] = [];
    private userConfigStorage: UserConfig[] = [];
    activeUser: string;

    constructor() {
        const clientConfig = getClientConfig();
        this.activeUser = clientConfig.name;
    }

    changeUser(userName: string): void {
        const clientConfig = getClientConfig();
        if (clientConfig.userSwitchMode === "SAVE") {
            this.changeUserSAVE(userName);
        } else {
            void this.changeUserDELETE(userName);
        }
    }

    changeUserSAVE(_userName: string): void {
        // TODO: implement SAVE mode user switching
    }

    async changeUserDELETE(userName: string): Promise<void> {
        const user = await this.findUserConfig(userName);
        resetDOM();
        setConfigInUse(user);
        getClient().reload();
    }

    async findUserConfig(userName: string): Promise<{ name: string; modules: UserConfig["modules"] }> {
        const clientConfig = getClientConfig();

        if (userName === "default") {
            return { name: clientConfig.name, modules: clientConfig.defaultModules };
        }

        if (clientConfig.userSwitchMode === "SAVE") {
            const stored = this.userModulesStorage.find((u) => u.name === userName);
            if (stored) return { name: stored.name, modules: [] };
        } else {
            const stored = this.userConfigStorage.find((u) => u.name === userName);
            if (stored) return stored;
        }

        const response = await fetch(`/get-user/${userName}`, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: clientConfig.name
        });
        const data = await response.json() as UserConfig;

        if (clientConfig.userSwitchMode === "SAVE") {
            this.userModulesStorage.push({ name: data.name, moduleObjs: [] });
        } else {
            this.userConfigStorage.push(data);
        }

        return data;
    }
}

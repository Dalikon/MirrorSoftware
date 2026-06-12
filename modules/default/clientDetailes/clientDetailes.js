class clientDetailes extends Module {
    getStyles() {
        return ["/css/clientDetailes.css"];
    }

    defaults() {
        this.userConfigs = [];
    }

    createDom() {
        return null;
    }

    async showPopup(targetClient) {
        this.clientConfig = await fetchClientConfig(targetClient.name);
        this.tClientData = targetClient;

        const existingPopup = document.getElementById("popup");
        if (existingPopup) existingPopup.remove();

        const popup = document.createElement("div");
        popup.id = "popup";

        const closeButton = document.createElement("button");
        closeButton.id = "close-popup";
        closeButton.textContent = "×";
        closeButton.addEventListener("click", () => popup.remove());
        popup.appendChild(closeButton);

        // Header: name + status
        const header = document.createElement("div");
        header.className = "popup-header";
        const title = document.createElement("h2");
        title.textContent = this.tClientData.name;
        const statusBadge = document.createElement("span");
        statusBadge.className = `popup-status ${this.tClientData.status}`;
        statusBadge.textContent = this.tClientData.status;

        let cursorVisible = false;
        const cursorToggle = document.createElement("button");
        cursorToggle.className = "popup-cursor-toggle";
        cursorToggle.textContent = "cursor off";
        cursorToggle.addEventListener("click", () => {
            cursorVisible = !cursorVisible;
            cursorToggle.textContent = cursorVisible ? "cursor on" : "cursor off";
            cursorToggle.classList.toggle("active", cursorVisible);
            trackerSocket.sendNotification("TOGGLE_CURSOR_X", { client: this.clientConfig.name, visible: cursorVisible });
        });

        header.appendChild(title);
        header.appendChild(statusBadge);
        header.appendChild(cursorToggle);
        popup.appendChild(header);

        // Connections section
        const connectionsSection = document.createElement("div");
        connectionsSection.className = "popup-section";
        const connectionsLabel = document.createElement("h4");
        connectionsLabel.className = "popup-section-label";
        connectionsLabel.textContent = "Connections";
        connectionsSection.appendChild(connectionsLabel);
        connectionsSection.appendChild(this.connectionsElement(this.tClientData));
        popup.appendChild(connectionsSection);

        // Modules section
        const modulesSection = document.createElement("div");
        modulesSection.className = "popup-section";
        const modulesLabel = document.createElement("h4");
        modulesLabel.className = "popup-section-label";
        modulesLabel.textContent = "Modules";
        modulesSection.appendChild(modulesLabel);
        const moduleSettings = document.createElement("div");
        moduleSettings.id = "moduleSettings";
        modulesSection.appendChild(moduleSettings);
        popup.appendChild(modulesSection);
        this.moduleSettingsElement(moduleSettings);

        // Users section
        const usersSection = document.createElement("div");
        usersSection.className = "popup-section";
        const usersLabel = document.createElement("h4");
        usersLabel.className = "popup-section-label";
        usersLabel.textContent = "Active user";
        usersSection.appendChild(usersLabel);
        const usersDiv = await this.userButtonsElement(targetClient);
        usersSection.appendChild(usersDiv);
        popup.appendChild(usersSection);

        document.getElementById("all-regions").appendChild(popup);
        popup.classList.add("show");
    }

    connectionsElement(client) {
        const connectionsDiv = document.createElement("div");
        connectionsDiv.className = "popup-connections";

        if (client.connections.length === 0) {
            const none = document.createElement("p");
            none.className = "popup-empty";
            none.textContent = "No active connections";
            connectionsDiv.appendChild(none);
            return connectionsDiv;
        }

        for (const connection of client.connections) {
            const row = document.createElement("div");
            row.className = "connection-row";

            const ip = document.createElement("span");
            ip.className = "connection-ip";
            ip.textContent = connection.ip;
            row.appendChild(ip);

            const time = document.createElement("span");
            time.className = "connection-time";
            time.textContent = formatTime(connection.connectedAt);
            row.appendChild(time);

            connectionsDiv.appendChild(row);
        }
        return connectionsDiv;
    }

    moduleSettingsElement(moduleSettings = document.getElementById("moduleSettings")) {
        moduleSettings.innerHTML = "";

        const modules = this.tClientData.user === "default"
            ? this.clientConfig.defaultModules
            : (this.userConfigs.find(c => c.name === this.tClientData.user)?.modules ?? []);

        for (const [index, moduleConfig] of modules.entries()) {
            moduleSettings.appendChild(this.moduleControlElement(this.clientConfig.name, moduleConfig, index));
        }
    }

    moduleControlElement(clientName, moduleConfig, index) {
        const moduleID = `${moduleConfig.module}_${index}`;

        const row = document.createElement("div");
        row.className = "popup-module";

        const info = document.createElement("div");
        info.className = "popup-module-info";
        const name = document.createElement("span");
        name.className = "popup-module-name";
        name.textContent = moduleConfig.module;
        const pos = document.createElement("span");
        pos.className = "popup-module-pos";
        pos.textContent = moduleConfig.position ?? "";
        info.appendChild(name);
        info.appendChild(pos);
        row.appendChild(info);

        const actions = document.createElement("div");
        actions.className = "popup-module-actions";

        const hideShowBtn = document.createElement("button");
        hideShowBtn.className = "popup-btn";
        hideShowBtn.textContent = "Hide";
        hideShowBtn.addEventListener("click", () => {
            if (hideShowBtn.textContent === "Hide") {
                trackerSocket.sendNotification("HIDE_MODULE_X", { module: moduleConfig.module, id: moduleID, client: clientName });
                hideShowBtn.textContent = "Show";
            } else {
                trackerSocket.sendNotification("SHOW_MODULE_X", { module: moduleConfig.module, id: moduleID, client: clientName });
                hideShowBtn.textContent = "Hide";
            }
        });

        const susResBtn = document.createElement("button");
        susResBtn.className = "popup-btn";
        susResBtn.textContent = "Suspend";
        susResBtn.addEventListener("click", () => {
            if (susResBtn.textContent === "Suspend") {
                trackerSocket.sendNotification("SUSPEND_MODULE_X", { module: moduleConfig.module, id: moduleID, client: clientName });
                susResBtn.textContent = "Resume";
            } else {
                trackerSocket.sendNotification("RESUME_MODULE_X", { module: moduleConfig.module, id: moduleID, client: clientName });
                susResBtn.textContent = "Suspend";
            }
        });

        actions.appendChild(hideShowBtn);
        actions.appendChild(susResBtn);
        row.appendChild(actions);

        return row;
    }

    async userButtonsElement(tClient) {
        const container = document.createElement("div");
        container.className = "popup-user-buttons";

        const allUsers = ["default", ...this.clientConfig.users];

        for (const user of allUsers) {
            if (user !== "default") {
                await this.fetchAndStoreUserConfig(this.clientConfig.name, user);
            }
            const btn = document.createElement("button");
            btn.className = "popup-user-btn" + (user === tClient.user ? " active" : "");
            btn.textContent = user;
            container.appendChild(btn);
        }

        container.addEventListener("click", (event) => {
            if (event.target.tagName !== "BUTTON") return;
            if (event.target.classList.contains("active")) return;

            container.querySelector(".active")?.classList.remove("active");
            event.target.classList.add("active");

            this.changeModuleSettings(event.target.textContent);
            trackerSocket.sendNotification("CHANGE_USER_X", { client: this.clientConfig.name, user: event.target.textContent });
        });

        return container;
    }

    async fetchAndStoreUserConfig(client, user) {
        if (this.userConfigs.find(c => c.name === user)) return;
        const config = await fetchUserConfig(client, user);
        this.userConfigs.push(config);
    }

    changeModuleSettings(userName) {
        this.tClientData.user = userName;
        this.moduleSettingsElement();
    }

    notificationReceived(notification, payload) {
        if (notification === "SHOW_CLIENT_DETAILES") {
            this.showPopup(payload);
        }
    }
}

window.clientDetailes = clientDetailes;

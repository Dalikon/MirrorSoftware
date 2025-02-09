class clientDetailes extends Module {
    /*
    start() {

    }
    */

    defaults() {
        this.userConfigs = [];
    }

    async showPopup(targetClient) {
        //Use fetchConfig from (client).js to fetch the confing of a client that the detailes needs to be displayed
        this.clientConfig = await fetchConfig(targetClient.name, true);
        this.tClientData = targetClient;

        // Remove existing popup if it exists
        const existingPopup = document.getElementById("popup");
        if (existingPopup) {
            existingPopup.remove();
        }

        // Create the popup container
        const popup = document.createElement("div");
        popup.id = "popup";

        // Append the popup to the document body
        let topLayer = document.getElementById("all-regions")
        topLayer.appendChild(popup);

        // Create the popup title
        const popupTitle = document.createElement("h2");
        popupTitle.textContent = this.tClientData.name;
        popup.appendChild(popupTitle);

        // Status of the client (offline/online)
        const popupStatus = document.createElement("p");
        popupStatus.textContent = `Status: ${this.tClientData.status}`;
        popup.appendChild(popupStatus);

        // all connection the client has
        const connections = this.connectionsElement(this.tClientData);
        popup.appendChild(connections);

        //for every module add its info and controls to the popup
        //create the div now and then search for it by id elsewhere
        const moduleSettings = document.createElement("div");
        moduleSettings.id = "moduleSettings";
        popup.appendChild(moduleSettings);

        //fill the div
        this.moduleSettingsElement();

        //button for every user with the one in use being highlighted
        const usersDiv = await this.userButtonsElement(targetClient);
        popup.appendChild(usersDiv);

        // Add a close button
        const closeButton = document.createElement("button");
        closeButton.textContent = "Close";
        closeButton.id = "close-popup"
        closeButton.addEventListener("click", () => {
            popup.remove();
        });
        popup.appendChild(closeButton);

        popup.classList.add("show");
    }

    connectionsElement(client) {
        const connectionsDiv = document.createElement("div");
        for (let connection of client.connections) {
            const connectionDiv = document.createElement("div");

            const addressParagraph = document.createElement("p");
            const addressSpan = document.createElement("span");
            addressSpan.textContent = connection.ip;
            addressParagraph.textContent = "Address: ";
            addressParagraph.appendChild(addressSpan);
            connectionDiv.appendChild(addressParagraph);

            const connectedAtParagraph = this.connectedElement(connection);
            connectionDiv.appendChild(connectedAtParagraph);

            connectionsDiv.appendChild(connectionDiv);
        }
        return connectionsDiv;
    }

    moduleSettingsElement() {
        const moduleSettings = document.getElementById("moduleSettings");
        moduleSettings.innerHTML = "";

        if (this.tClientData.user === "default") {
            for (let [index, moduleConfig] of this.clientConfig.defaultModules.entries()) {
                const moduleControl = this.moduleControlElement(this.clientConfig.name, moduleConfig, index);
                moduleSettings.appendChild(moduleControl)
            }
        } else {
            let userConfig = this.userConfigs.find((config) => config.name === this.tClientData.user);
            for (let [index, moduleConfig] of userConfig.modules.entries()) {
                const moduleControl = this.moduleControlElement(this.clientConfig.name, moduleConfig, index);
                moduleSettings.appendChild(moduleControl)
            }
        }
    }

    moduleControlElement(clientName, moduleConfig, index) {
        const moduleID = `${moduleConfig.module}_${index}`;

        const moduleDiv = document.createElement("div")
        moduleDiv.classList.add("popupModule")

        //name of the module
        const moduleName = document.createElement("h3");
        moduleName.textContent = moduleConfig.module;
        moduleDiv.appendChild(moduleName);

        //position of module
        const modulePos = document.createElement("p");
        modulePos.textContent = moduleConfig.position;
        moduleDiv.appendChild(modulePos);

        //button to hide the module. Afer use, it will transform to show.
        const hideShowButton = document.createElement("button");
        hideShowButton.textContent = "Hide";
        hideShowButton.addEventListener("click", () => {
            if (hideShowButton.textContent === "Hide") {
                trackerSocket.sendNotification("HIDE_MODULE_X", {module: moduleConfig.module, id: moduleID, client: clientName})
                hideShowButton.textContent = "Show";
            } else {
                trackerSocket.sendNotification("SHOW_MODULE_X", {module: moduleConfig.module, id: moduleID, client: clientName})
                hideShowButton.textContent = "Hide";
            }
        });
        moduleDiv.appendChild(hideShowButton);

        //button to suspend the module. After use, it will transform to resume.
        const susResButton = document.createElement("button");
        susResButton.textContent = "Suspend";
        susResButton.addEventListener("click", () => {
            if (susResButton.textContent === "Suspend") {
                trackerSocket.sendNotification("SUSPEND_MODULE_X", {module: moduleConfig.module, id: moduleID, client: clientName})
                susResButton.textContent = "Resume";
            } else {
                trackerSocket.sendNotification("RESUME_MODULE_X", {module: moduleConfig.module, id: moduleID, client: clientName})
                susResButton.textContent = "Suspend";
            }
        });
        moduleDiv.appendChild(susResButton);

        return moduleDiv;
    }

    async userButtonsElement(tClient) {
        const container = document.createElement("div");

        for (let user of this.clientConfig.users) {
            const userButton = await this.userElement(user, this.clientConfig.name);
            if (user === tClient.user) {
                userButton.style.backgroundColor = "blue";
                userButton.classList.add("active");
            }
            container.appendChild(userButton);
        }

        const defaultUser = document.createElement("button");
        defaultUser.textContent = "default";
        if (tClient.user === "default") {
            defaultUser.style.backgroundColor = "blue";
            defaultUser.classList.add("active");
        }
        container.appendChild(defaultUser);

        container.addEventListener("click", (event) => {
            if (event.target.tagName === "BUTTON") {
                if (event.target.classList.contains("active")) {
                    return;
                }

                // Find the currently active button inside the container
                const activeButton = container.querySelector(".active");

                if (activeButton) {
                    activeButton.classList.remove("active");
                    activeButton.style.backgroundColor = ""; // Reset to default
                }

                event.target.classList.add("active");
                event.target.style.backgroundColor = "blue";

                this.chageModuleSettings(event.target.textContent);

                console.log(`Sending notification to change user to ${event.target.textContent} on ${this.clientConfig.name}`)
                trackerSocket.sendNotification("CHANGE_USER_X", {client: this.clientConfig.name, user: event.target.textContent})
            }
        });

        return container;
    }

    async userElement(user, client) {
        const userConfig = await fetchConfig(client, false, true, user);
        this.userConfigs.push(userConfig);

        const userButton = document.createElement("button");
        userButton.textContent = user;

        return userButton;
    }


    connectedElement(client) {
        let connectedAt = formatTime(client.connectedAt);
        const connectedAtParagraph = document.createElement("p");
        const connectedAtSpan = document.createElement("span");
        connectedAtSpan.textContent = connectedAt;
        connectedAtParagraph.textContent = "Connected: ";
        connectedAtParagraph.appendChild(connectedAtSpan);
        return connectedAtParagraph;
    }

    chageModuleSettings(userName) {
        this.tClientData.user = userName
        this.moduleSettingsElement();
    }

    notificationReceived(notification, payload) {
        if (notification === "SHOW_CLIENT_DETAILES") {
            this.showPopup(payload);
        }
    }
}

window.clientDetailes = clientDetailes;

class clientDisplay extends Module {
    async start() {
        setInterval(() => {this.updateDom()}, 3000)
    }

    async defaults() {
        this.defaults = {};
        this.rootSocket = trackerSocket.socket;
    }

    //retrieve trackers from server
    async getTrackers() {
        try {
            await new Promise((resolve, reject) => {
                this.rootSocket.emit("retrieveTrackers");

                this.rootSocket.once("trackersData", (trackers) => {

                    if (trackers) {
                        console.debug("Received trackers from server");
                        this.trackedC = trackers;
                        resolve();  // Resolve the promise when trackers data is received
                    } else {
                        reject(new Error("Failed to retrieve trackers"));
                    }
                });
            });
        } catch (error) {
            console.error("Error preloading trackers:", error);
            this.trackedC = []; // Default to an empty array on failure
        }
    }


    async createDom() {

        await this.getTrackers()

        const clientContainer = document.createElement("div");
        clientContainer.id = "client-container"; //apply css

        //for each client create a bubble.
        this.trackedC.forEach((tClient) => {
            // Create the parent div for the client
            const clientDiv = document.createElement("div");
            clientDiv.classList.add("client-div");
            clientDiv.dataset.clientId = tClient.id;

            // Create and append the client name
            const clientName = document.createElement("h4");
            clientName.textContent = tClient.name;
            clientDiv.appendChild(clientName);

            // Create and append the client status
            let statusParagraph = this.statusElement(tClient);
            clientDiv.appendChild(statusParagraph);

            //If client is online, show when the fitst connection was created
            //Else append the time of last dissconnect.
            if (tClient.status === "online") {
                let connectedAtParagraph = this.connectedElement(tClient);
                clientDiv.appendChild(connectedAtParagraph);
            } else {
                let lastOnlineAtParagraph = this.lastOnlineElement(tClient);
                clientDiv.appendChild(lastOnlineAtParagraph);
            }

            //Type of the client (mirror or dashboar)
            let typeParagraph = this.typeElement(tClient);
            clientDiv.appendChild(typeParagraph);

            //Number of connected clients
            let connectionsParagraph = this.connectionNumElement(tClient);
            clientDiv.appendChild(connectionsParagraph);

            //What user is currently displayed in the client
            const userParagraph = this.loggedUserElement(tClient);
            clientDiv.appendChild(userParagraph);

            // Create and append the "View Details" button
            // It is an trigger for clientDetailes module
            const viewButton = document.createElement("button");
            viewButton.textContent = "View Details";
            viewButton.classList.add("view-client");
            viewButton.dataset.clientName = tClient.name;
            viewButton.addEventListener("click", () => {
                //Notify clientDetailes module to create a popup
                //Send the tracker data for concrete client as payload
                this.sendNotification("SHOW_CLIENT_DETAILES", tClient);
            });
            clientDiv.appendChild(viewButton);

            // Append the clientDiv to the container
            clientContainer.appendChild(clientDiv);
        });

        return clientContainer;
    }

    statusElement(tclient) {
        const statusParagraph = document.createElement("p");
        const statusSpan = document.createElement("span");
        statusSpan.textContent = tclient.status;
        statusSpan.classList.add(tclient.status === "online" ? "online" : "offline");
        statusParagraph.textContent = "Status: ";
        statusParagraph.appendChild(statusSpan);
        return statusParagraph;
    }

    lastOnlineElement(tclient) {
        let lastOnlineAt = formatTime(tclient.lastOnline);
        const lastOnlineAtParagraph = document.createElement("p");
        const lastOnlineAtSpan = document.createElement("span");
        lastOnlineAtSpan.textContent = lastOnlineAt;
        lastOnlineAtParagraph.textContent = "Last seen: ";
        lastOnlineAtParagraph.appendChild(lastOnlineAtSpan);
        return lastOnlineAtParagraph
    }

    connectedElement(tclient) {
        let connectedAt = formatTime(tclient.connectedAt);
        const connectedAtParagraph = document.createElement("p");
        const connectedAtSpan = document.createElement("span");
        connectedAtSpan.textContent = connectedAt;
        connectedAtParagraph.textContent = "Connected: ";
        connectedAtParagraph.appendChild(connectedAtSpan);
        return connectedAtParagraph;
    }

    loggedUserElement(tclient) {
        const loggedUserParagraph = document.createElement("p");
        const loggedUserSpan = document.createElement("span");
        loggedUserSpan.textContent = tclient.user;
        loggedUserParagraph.textContent = "Logged user: ";
        loggedUserParagraph.appendChild(loggedUserSpan);
        return loggedUserParagraph;
    }

    connectionNumElement(tclient) {
        const connectionsParagraph = document.createElement("p");
        const connectionsSpan = document.createElement("span");
        connectionsSpan.textContent = tclient.connections.length;
        connectionsParagraph.textContent = "Connections: ";
        connectionsParagraph.appendChild(connectionsSpan);
        return connectionsParagraph;
    }

    typeElement(tclient) {
        const typeParagraph = document.createElement("p");
        const typeSpan = document.createElement("span");
        typeSpan.textContent = tclient.type;
        typeParagraph.textContent = "Type: ";
        typeParagraph.appendChild(typeSpan);
        return typeParagraph;
    }

}

window.clientDisplay = clientDisplay;

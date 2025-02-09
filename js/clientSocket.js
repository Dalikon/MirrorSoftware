class ClientSocket {
    constructor(moduleName, query = null) {
        if (typeof moduleName !== "string") {
            throw new Error("Please set the module name for the ClientSocket.");
        }

        this.moduleName = moduleName;
        this.query = query

        let base = "/";
        if (typeof config !== "undefined" && typeof config.basePath !== "undefined") {
            base = config.basePath;
        }

        if (moduleName !== "/") {
            this.socket = io(`/${this.moduleName}`, {
                path: `${base}socket.io`
            });
        } else {
            this.socket = io('/', {
                path: `/socket.io`,
                query: this.query
            });
        }

        this.notificationCallback = function () {};

        const onevent = this.socket.onevent;
        this.socket.onevent = (packet) => {
            console.debug("ClientSocket Receiced packet: ", packet);
            if (packet && packet.data) {
                const args = packet.data || [];
                onevent.call(this.socket, packet); // original call
                packet.data = ["*"].concat(args);
                onevent.call(this.socket, packet); // additional call to catch-all
            }
        };

        // register catch all.
        this.socket.on("*", (notification, payload) => {
            if (notification !== "*") {
                this.notificationCallback(notification, payload);
            }
        });
    }

    // Public Methods
    setNotificationCallback(callback) {
        this.notificationCallback = callback;
    }

    sendNotification(notification, payload) {
        this.socket.emit(notification, payload);
    }
};

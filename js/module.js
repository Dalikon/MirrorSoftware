class Module {
    constructor() {
        this.defaults();
    }

    /**
     * Setting the default configs
     */
    defaults() {
        this.defaults = {};
    }

    /**
     *
     */
    getScripts() {
        return [];
    }

    /**
     *
     */
    getStyles() {
        return [];
    }

    /**
    * Start method called by main when it has set up the module.
    */
    async start() {
        console.log("module start");
    }

    /**
     * Method to create the dom for a module.
     */
    createDom() {
        console.log("module createDom");
    }

    /**
     * Callback when a client notification is received by this module
     * @param {string} - notification name of the notification
     * @param {string|object} - payload the payload of the notification
     * @param {string} - sender name of the module that sent out the notif
     */
    notificationReceived(notification, payload, sender) {
        if (sender) {
            console.log(this.name + " received a module notification: " + notification + " from sender: " + sender.name + " with payload: " + payload);
        } else {
            console.log(this.name + " received a system notification: " + notification + " with payload: " + payload);
        }
    }

    /**
     * Callback for recieving a notification from the helper
     * @param {string} - notification the name of the notification
     * @param {string|object} - payload the payload of the notification
     */
    socketNotificationReceived(notification, payload) {
        console.log(`${this.name} received a socket notification: ${notification} - Payload: ${payload}`);
    }

    /**
     * Called when the module is hidden
     */
    suspend() {
        console.log("module suspend")
    }

    /**
     * Called when the module is shown
     */
    resume() {
        console.log("module resume")
    }

    //Methods below shoud not need subclassing

    /**
     *
     */
    loadDependencies() {
        let dependencies = this.getScripts();
        let styles = this.getStyles();
        let dependenciesURL = [];
        let stylesURL = [];

        let urlPrefix = "";

        if (client.defModules.includes(this.name)) {
            urlPrefix = "/node_modules/";
        } else {
            urlPrefix = "/modules/" + this.name + "/node_modules/";
        }

        for (const dependencyURL of dependenciesURL) {
            client.loadFile(dependencyURL, "script");
        }

        for (const styleURL of stylesURL) {
            client.loadFile(styleURL, "style");
        }
    }

    /**
     * Create a socket for the module and set the socketNotificationReceived callback
     */
    createSocket() {
        if (typeof this.socket === "undefined") {
            this.socket = new ClientSocket(this.name);
        }

        this.socket.setNotificationCallback((notification, payload) => {
            this.socketNotificationReceived(notification, payload);
        });
    }

    /**
     * Request an update of the module with a client object
     * @param {number|object} [updataOptions] - specifics of the update
     */
    updateDom(updateOptions) {
        //console.log("module private updatedom")
        client.updateDom(this, updateOptions);
    }

    /**
     * Sends a notification to helper on server
     */
    sendSocketNotification(notification, payload) {
        this.socket.sendNotification(notification, payload);
    }

    /**
     * Sends notification to all modules
     */
    sendNotification(notification, payload) {
        client.sendNotification(notification, payload, this);
    }

    /**
     * Hides the module
     * @param {number} - speed how fast should the hide animation be
     * @param {Function} - callback called when the hiding is done
     * @param {object} - options optional settings for hiding
     */
    hide(speed, callback, options = {}) {
        let usedCallback = callback || function () {};

        if (typeof callback === "object") {
            Log.error("Parameter mismatch in module.hide: callback is not an optional parameter!");
            usedOptions = callback;
            usedCallback = function () {};
        }

        client.hideModule(this, speed, () => {this.suspend; usedCallback;}, options);
    }

    /**
     * Shows a hidden moule
     * @param {number} - speed how fast should the show animation be
     * @param {Function} - callback called when the show is done
     * @param {object} - options optional settings for show
     */
    show(speed, callback, options) {
        let usedCallback = callback || function () {};

        if (typeof callback === "object") {
            Log.error("Parameter mismatch in module.hide: callback is not an optional parameter!");
            usedOptions = callback;
            usedCallback = function () {};
        }

        client.showModule(this, speed, () => {this.resume; usedCallback;}, options);


    }

    /**
     * Sets the config for this module instance
     * @param {object} - config the configuration of this module
     */
    setConfig(config) {
        console.log("module private loadConfig");
        this.config = configMerge({}, this.defaults, config);
    }

    /**
     * Sets the data about this module generated by client
     * also creates the socket for it.
     * @param {object} - moduleInfo object containing all info about this module instance
     */
    setData(moduleInfo) {
        this.data = {}
        this.mInfo = moduleInfo;
        this.name = moduleInfo.name;
        this.id = moduleInfo.id;
        this.index = moduleInfo.index;
        this.hidden = moduleInfo.hiddenOnStartup;
        this.position = moduleInfo.position;
        this.classes = moduleInfo.classes;
        this.data.path = moduleInfo.folder;

        this.setConfig(moduleInfo.config);
        this.createSocket();
    }

}

/**
 * Merges two or more objects to one deeply
 */
function configMerge(result) {
    const stack = Array.prototype.slice.call(arguments, 1);
    let item, key;

    while (stack.length) {
        item = stack.shift();
        for (key in item) {
            if (item.hasOwnProperty(key)) {
                if (typeof result[key] === "object" && result[key] && Object.prototype.toString.call(result[key]) !== "[object Array]") {
                    if (typeof item[key] === "object" && item[key] !== null) {
                        result[key] = configMerge({}, result[key], item[key]);
                    } else {
                        result[key] = item[key];
                    }
                } else {
                    result[key] = item[key];
                }
            }
        }
    }
    return result;
}


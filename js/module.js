/*export default */ class Module {
    constructor () {
        console.log("Module constructor")


        this.defaults = {
            defProp: "defProp",
            defProp2: "defProp2"
        }
    }

    start () {
        console.log("module init")
    }

    async start () {
        console.log("module start")
    }

    createDom (){
        console.log("module createDom")
    }

    notificationReceived (notification, payload, sender) {
        if (sender) {
            console.log(this.name + " received a module notification: " + notification + " from sender: " + sender.name + " with payload: " + payload);
		} else {
			console.log(this.name + " received a system notification: " + notification + " with payload: " + payload);
		}
    }

    socketNotificationReceived (notification, payload) {
        console.log(`${this.name} received a socket notification: ${notification} - Payload: ${payload}`);
    }

    suspend () {
        console.log("module suspend")
    }

    resume () {
        console.log("module resume")
    }

    //Methods below shoud not need subclassing

    createSocket () {
        if (typeof this.socket === "undefined") {
			this.socket = new ClientSocket(this.name);
		}

		this.socket.setNotificationCallback((notification, payload) => {
			this.socketNotificationReceived(notification, payload);
		});
    }

    updateDom(updateOptions) {
        console.log("module private updateDom")
    }

    sendSocketNotification(notification, payload) {
        console.log("module private sendSocketNotification")
        this.socket.sendNotification(notification, payload);
    }

    sendNotification (notification,  payload) {
        console.log("module sending client notification")
        client.sendNotification(notification, payload, this);
    }

    hide (speed, callback, options={}) {
        console.log("module private hide")
    }

    show (speed, callback, options) {
        console.log("module private show")
    }

    setConfig (config) {
        console.log("module private loadConfig");
        this.config = configMerge({}, this.defaults, config);
    }

    setData (moduleInfo) {
        this.mInfo = moduleInfo;
        this.name = moduleInfo.name;
        this.id = moduleInfo.id;
        this.index = moduleInfo.index;
        this.hidden = moduleInfo.hiddenOnStartup;
        this.position = moduleInfo.position;
        this.classes = moduleInfo.classes;

        this.setConfig(moduleInfo.config);
        this.createSocket();
    }

}

function configMerge (result) {
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


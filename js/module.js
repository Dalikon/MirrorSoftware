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
        console.log("module notificationReceived")
    }

    socketNotificationReceived (notification, payload) {
        console.log("module socketNotificationReceived")
    }

    suspend () {
        console.log("module suspend")
    }

    resume () {
        console.log("module resume")
    }

    //Methods below shoud not need subclassing

    socket () {
        console.log("module private socket")
    }

    updateDom(updateOptions) {
        console.log("module private updateDom")
    }

    sendSocketNotification(notification, payload) {
        console.log("module private sendSocketNotification")
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


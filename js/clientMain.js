//part of all client index.html files
//from concrete clientConfig (which should be in clients index.html) will add scripts to the it's html file and get them from core
//
//loads client config variables (already defined variable clientConfig)
//loads users listed in config (create an array of them with their mirror specific config)
//loads modules
    //searches the config for modules and create an array of all unique ones
    //at the client config modules for default screen
    //and for all users modules assigned to this mirror
    //(maybe check for modules with the same config so they are not loaded multiple times)
    //load the files from server (create a url and document.createElement("script"); it)
        //(maybe a general loader for css and other type of files)
//instanciate all modules (the name of the concrete module class should be the same as the name of the, so use new window[className]())
//starts all modules (and hide all user defined by default) by calling start() methods
//call createDom() for all modules (maybe just the mirror default at the beginnig, and then all when the hide/show is implemented) and build the page

class Client {
    constructor () {
        this.moduleObjs = [];
        this.modulesInfo = [];
        this.loadedModules = [];
        this.users = [];
	    this.modulePositions = ["top_bar", "top_left", "top_center", "top_right", "upper_third", "middle_center", "lower_third", "bottom_left", "bottom_center", "bottom_right", "bottom_bar", "fullscreen_above", "fullscreen_below"];
    }

    selectPosition (position) {
        const posClasses = position.replace("_", " ");
        const posDiv = document.getElementsByClassName(posClasses);
        if (posDiv.length > 0) {
            const wrapper = posDiv[0].getElementsByClassName("container");
            if (wrapper.length > 0) {
                return wrapper[0];
            }
        }
    }

    /**
	 * Checks for all positions if it has visible content.
	 * If not, if will hide the position to prevent unwanted margins.
	 * This method should be called by the show and hide methods.
	 *
	 * Example:
	 * If the top_bar only contains the update notification. And no update is available,
	 * the update notification is hidden. The top bar still occupies space making for
	 * an ugly top margin. By using this function, the top bar will be hidden if the
	 * update notification is not visible.
	 */

	updateWrapperStates () {
        this.modulePositions.forEach((position) => {
			const wrapper = this.selectPosition(position);
			const moduleWrappers = wrapper.getElementsByClassName("module");

			let showWrapper = false;
			Array.prototype.forEach.call(moduleWrappers, function (moduleWrapper) {
				if (moduleWrapper.style.position === "" || moduleWrapper.style.position === "static") {
					showWrapper = true;
				}
			});

			wrapper.style.display = showWrapper ? "block" : "none";
		});
	}

    hideModule (module, speed, callback, options = {}) {
        console.log(`Hiding module ${module.name} with id ${module.id}`)
        const moduleWrapper = document.getElementById(module.id);
        if (moduleWrapper !== null) {

            let haveAnimateName = null;
            if (haveAnimateName) {

            } else {
                moduleWrapper.style.transition = `opacity ${speed / 1000}s`;
                moduleWrapper.style.opacity = 0;
                moduleWrapper.classList.add("hidden");
                module.showHideTimer = setTimeout(() => {
                    moduleWrapper.style.position = "fixed";
                    this.updateWrapperStates();
                    if (typeof callback === "function") {
                        callback();
                    }
                }, speed);
            }
        } else {
            if (typeof callback === "function") {
                callback();
            }
        }
    }

    showModule (module, speed, callback, options = {}) {
        console.log(`Showing module ${module.name} with id ${module.id}`)
        const moduleWrapper = document.getElementById(module.id);
        if (moduleWrapper !== null) {
            let haveAnimateName = null;
            if (haveAnimateName) {

            } else {
                moduleWrapper.style.transition = `opacity ${speed / 1000}s`;
                moduleWrapper.style.position = "static";
                moduleWrapper.classList.remove("hidden");

                this.updateWrapperStates();
                const dummy = moduleWrapper.parentElement.parentElement.offsetHeight;

                moduleWrapper.style.opacity = 1;

                module.showHideTimer = setTimeout(() => {
                    if (typeof callback === "function") {
                        callback();
                    }
                }, speed);
            }
        } else {
            if (typeof callback === "function") {
                callback();
            }
        }


    }

    async loadModuleFile (url) {
        if (this.loadedModules.includes(url)) {
            return Promise.resolve()
        }

        return new Promise((resolve) => {
			console.log(`Load script: ${url}`);
			let script = document.createElement("script");
			script.type = "text/javascript";
			script.src = url;
			script.onload = function () {
				resolve();
			};
			script.onerror = function () {
				Log.error("Error on loading script:", url);
				resolve();
			};
			document.getElementsByTagName("body")[0].appendChild(script);
            this.loadedModules.push(url);
		});
    }

    loadModulesInfo () {
        this.clientConfig.defaultModules.forEach((moduleConfig, index) => {
            let moduleName = moduleConfig.module;
            let file = moduleName + ".js";
            let folder = "/modules/" + moduleName + "/";
            let id = `${moduleName}_${index}`;

            this.modulesInfo.push({
                index: index,
                id: id,
                name: moduleConfig.module,
                folder: folder,
                file: file,
                position: moduleConfig.position,
                hiddenOnStartup: moduleConfig.hiddenOnStartup,
                header: moduleConfig.header,
                config: moduleConfig.config,
                classes: (typeof moduleConfig.classes !== 'undefined' ? `${moduleConfig.classes} ${moduleName}` : moduleName)
            });
            console.log("module loaded")
        });

    }

    passInfoToModule (moduleObj, moduleInfo) {
        moduleObj.setData(moduleInfo);

        //start methods to load other dependencies and suff like translations and styles
    }

    async loadModule (moduleInfo) {
        const url = moduleInfo.folder + moduleInfo.file

        console.log("loading module file " + url)
        await this.loadModuleFile(url)

        console.log(moduleInfo.name)
        const module = new window[moduleInfo.name]()

        this.passInfoToModule(module, moduleInfo)

        this.moduleObjs.push(module)
        console.log("module loaded")
    }

    async loadModules () {
        console.log("loading modules")
        this.loadModulesInfo();

        for (let moduleInfo of this.modulesInfo) {
            console.log("loading module")
            await this.loadModule(moduleInfo);
        }

    }


    // create dom objects for modules with configured position
    createDomObjects () {
        this.moduleObjs.forEach((moduleObj, index) => {
            let newWrapper = moduleObj.createDom();
            console.log(moduleObj.classes)
            newWrapper.className = moduleObj.classes + " module";
            newWrapper.id = moduleObj.id;
            this.selectPosition(moduleObj.position).appendChild(newWrapper);
            //document.body.appendChild(newWrapper);
        })
    }

    sendNotification (notification, payload, sender, sendTo) {
        for (const module of this.moduleObjs) {
            if (module !== sender && (!sendTo || module === sendTo)) {
                module.notificationReceived(notification, payload, sender);
            }
        }
    }

    async startModules () {
        for (const module of this.moduleObjs) {
            module.start();
        }
    }

    async init () {
        console.log("fetching config")
        this.clientConfig = await fetchConfig();

        await this.loadModules();

        this.createDomObjects();

        await this.startModules();
    }

}

console.log("client is starting")
let client = new Client();
client.init();

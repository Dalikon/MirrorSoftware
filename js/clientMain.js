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

/*
 * This is the main class for the client side
 */
class Client {
    constructor() {
        //An array of running modules
        this.moduleObjs = [];

        //An array of information about the modules
        this.modulesInfo = [];

        //An array of module names that are fetched from the server
        this.loadedModules = [];

        //All users that have a conf file in the clients
        this.users = [];

        //All possible positions on screen
        this.modulePositions = ["top_bar", "top_left", "top_center", "top_right", "upper_third", "middle_center", "lower_third", "bottom_left", "bottom_center", "bottom_right", "bottom_bar", "fullscreen_above", "fullscreen_below"];

        this.defModules = ["clock"];
    }

    /**
     * From a position name returns the wrapper for said position
     * @param {string} - Position the wanted position
     * @returns {dom object} - The wrapper representing the position on screen
     */
    selectPosition(position) {
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
    updateWrapperStates() {
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

    /**
     * Hides the module from arguments
     * @param {object} - Module the module to hide
     * @param {number} - Speed number of ms for the hiding animation
     * @param {function} - Callback a callback function that is called after the module is hidden
     * @param {object} - Options an object containing optional options
     */
    hideModule(module, speed, callback, options = {}) {
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

    /**
     * Shows the hidden module from arguments
     * @param {object} - Module the module to show
     * @param {number} - Speed number of ms for the showing animation
     * @param {function} - Callback a callback function that is called after the module is shown
     * @param {object} - Options an object containing optional options
     */
    showModule(module, speed, callback, options = {}) {
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

    /**
     * Fetches a main module file from the server
     * @param {string} - Url the url where the file should be hosted
     * @param {string} - Type the type of loaded file
     */
    async loadFile(url, type) {
        if (type === "module" || type === "script") {
            if (type === "module") {
                if (this.loadedModules.includes(url)) {
                    return Promise.resolve();
                }
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
                if (type === "module") {
                    this.loadedModules.push(url);
                }
            });
        } else if (type === "style") {

        }
    }

    /**
     * For every module create an info object
     */
    loadModulesInfo() {
        configInUse.modules.forEach((moduleConfig, index) => {
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
                hidden: moduleConfig.hiddenOnStartup,
                header: moduleConfig.header,
                config: moduleConfig.config,
                classes: (typeof moduleConfig.classes !== 'undefined' ? `${moduleConfig.classes} ${moduleName}` : moduleName)
            });
        });

    }

    /**
     * Pass info to a corresponding module
     */
    passInfoToModule(moduleObj, moduleInfo) {
        moduleObj.setData(moduleInfo);

        //start methods to load other dependencies and suff like translations and styles
    }

    /**
     * Instanciate a module by it's info object
     * @param {object} - ModuleInfo An info object representing the module
     */
    async loadModule(moduleInfo) {
        const url = moduleInfo.folder + moduleInfo.file;

        console.log("Fetching module file " + url);
        await this.loadFile(url, "module");

        const module = new window[moduleInfo.name]();

        let moduleDependencies = module.getScripts();


        this.passInfoToModule(module, moduleInfo)

        this.moduleObjs.push(module)
        console.log(`Module loaded: ${module.name}`)
    }

    /**
     * Loading all modules
     */
    async loadModules() {
        console.log("Loading modules")
        this.loadModulesInfo();

        for (let moduleInfo of this.modulesInfo) {
            console.log(`Loading module: ${moduleInfo.name}`)
            await this.loadModule(moduleInfo);
        }

    }


    /**
     * Create dom objects for modules with configured position
     */
    createDomObjects() {
        this.moduleObjs.forEach((moduleObj, index) => {
            let newWrapper = moduleObj.createDom();
            newWrapper.className = moduleObj.classes + " module";
            newWrapper.id = moduleObj.id;
            this.selectPosition(moduleObj.position).appendChild(newWrapper);
        })
    }

    /**
     *
     */
    moduleNeedsUpdate(module, newContent) {
        const moduleWrapper = document.getElementById(module.id);
        if (moduleWrapper === null) {
            return false;
        }

        let contentNeedsUpdate = false;

        const tempContentWrapper = document.createElement("div");
        tempContentWrapper.appendChild(newContent);
        //console.log(moduleWrapper[0])
        contentNeedsUpdate = tempContentWrapper.innerHTML !== moduleWrapper.innerHTML

        return contentNeedsUpdate;
    }

    /**
     *
     */
    updateModuleContent(module, newContent) {
        let moduleWrapper = document.getElementById(module.id)
        if (moduleWrapper === null) {
            return;
        }
        moduleWrapper.innerHTML = "";
        moduleWrapper.appendChild(newContent);
    }

    /**
     *
     */
    updateDomWithContent(module, newContent) {
        if (module.hidden) {
            this.updateModuleContent(module);
            resolve();
            return;
        }

        if (!this.moduleNeedsUpdate(module, newContent)) {
            resolve();
            return;
        }

        this.updateModuleContent(module, newContent);
    }

    /**
     *
     */
    updateDom(module, updateOptions) {
        let newContentPromise = module.createDom();

        if (!(newContentPromise instanceof Promise)) {
            // convert to a promise if not already one to avoid if/else's everywhere
            newContentPromise = Promise.resolve(newContentPromise);
        }

        newContentPromise.then(function (newContent) {
            const updatePromise = this.updateDomWithContent(module, newContent);

            //updatePromise.then(resolve).catch((error) => console.error(error));
        }.bind(this)).catch((error) => console.error(error));
    }

    /**
     * Called by module eqivalent method. Sends the notification to all modules except the sender or only to sendTo
     * @param {string} - Notification The notification name
     * @param {string} - Payload the payload of the notification
     * @param {object} - Sender the module object that sends the notification
     * @param {object} - SendTo optional parameter that directs the notification to specific module
     */
    sendNotification(notification, payload, sender, sendTo) {
        for (const module of this.moduleObjs) {
            if (module !== sender && (!sendTo || module === sendTo)) {
                module.notificationReceived(notification, payload, sender);
            }
        }
    }

    /**
     * Calls start method for all modules
     */
    async startModules() {
        for (const module of this.moduleObjs) {
            module.start();
            console.log(`Module started: ${module.name}`)
        }
        this.sendNotification("ALL_MODULES_STARTED", "", {});
    }

    /**
     * Startup method
     */
    async init() {
        await this.loadModules();

        this.createDomObjects();

        await this.startModules();
    }

    async reload() {
        //empty the client.moduleObj array
        this.modulesInfo = [];

        //maybe later implement the end method?
        //suspend all modules (they are gonna be deleted)
        for (let module of this.moduleObjs) {
            module.suspend();
        }

        console.log(`MODULES: ${client.moduleObjs}`)
        client.moduleObjs = [];

        this.init();
    }
}

let client;
let clientConfig;
let userService;
let configInUse;
let freshRegions;

fetchConfig().then(conf => {
    console.log("Getting config");
    clientConfig = conf

    configInUse = {name: clientConfig.name, modules: clientConfig.defaultModules};

    console.log("UserService is starting");
    userService = new UserService();

    freshRegions = document.getElementById('all-regions').innerHTML;
    console.log(freshRegions)

    console.log("Client is starting");
    client = new Client();
    client.init();

    //setInterval(() => {
    //        setTimeout(() => {userService.changeUser(clientConfig.users[0])}, 15000);
    //        setTimeout(() => {userService.changeUser("default")}, 30000);
    //    }, 35000);
});


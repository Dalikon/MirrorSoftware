/*
 * Keep track of users in the client
 * Maybe instanciate as global, so it can manipulate client directly and do the auth by itself
 *
 * Has two modes, both triggered by module notification catched in clientMain directly.
 * Both modes will work the same in this UserService class, the only difference is how the notif is send.
 * 1. There is no mirror network
 *    so there will be special auth method(s)
 *    (type password would be usefull for dashboard, but idk about mirror, probably just nothing by default, but an option for a keypad or something to enter the password)
 *    and just listen in client for specific notification?
 * 2. There is a mirror network (aka the python server)
 *    so it gets it's auth and triggers from it.
 *
 * The basic working of the service will be:
 * 1. Recieval of the CH_USER notification with the name of the user as payload
 * 2a. Check if the user has been already displayed (there is an entry in the usersDisplay array with this name).
 * 2b. Send request to server for a user config (server could find out if there is client specific config or not).
 * 3. If the config has some auth method configured, wait for a AUTH_USER with the name of authorized user (it has to match with the one it is waiting for)
 * For some auth methods there could be routines that the service could do by itself (e.g. password)
 * 4. Change the displayed user accordingly to configured mode as seen below.
 *
 * To change a user it will do one of these things depending on client config option "userSwitchMode"
 * a) "Save"
 *    Save the current state of modules (aka client.moduleObjs array) with calling module.suspend().
 *    Turn the current DOM to empty state.
 *    Search if needed user has suspended modules in the UserService object.
 *    if yes, then call module.resume() and with module.createDom() recreate the DOM of the chosen user.
 *    Then retun the new user array to client (override it).
 *    if no, then trigger instanciating in client as usual (just change the configs).
 * b) "Delete"
 *    Delete current client.moduleObj().
 *    Turn the current DOM to empty state.
 *    Instanciate new modules accoring to config of chosen user.
 */


/**
 * This class role is to switch the displayed user profile,
 * keep all necessery info about the users and their modules,
 * and to make switching more secure
 */
class UserService {
    constructor() {
        //if env variable if in SAVE or DELETE mode
        if (clientConfig.userSwitchMode === "SAVE") {
            this.userModulesStorage = []; //save mode, saves the moduleObj of the current user (aka an array of arrays of module objects)
        } else {
            if (clientConfig.userSwitchMode !== "DELETE") console.warn("Not existing option for userSwitchMode. Using default DELETE")
            this.userConfigStorage = []; //delete mode, saves the configs so it does not have to ask the server for the
            //config every time it wants to switch to the user (aka array of userConfig objects)
        }

        //this.defaultConfig = {name: clientConfig.name, modules: clientConfig.defaultModules};
        this.activeUser = clientConfig.name;
    }

    changeUser(userName) {
        if (clientConfig.userSwitchMode === "SAVE") {
            changeUserSAVE(userName);
        } else {
            this.changeUserDELETE(userName);
        }
    }

    changeUserSAVE(userName) {
        let user = this.findUser(userName);

    }

    async changeUserDELETE(userName) {
        let user = await this.findUserConfig(userName);

        //empty the DOM
        resetDOM();

        //change the value of configInUse to user
        configInUse = user;
        console.log(`MODULES: ${client.moduleObjs}`)

        //kickstart the loading process again by client.init()
        console.log(`READY TO ROLL FOR USER ${user.name}`)
        client.reload();
    }

    async findUserConfig(userName) {
        let user;

        if (clientConfig.userSwitchMode === "SAVE") {
            user = this.userModulesStorage.find(user => user.name === userName);
        } else {
            if (userName === "default") {
                user = {name: clientConfig.name, modules: clientConfig.defaultModules};
            } else {
                user = this.userConfigStorage.find(user => user.name === userName);
            }
        }

        if (!user) {
            //call the server using fetch to find and return said user.json file
            //primarly search for client specific, then general
            const response = await fetch(`/get-user/${userName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: `${clientConfig.name}`
            });

            const data = await response.json();
            user = data;

            if (clientConfig.userSwitchMode === "SAVE") {
                this.userModulesStorage.push({name: user.name, moduleObjs: []});
            } else {
                this.userConfigStorage.push(user);
            }
        }
        return user
    }
}

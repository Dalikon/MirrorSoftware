export default class Module {
    constructor () {
        console.log("Module constructor")
    }

    init () {
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

}


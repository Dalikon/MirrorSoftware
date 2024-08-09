class helloworld extends Module {
    createDom () {
        const wrapper = document.createElement("div");
        //console.log(this.config.text)
        wrapper.innerHTML = this.config.text;

        return wrapper
    }

    async start () {
        //this.sendSocketNotification("AHOJ", "SVETE");
        this.sendNotification("JEE", "EEJ");
    }

}

window.helloworld = helloworld;

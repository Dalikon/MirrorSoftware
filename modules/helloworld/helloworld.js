class helloworld extends Module {
    createDom () {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = this.config.text;

        return wrapper
    }

    async start () {
        //this.sendSocketNotification("AHOJ", "SVETE");
        this.sendNotification("JEE", "EEJ");
        if (this.index === 2) {
                this.interval = setInterval(() => {
                    this.hide(1000,function(){});
                    setTimeout(() => {this.show(1000,function(){})},5000);
                }, 7000);
        }
    }

    suspend () {
        clearInterval(this.interval)
    }

    resume () {
        this.interval = setInterval(() => {
            this.hide(1000,function(){});
            setTimeout(() => {this.show(1000,function(){})},5000);
        }, 7000);
    }
}

window.helloworld = helloworld;

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
        console.log(this.index);
        if (this.index === 2) {
                setInterval(() => {
                    this.hide(1000,function(){});
                    setTimeout(() => {this.show(1000,function(){})},5000);
                }, 7000);
        }
    }
}

window.helloworld = helloworld;

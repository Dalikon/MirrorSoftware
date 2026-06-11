class helloworld extends Module {
    createDom() {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = this.config.text;

        return wrapper
    }

    async start() {
        //this.sendSocketNotification("AHOJ", "SVETE");
        this.sendNotification("JEE", "EEJ");

        if (this.index === 2) {
            setTimeout(() => {
                this.sendNotification("SHOW_ALERT", {
                    type: "notification",
                    title: "Hello from helloworld",
                    message: "Alert module is working!",
                    timer: 5000
                });
            }, 3000);

            setTimeout(() => {
                this.sendNotification("SHOW_ALERT", {
                    type: "alert",
                    title: "Blocking Alert",
                    message: "This one blurs the background. Click to dismiss.",
                    sender: "helloworld",
                    timer: 8000
                });
            }, 9000);
        }

        /*if (this.index === 2) {
            this.interval = setInterval(() => {
                this.hide(1000, function () {});
                setTimeout(() => {this.show(1000, function () {})}, 5000);
            }, 7000);
        }*/
    }

    suspend() {
        clearInterval(this.interval)
    }

    resume() {
        this.interval = setInterval(() => {
            this.hide(1000, function () {});
            setTimeout(() => {this.show(1000, function () {})}, 5000);
        }, 7000);
    }
}

window.helloworld = helloworld;

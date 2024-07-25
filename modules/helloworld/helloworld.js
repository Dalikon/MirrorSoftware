class helloworld extends Module {
    createDom () {
        const wrapper = document.createElement("div");
        console.log(this.config.text)
        wrapper.innerHTML = this.config.text;

        return wrapper
    }
}

window.helloworld = helloworld;

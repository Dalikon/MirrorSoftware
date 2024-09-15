class dbbutton extends Module {
    createDom () {
        const wrapper = document.createElement("div");
        let button = document.createElement("button");
        button.innerHTML = "click me";
        button.addEventListener("click", function() {
            alert("Button clicked!");
        });
        wrapper.innerHTML = button;
        return button
    }

    async start () {
        console.log("BUTTTTOOOONNN");
    }
}

window.dbbutton = dbbutton

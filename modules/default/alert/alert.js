/* global NotificationFx */

class AlertModule extends Module {
    constructor() {
        super();
        this.alerts = {};
    }

    defaults() {
        this.defaults = {
            effect: "slide",
            alert_effect: "jelly",
            display_time: 3500,
            position: "center",
            welcome_message: false
        };
    }

    getScripts() {
        return [this.file("notificationFx.js")];
    }

    getStyles() {
        return [
            this.file("styles/notificationFx.css"),
            this.file(`styles/${this.config.position}.css`)
        ];
    }

    start() {
        console.log(`Starting module: ${this.name}`);

        if (this.config.effect === "slide") {
            this.config.effect = `${this.config.effect}-${this.config.position}`;
        }

        if (this.config.welcome_message) {
            const message = typeof this.config.welcome_message === "string"
                ? this.config.welcome_message
                : "Welcome!";
            this.showNotification({ title: "System", message });
        }
    }

    notificationReceived(notification, payload) {
        if (notification === "SHOW_ALERT") {
            if (payload.type === "notification") {
                this.showNotification(payload);
            } else {
                this.showAlert(payload);
            }
        } else if (notification === "HIDE_ALERT") {
            this.hideAlert(payload);
        }
    }

    showNotification(notification) {
        new NotificationFx({
            message: this.renderNotification(notification),
            layout: "growl",
            effect: this.config.effect,
            ttl: notification.timer || this.config.display_time
        }).show();
    }

    showAlert(alert) {
        const senderName = alert.sender || "alert";

        if (this.alerts[senderName]) {
            this.hideAlert({ sender: senderName }, false);
        }

        if (!Object.keys(this.alerts).length) {
            this.toggleBlur(true);
        }

        this.alerts[senderName] = new NotificationFx({
            message: this.renderAlert(alert),
            effect: this.config.alert_effect,
            ttl: alert.timer,
            onClose: () => this.hideAlert({ sender: senderName }),
            al_no: "ns-alert"
        });

        this.alerts[senderName].show();

        if (alert.timer) {
            setTimeout(() => {
                this.hideAlert({ sender: senderName });
            }, alert.timer);
        }
    }

    hideAlert(payload, close = true) {
        const senderName = payload?.sender || "alert";
        if (this.alerts[senderName]) {
            this.alerts[senderName].dismiss(close);
            delete this.alerts[senderName];
            if (!Object.keys(this.alerts).length) {
                this.toggleBlur(false);
            }
        }
    }

    renderNotification(data) {
        let html = "";
        if (data.title) {
            html += `<span class="thin dimmed medium">${this.escapeHtml(data.title)}</span>`;
        }
        if (data.message) {
            if (data.title) html += "<br />";
            html += `<span class="light bright small">${this.escapeHtml(data.message)}</span>`;
        }
        return html;
    }

    renderAlert(data) {
        let html = "";
        if (data.imageUrl) {
            const height = data.imageHeight || "80px";
            html += `<img src="${this.escapeHtml(data.imageUrl)}" height="${this.escapeHtml(height)}" style="margin-bottom:10px" /><br />`;
        }
        if (data.title) {
            html += `<span class="thin dimmed medium">${this.escapeHtml(data.title)}</span>`;
        }
        if (data.message) {
            if (data.title) html += "<br />";
            html += `<span class="light bright small">${this.escapeHtml(data.message)}</span>`;
        }
        return html;
    }

    escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    toggleBlur(add = false) {
        const method = add ? "add" : "remove";
        for (const el of document.querySelectorAll(".module")) {
            el.classList[method]("alert-blur");
        }
    }
}

window["alert"] = AlertModule;

/**
 * Based on work by
 *
 * notificationFx.js v1.0.0
 * https://tympanus.net/codrops/
 *
 * Licensed under the MIT license.
 * https://opensource.org/licenses/mit-license.php
 *
 * Copyright 2014, Codrops
 * https://tympanus.net/codrops/
 * @param {object} window The window object
 */
(function (window) {

	function extend (a, b) {
		for (let key in b) {
			if (b.hasOwnProperty(key)) {
				a[key] = b[key];
			}
		}
		return a;
	}

	function NotificationFx (options) {
		this.options = extend({}, this.options);
		extend(this.options, options);
		this._init();
	}

	NotificationFx.prototype.options = {
		wrapper: document.body,
		message: "yo!",
		layout: "growl",
		effect: "slide",
		type: "notice",
		ttl: 6000,
		al_no: "ns-box",
		onClose () { return false; },
		onOpen () { return false; }
	};

	NotificationFx.prototype._init = function () {
		this.ntf = document.createElement("div");
		this.ntf.className = `${this.options.al_no} ns-${this.options.layout} ns-effect-${this.options.effect} ns-type-${this.options.type}`;
		let strinner = "<div class=\"ns-box-inner\">";
		strinner += this.options.message;
		strinner += "</div>";
		this.ntf.innerHTML = strinner;

		this.options.wrapper.insertBefore(this.ntf, this.options.wrapper.nextSibling);

		if (this.options.ttl) {
			this.dismissttl = setTimeout(() => {
				if (this.active) {
					this.dismiss();
				}
			}, this.options.ttl);
		}

		this._initEvents();
	};

	NotificationFx.prototype._initEvents = function () {
		this.ntf.querySelector(".ns-box-inner").addEventListener("click", () => {
			this.dismiss();
		});
	};

	NotificationFx.prototype.show = function () {
		this.active = true;
		this.ntf.classList.remove("ns-hide");
		this.ntf.classList.add("ns-show");
		this.options.onOpen();
	};

	NotificationFx.prototype.dismiss = function (close = true) {
		this.active = false;
		clearTimeout(this.dismissttl);
		this.ntf.classList.remove("ns-show");
		setTimeout(() => {
			this.ntf.classList.add("ns-hide");
			if (close) this.options.onClose();
		}, 25);

		const onEndAnimationFn = (ev) => {
			if (ev.target !== this.ntf) return false;
			this.ntf.removeEventListener("animationend", onEndAnimationFn);
			if (ev.target.parentNode === this.options.wrapper) {
				this.options.wrapper.removeChild(this.ntf);
			}
		};

		this.ntf.addEventListener("animationend", onEndAnimationFn);
	};

	window.NotificationFx = NotificationFx;
}(window));

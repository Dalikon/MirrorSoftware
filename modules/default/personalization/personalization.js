const POSITIONS = [
    "top_bar", "top_left", "top_center", "top_right",
    "upper_third", "middle_center", "lower_third",
    "bottom_left", "bottom_center", "bottom_right", "bottom_bar",
    "fullscreen_above", "fullscreen_below"
];

class personalization extends Module {
    getStyles() {
        return ["/css/personalization.css"];
    }

    defaults() {
        this.defaults = {};
        this.scope = "global";       // "global" or a client name
        this.configs = {};           // cache: { global: {...}, bathroom: {...} }
        this.assignedClients = [];
        this.availableModules = null;
        this.dirty = false;
        this.listEl = null;
        this.saveBtn = null;
    }

    async fetchScope(scope) {
        if (this.configs[scope]) return;
        const url = scope === "global" ? "/user/config" : `/user/config/${scope}`;
        const res = await fetch(url);
        this.configs[scope] = res.ok ? await res.json() : { modules: [] };
    }

    async fetchAssignedClients() {
        if (this.assignedClients.length) return;
        const res = await fetch("/user/clients");
        this.assignedClients = res.ok ? await res.json() : [];
    }

    async fetchAvailableModules() {
        if (this.availableModules) return;
        const res = await fetch("/user/modules/available");
        this.availableModules = res.ok ? await res.json() : [];
    }

    currentModules() {
        return this.configs[this.scope]?.modules ?? [];
    }

    async createDom() {
        await Promise.all([
            this.fetchScope("global"),
            this.fetchAssignedClients(),
        ]);

        const wrap = document.createElement("div");
        wrap.className = "pers-wrap";

        // Header
        const hdr = document.createElement("div");
        hdr.className = "pers-header";

        const left = document.createElement("div");
        left.className = "pers-header-left";

        const title = document.createElement("h3");
        title.className = "pers-title";
        title.textContent = "Your modules";
        left.appendChild(title);

        // Scope selector (only shown if the user is assigned to at least one client)
        if (this.assignedClients.length > 0) {
            const scopeSelect = document.createElement("select");
            scopeSelect.className = "pers-scope-select";

            const globalOpt = document.createElement("option");
            globalOpt.value = "global";
            globalOpt.textContent = "Global (fallback)";
            scopeSelect.appendChild(globalOpt);

            for (const client of this.assignedClients) {
                const opt = document.createElement("option");
                opt.value = client;
                opt.textContent = client;
                scopeSelect.appendChild(opt);
            }

            scopeSelect.value = this.scope;
            scopeSelect.addEventListener("change", async () => {
                if (this.dirty) {
                    const ok = confirm("You have unsaved changes. Switch scope and discard them?");
                    if (!ok) { scopeSelect.value = this.scope; return; }
                    this.dirty = false;
                }
                this.scope = scopeSelect.value;
                await this.fetchScope(this.scope);
                this.renderList();
                this.saveBtn.disabled = true;
                this.saveBtn.textContent = "Save changes";
            });

            left.appendChild(scopeSelect);
        }

        const btnRow = document.createElement("div");
        btnRow.className = "pers-header-btns";

        const addBtn = document.createElement("button");
        addBtn.className = "popup-btn";
        addBtn.textContent = "+ Add module";
        addBtn.addEventListener("click", () => this.showAddForm());

        this.saveBtn = document.createElement("button");
        this.saveBtn.className = "popup-btn pers-save-btn";
        this.saveBtn.textContent = "Save changes";
        this.saveBtn.disabled = true;
        this.saveBtn.addEventListener("click", () => this.save());

        btnRow.appendChild(addBtn);
        btnRow.appendChild(this.saveBtn);

        hdr.appendChild(left);
        hdr.appendChild(btnRow);
        wrap.appendChild(hdr);

        this.listEl = document.createElement("div");
        this.listEl.className = "pers-list";
        this.renderList();
        wrap.appendChild(this.listEl);

        return wrap;
    }

    renderList() {
        this.listEl.innerHTML = "";
        const modules = this.currentModules();

        if (!modules.length) {
            const empty = document.createElement("div");
            empty.className = "pers-empty";
            const msg = document.createElement("p");
            msg.className = "popup-empty";
            msg.textContent = this.scope === "global"
                ? "No modules configured yet."
                : `No overrides for ${this.scope} — uses global config.`;
            const hint = document.createElement("p");
            hint.className = "pers-empty-hint";
            hint.textContent = "Use \"+ Add module\" to build your layout.";
            empty.appendChild(msg);
            empty.appendChild(hint);
            this.listEl.appendChild(empty);
            return;
        }

        modules.forEach((mod, index) => {
            this.listEl.appendChild(this.renderRow(mod, index, modules.length));
        });
    }

    renderRow(mod, index, total) {
        const row = document.createElement("div");
        row.className = "pers-row";

        const reorder = document.createElement("div");
        reorder.className = "pers-reorder";

        const upBtn = document.createElement("button");
        upBtn.className = "pers-arrow";
        upBtn.textContent = "↑";
        upBtn.disabled = index === 0;
        upBtn.addEventListener("click", () => this.moveModule(index, -1));

        const downBtn = document.createElement("button");
        downBtn.className = "pers-arrow";
        downBtn.textContent = "↓";
        downBtn.disabled = index === total - 1;
        downBtn.addEventListener("click", () => this.moveModule(index, 1));

        reorder.appendChild(upBtn);
        reorder.appendChild(downBtn);
        row.appendChild(reorder);

        const main = document.createElement("div");
        main.className = "pers-main";

        const topRow = document.createElement("div");
        topRow.className = "pers-top-row";

        const nameEl = document.createElement("span");
        nameEl.className = "pers-name";
        nameEl.textContent = mod.module;
        topRow.appendChild(nameEl);

        const posSelect = document.createElement("select");
        posSelect.className = "pers-pos-select";
        for (const pos of POSITIONS) {
            const opt = document.createElement("option");
            opt.value = pos;
            opt.textContent = pos.replace(/_/g, " ");
            if (pos === (mod.position ?? "middle_center")) opt.selected = true;
            posSelect.appendChild(opt);
        }
        posSelect.addEventListener("change", () => {
            this.configs[this.scope].modules[index].position = posSelect.value;
            this.markDirty();
        });
        topRow.appendChild(posSelect);

        const hiddenLabel = document.createElement("label");
        hiddenLabel.className = "pers-hidden";
        const hiddenCb = document.createElement("input");
        hiddenCb.type = "checkbox";
        hiddenCb.checked = mod.hiddenOnStartup ?? false;
        hiddenCb.addEventListener("change", () => {
            this.configs[this.scope].modules[index].hiddenOnStartup = hiddenCb.checked;
            this.markDirty();
        });
        hiddenLabel.appendChild(hiddenCb);
        hiddenLabel.appendChild(document.createTextNode(" hidden"));
        topRow.appendChild(hiddenLabel);

        const delBtn = document.createElement("button");
        delBtn.className = "popup-btn pers-del";
        delBtn.textContent = "×";
        delBtn.title = "Remove module";
        delBtn.addEventListener("click", () => {
            this.configs[this.scope].modules.splice(index, 1);
            this.markDirty();
            this.renderList();
        });
        topRow.appendChild(delBtn);

        main.appendChild(topRow);

        if (mod.config && Object.keys(mod.config).length > 0) {
            main.appendChild(this.renderConfigEditor(mod.config, index));
        }

        row.appendChild(main);
        return row;
    }

    renderConfigEditor(config, moduleIndex) {
        const editor = document.createElement("div");
        editor.className = "pers-config";

        for (const [key, value] of Object.entries(config)) {
            const field = document.createElement("div");
            field.className = "pers-config-field";

            const label = document.createElement("label");
            label.className = "pers-config-label";
            label.textContent = key;
            field.appendChild(label);

            let input;
            if (typeof value === "boolean") {
                input = document.createElement("input");
                input.type = "checkbox";
                input.checked = value;
                input.addEventListener("change", () => {
                    this.configs[this.scope].modules[moduleIndex].config[key] = input.checked;
                    this.markDirty();
                });
            } else if (typeof value === "number") {
                input = document.createElement("input");
                input.type = "number";
                input.value = String(value);
                input.className = "pers-config-input";
                input.addEventListener("input", () => {
                    this.configs[this.scope].modules[moduleIndex].config[key] = Number(input.value);
                    this.markDirty();
                });
            } else {
                input = document.createElement("input");
                input.type = "text";
                input.value = String(value ?? "");
                input.className = "pers-config-input";
                input.addEventListener("input", () => {
                    this.configs[this.scope].modules[moduleIndex].config[key] = input.value;
                    this.markDirty();
                });
            }

            field.appendChild(input);
            editor.appendChild(field);
        }

        return editor;
    }

    async showAddForm() {
        this.listEl.querySelector(".pers-add-form")?.remove();
        await this.fetchAvailableModules();

        const form = document.createElement("div");
        form.className = "pers-add-form";

        const moduleSelect = document.createElement("select");
        moduleSelect.className = "pers-pos-select";
        for (const name of this.availableModules) {
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            moduleSelect.appendChild(opt);
        }

        const posSelect = document.createElement("select");
        posSelect.className = "pers-pos-select";
        for (const pos of POSITIONS) {
            const opt = document.createElement("option");
            opt.value = pos;
            opt.textContent = pos.replace(/_/g, " ");
            if (pos === "middle_center") opt.selected = true;
            posSelect.appendChild(opt);
        }

        const addBtn = document.createElement("button");
        addBtn.className = "popup-btn pers-add-confirm";
        addBtn.textContent = "Add";
        addBtn.addEventListener("click", () => {
            if (!this.configs[this.scope]) this.configs[this.scope] = { modules: [] };
            this.configs[this.scope].modules.push({
                module: moduleSelect.value,
                position: posSelect.value,
                config: {},
            });
            this.markDirty();
            this.renderList();
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.className = "popup-btn";
        cancelBtn.textContent = "Cancel";
        cancelBtn.addEventListener("click", () => form.remove());

        form.appendChild(moduleSelect);
        form.appendChild(posSelect);
        form.appendChild(addBtn);
        form.appendChild(cancelBtn);

        this.listEl.appendChild(form);
        moduleSelect.focus();
    }

    moveModule(index, direction) {
        const mods = this.configs[this.scope].modules;
        const target = index + direction;
        if (target < 0 || target >= mods.length) return;
        [mods[index], mods[target]] = [mods[target], mods[index]];
        this.markDirty();
        this.renderList();
    }

    markDirty() {
        this.dirty = true;
        if (this.saveBtn) {
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = "Save changes";
        }
    }

    async save() {
        if (!this.saveBtn) return;
        this.saveBtn.disabled = true;
        this.saveBtn.textContent = "Saving…";

        const url = this.scope === "global" ? "/user/config" : `/user/config/${this.scope}`;
        const res = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modules: this.configs[this.scope]?.modules ?? [] }),
        });

        if (res.ok) {
            this.dirty = false;
            this.saveBtn.textContent = "Saved!";
            setTimeout(() => {
                if (!this.dirty && this.saveBtn) {
                    this.saveBtn.textContent = "Save changes";
                    this.saveBtn.disabled = true;
                }
            }, 2000);
        } else {
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = "Save failed";
            setTimeout(() => {
                if (this.saveBtn) this.saveBtn.textContent = "Save changes";
            }, 2000);
        }
    }

    notificationReceived() {}
}

window.personalization = personalization;

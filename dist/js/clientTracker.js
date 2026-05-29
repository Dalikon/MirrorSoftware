"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ClientTracker {
    name;
    type;
    lastOnline;
    connectedAt;
    status;
    user;
    connections;
    constructor(name, type, lastOnline = null, connectedAt = null, status = "online", connections = [], user = "default") {
        this.name = name;
        this.type = type;
        this.lastOnline = lastOnline ? new Date(lastOnline) : null;
        this.connectedAt = connectedAt ? new Date(connectedAt) : null;
        this.status = status;
        this.user = user;
        this.connections = connections;
    }
    static fromObject(obj) {
        return new ClientTracker(obj.name, obj.type, obj.lastOnline, obj.connectedAt, obj.status, obj.connections, obj.user);
    }
    start() { }
    end() { }
}
exports.default = ClientTracker;

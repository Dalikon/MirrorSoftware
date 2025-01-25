class clientTracker {
    constructor(name, type, lastOnline = null, connectedAt = null, status = "online", connections = []) {
        this.name = name;
        this.type = type;
        this.lastOnline = lastOnline ? new Date(lastOnline) : null;
        this.connectedAt = connectedAt ? new Date(connectedAt) : null;
        this.status = status;
        this.connections = connections;
    }

    static fromObject(obj) {
        return new clientTracker(
            obj.name,
            obj.type,
            obj.lastOnline,
            obj.connectedAt,
            obj.status,
            obj.connections
        );
    }

    start() {

    }

    end() {

    }
};

module.exports = clientTracker;


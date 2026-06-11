export type ClientPermission =
    // Browser APIs
    | "geo.location"
    | "notifications.send"
    | "camera"
    | "microphone"
    | "network.http"
    | "network.ws"
    // App-level
    | "user.name"
    | "user.switch";

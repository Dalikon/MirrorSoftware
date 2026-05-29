import type { UserSwitchMode } from "./config";
export type ModulePosition = "top_bar" | "top_left" | "top_center" | "top_right" | "upper_third" | "middle_center" | "lower_third" | "bottom_left" | "bottom_center" | "bottom_right" | "bottom_bar" | "fullscreen_above" | "fullscreen_below";
export type ClientType = "mirror" | "dashboard";
export interface ModuleDefinition {
    module: string;
    position: ModulePosition;
    classes?: string;
    config?: Record<string, unknown>;
    hiddenOnStartup?: boolean;
    header?: string;
}
export interface ModuleInfo {
    index: number;
    id: string;
    name: string;
    folder: string;
    file: string;
    position: ModulePosition;
    hiddenOnStartup?: boolean;
    hidden?: boolean;
    header?: string;
    config?: Record<string, unknown>;
    classes: string;
}
export interface ClientConfig {
    name: string;
    type: ClientType;
    userSwitchMode: UserSwitchMode;
    users: string[];
    defaultModules: ModuleDefinition[];
}
export interface UserConfig {
    name: string;
    modules: ModuleDefinition[];
}

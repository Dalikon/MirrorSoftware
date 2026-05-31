import type { HelperPermission } from "./HelperPermission.js";

export type ModuleManifest = {
  name: string;
  version?: string;

  helper: {
    permissions: HelperPermission[]; 
  };

  client: {
    //permissions: ClientPermission[];
    permissions: string[];
  };
};

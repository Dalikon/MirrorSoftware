import type { HelperPermission } from "./HelperPermission.js";
import type { ClientPermission } from "./ClientPermission.js";

export type ModuleManifest = {
  name: string;
  version?: string;

  helper: {
    permissions: HelperPermission[];
  };

  client: {
    permissions: ClientPermission[];
  };
};

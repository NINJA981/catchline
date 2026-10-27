// The slice of the `chrome` extension API the e2e tests call inside the service worker through
// `worker.evaluate(...)`. The callbacks run in the extension, not in Node, so the global is only a type.

interface E2eStorageArea {
  get(keys: string | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

declare const chrome: {
  tabs: {
    query(info: Record<string, never>): Promise<{ id?: number; url?: string }[]>;
  };
  action: {
    getBadgeText(details: { tabId: number }): Promise<string>;
    getTitle(details: { tabId: number }): Promise<string>;
  };
  storage: { local: E2eStorageArea; session: E2eStorageArea };
  runtime: {
    getManifest(): {
      manifest_version: number;
      permissions?: string[];
      host_permissions?: string[];
    };
  };
};

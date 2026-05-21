// Tauri compatibility layer - replaces @electron/remote and electron
// Provides stub implementations to keep import paths working while
// the actual functionality is provided by @tauri-apps/api

export const initializeRemote = (): void => {
  // No-op in Tauri - no remote module needed
};

export const enableWebContents = (_webContents: any): void => {
  // No-op in Tauri
};

export const remote: any = new Proxy(
  {},
  {
    get: (_target, property) => {
      if (property === 'app') {
        return {
          getVersion: () => '',
          getLocale: () => 'en-US',
          getPath: () => '',
          setPath: () => {},
          isPackaged: false,
          name: 'Ferdium',
        };
      }
      if (property === 'getCurrentWindow') return () => ({ id: 0 });
      if (property === 'BrowserWindow') return class {};
      if (property === 'Menu')
        return { buildFromTemplate: () => ({}), popup: () => {} };
      if (property === 'nativeTheme')
        return {
          shouldUseDarkColors: window.matchMedia('(prefers-color-scheme: dark)')
            .matches,
        };
      if (property === 'powerMonitor') return { on: () => {} };
      if (property === 'screen') return { getAllDisplays: () => [] };
      if (property === 'process') return { execPath: '' };
      if (property === 'session') return { fromPartition: () => ({}) };
      if (property === 'webContents') return { fromId: () => null };
      if (property === 'systemPreferences') return {};
      return undefined;
    },
  },
);

export const api = remote;

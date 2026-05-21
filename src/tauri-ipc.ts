import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Tauri command names (snake_case) mapped from electron IPC channel names
const CHANNEL_TO_COMMAND: Record<string, string> = {
  getAppSettings: 'get_app_settings',
  updateAppSettings: 'update_app_settings',
  initialAppSettings: 'initial_app_settings',
  startLocalServer: 'start_local_server',
  'get-dnd': 'get_dnd',
  'detect-language': 'detect_language',
  'download-file': 'download_file',
  'download-folder-select': 'download_folder_select',
  'clear-storage-data': 'clear_storage_data',
  'clear-cache': 'clear_cache',
  updateAppIndicator: 'update_app_indicator',
  openProcessManager: 'open_process_manager',
  'feature-basic-auth-credentials': 'basic_auth_credentials',
  'feature-basic-auth-cancel': 'basic_auth_cancel',
  'open-browser-window': 'open_browser_window',
  'window.toolbar-double-clicked': 'toggle_window_maximized',
  'relaunch-app': 'relaunch_app',
  'request-translation-cache': 'get_translation_cache',
  'set-auto-launch': 'set_auto_launch',
};

/**
 * Invoke a Tauri command (replaces ipcRenderer.invoke)
 */
export async function ipcInvoke<T = unknown>(
  channel: string,
  ...args: any[]
): Promise<T> {
  const command = CHANNEL_TO_COMMAND[channel] ?? toSnakeCase(channel);
  const payload =
    args.length === 1
      ? args[0]
      : args.length > 1
        ? Object.assign({}, ...args)
        : {};
  return invoke<T>(command, payload);
}

/**
 * Send a Tauri command (fire-and-forget, replaces ipcRenderer.send)
 */
export function ipcSend(channel: string, ...args: any[]): void {
  const command = CHANNEL_TO_COMMAND[channel] ?? toSnakeCase(channel);
  const payload =
    args.length === 1
      ? args[0]
      : args.length > 1
        ? Object.assign({}, ...args)
        : {};
  invoke(command, payload).catch((err: unknown) => {
    console.warn(`[tauri-ipc] ipcSend(${channel}) failed:`, err);
  });
}

/**
 * Listen to a Tauri event (replaces ipcRenderer.on).
 * Returns a cleanup function. The cleanup is async-safe: if called before
 * the listen promise resolves, it will cancel the listener once set.
 */
export function ipcOn<T = unknown>(
  channel: string,
  callback: (event: any, data: T) => void,
): () => void {
  let unlisten: (() => void) | null = null;
  let cancelled = false;

  listen<T>(channel, event => {
    callback(event, event.payload);
  }).then(fn => {
    if (cancelled) {
      fn();
    } else {
      unlisten = fn;
    }
  });

  return () => {
    if (unlisten) {
      unlisten();
    } else {
      cancelled = true;
    }
  };
}

/**
 * Listen to a Tauri event once (replaces ipcRenderer.once)
 */
export function ipcOnce<T = unknown>(
  channel: string,
  callback: (event: any, data: T) => void,
): void {
  let unlisten: (() => void) | null = null;
  listen<T>(channel, event => {
    callback(event, event.payload);
    unlisten?.();
  }).then(fn => {
    unlisten = fn;
  });
}

/**
 * No-op for compatibility with ipcRenderer.removeListener.
 * Use the cleanup function returned by ipcOn() instead.
 */
export function ipcRemoveListener(_channel: string, _callback: any): void {
  // In Tauri, use the cleanup function returned by ipcOn()
}

function toSnakeCase(str: string): string {
  return str
    .replace(/-([a-z])/g, (_, c: string) => `_${c}`)
    .replace(/([A-Z])/g, (c: string) => `_${c.toLowerCase()}`)
    .replace(/^_/, '');
}

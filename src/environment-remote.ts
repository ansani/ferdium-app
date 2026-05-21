import { join } from 'node:path';
import { invoke } from '@tauri-apps/api/core';
import {
  DEV_API_FRANZ_WEBSITE,
  DEV_FRANZ_API,
  DEV_WS_API,
  LIVE_API_FERDIUM_WEBSITE,
  LIVE_FERDIUM_API,
  LIVE_WS_API,
  LOCAL_API,
  LOCAL_API_WEBSITE,
  LOCAL_WS_API,
} from './config';

// Version and locale are fetched from the Tauri runtime.
// We initialise with safe fallbacks and update asynchronously; callers that
// need the definitive value should await getVersion()/getLocale().
let _ferdiumVersion = '0.0.0';
let _ferdiumLocale =
  (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

invoke<string>('get_version')
  .then(v => {
    _ferdiumVersion = v;
  })
  .catch(() => {});

invoke<string>('get_locale')
  .then(l => {
    _ferdiumLocale = l;
  })
  .catch(() => {});

export const ferdiumVersion: string = _ferdiumVersion;
export const ferdiumLocale: string = _ferdiumLocale;

// Stub app object for compatibility with code that still imports { app }
export const app = {
  getVersion: () => ferdiumVersion,
  getLocale: () => ferdiumLocale,
  getPath: (_name: string) => userDataPath(),
  setPath: (_name: string, _value: string) => {},
  isPackaged: process.env.NODE_ENV === 'production',
  name: 'Ferdium',
};

function getUserDataBase(): string {
  if (process.env.FERDIUM_APPDATA_DIR) {
    return process.env.FERDIUM_APPDATA_DIR;
  }
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'Ferdium');
  }
  if (process.platform === 'win32') {
    return join(process.env.APPDATA ?? home, 'Ferdium');
  }
  return join(
    process.env.XDG_CONFIG_HOME ?? join(home, '.config'),
    'Ferdium',
  );
}

export const isDevMode: boolean =
  process.env.NODE_ENV === 'development' ||
  process.env.TAURI_DEBUG === '1' ||
  process.env.ELECTRON_IS_DEV === '1';

const _userDataBase = isDevMode
  ? `${getUserDataBase()}Dev`
  : getUserDataBase();

export const userDataPath = (...segments: string[]): string => {
  return join(_userDataBase, ...[segments].flat());
};

export const userDataRecipesPath = (...segments: string[]): string => {
  return userDataPath('recipes', ...[segments].flat());
};

export const userDataCertsPath = (...segments: string[]): string => {
  return userDataPath('certs', ...[segments].flat());
};

const useLocalAPI = process.env.USE_LOCAL_API;
export const useLiveAPI = process.env.USE_LIVE_API;

let api: string;
let wsApi: string;
let web: string;
if (!isDevMode || (isDevMode && useLiveAPI)) {
  api = LIVE_FERDIUM_API;
  wsApi = LIVE_WS_API;
  web = LIVE_API_FERDIUM_WEBSITE;
} else if (isDevMode && useLocalAPI) {
  api = LOCAL_API;
  wsApi = LOCAL_WS_API;
  web = LOCAL_API_WEBSITE;
} else {
  api = DEV_FRANZ_API;
  wsApi = DEV_WS_API;
  web = DEV_API_FRANZ_WEBSITE;
}

export const API: string = api;
export const API_VERSION: string = 'v1';
export const WS_API: string = wsApi;
export const WEBSITE: string = web;
export const protocolClient = isDevMode ? 'ferdium-dev' : 'ferdium';

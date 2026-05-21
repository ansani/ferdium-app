import type { ExecException } from 'node:child_process';
import fastFolderSize from 'fast-folder-size';
import { ipcInvoke, ipcSend } from '../../tauri-ipc';

import { getServicePartitionsDirectory } from '../../helpers/service-helpers';

const debug = require('../../preload-safe-debug')('Ferdium:LocalApi');

export default class LocalApi {
  // Settings
  getAppSettings(type: string) {
    // Invoke the Tauri command and return the actual settings data
    return ipcInvoke<{ type: string; data: any }>('getAppSettings', {
      settingsType: type,
    });
  }

  async updateAppSettings(type: string, data: any) {
    debug('LocalApi::updateAppSettings resolves', type, data);
    ipcSend('updateAppSettings', {
      settingsType: type,
      data,
    });
  }

  // Services
  async getAppCacheSize() {
    const partitionsDir = getServicePartitionsDirectory();

    return new Promise((resolve, reject) => {
      fastFolderSize(
        partitionsDir,
        (err: ExecException | null, bytes: number | undefined) => {
          if (err) {
            reject(err);
          }

          debug('LocalApi::getAppCacheSize resolves', bytes);
          resolve(bytes);
        },
      );
    });
  }

  async clearCache(serviceId: string | null = null) {
    const targetsToClear = {
      storages: [
        'appcache',
        'filesystem',
        'indexdb',
        'shadercache',
        'websql',
        'serviceworkers',
        'cachestorage',
      ],
      quotas: ['temporary', 'persistent', 'syncable'],
    };
    ipcSend('clear-storage-data', { serviceId, targetsToClear });
    return ipcInvoke('clear-cache', { serviceId });
  }
}

import { ipcOn } from '../../tauri-ipc';

import { state as ModalState } from './store';

const debug = require('../../preload-safe-debug')('Ferdium:feature:basicAuth');

const state = ModalState;

export default function initialize() {
  debug('Initialize basicAuth feature');

  window['ferdium'].features.basicAuth = {
    state,
  };

  ipcOn<{ authInfo: typeof state.authInfo }>('feature:basic-auth-request', (e, data) => {
    debug(e, data);
    state.authInfo = data.authInfo;
    state.isModalVisible = true;
  });
}

export { default as Component } from './Component';

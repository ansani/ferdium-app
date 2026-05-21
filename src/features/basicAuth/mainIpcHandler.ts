const debug = require('../../preload-safe-debug')(
  'Ferdium:feature:basicAuth:main',
);

export default function mainIpcHandler(mainWindow: any, authInfo: any) {
  debug('Sending basic auth call', authInfo);
  // In Tauri, this is handled by the Rust backend via app.emit()
  if (mainWindow?.webContents?.send) {
    mainWindow.webContents.send('feature:basic-auth', { authInfo });
  }
}

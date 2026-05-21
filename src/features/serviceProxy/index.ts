import { action, autorun, observable } from 'mobx';

const debug = require('../../preload-safe-debug')(
  'Ferdium:feature:serviceProxy',
);

export const config = observable({
  isEnabled: true,
});

export default function init(stores: {
  services: { enabled: any };
  settings: { proxy: any };
}) {
  debug('Initializing `serviceProxy` feature');

  const setIsEnabled = action((value: boolean) => {
    config.isEnabled = value;
  });

  autorun(() => {
    setIsEnabled(true);

    const services = stores.services.enabled;
    const proxySettings = stores.settings.proxy;

    debug('Service Proxy autorun');

    for (const service of services) {
      if (config.isEnabled) {
        const serviceProxyConfig = proxySettings[service.id];

        if (serviceProxyConfig?.isEnabled && serviceProxyConfig.host) {
          const proxyHost = `${serviceProxyConfig.host}${
            serviceProxyConfig.port ? `:${serviceProxyConfig.port}` : ''
          }`;
          debug(
            `Proxy config for "${service.name}" (${service.id}):`,
            proxyHost,
          );
          // Note: In Tauri, per-service proxy configuration is handled at the
          // Rust/WebviewWindow level. This is a no-op placeholder.
        }
      }
    }
  });
}

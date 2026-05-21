import { action, computed, makeObservable, observable, observe } from 'mobx';

import defaultUserAgent from '../helpers/userAgent-helpers';

const debug = require('../preload-safe-debug')('Ferdium:UserAgent');

export default class UserAgent {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _didNavigateListener = (_event: any): void => {};

  @observable.ref webview: HTMLIFrameElement | null = null;

  @observable userAgentPref: string | null = null;

  @observable overrideUserAgent = (): string => '';

  constructor(overrideUserAgent: any = null) {
    makeObservable(this);

    if (typeof overrideUserAgent === 'function') {
      this.overrideUserAgent = overrideUserAgent;
    }

    observe(this, 'webview', change => {
      const { oldValue, newValue } = change;
      if (oldValue !== null) {
        this._removeWebviewEvents(oldValue);
      }
      if (newValue !== null) {
        this._addWebviewEvents(newValue);
      }
    });
  }

  @computed get defaultUserAgent(): string {
    const replacedUserAgent = this.overrideUserAgent();
    if (replacedUserAgent.length > 0) {
      return replacedUserAgent;
    }

    const globalPref = window['ferdium'].stores.settings.all.app.userAgentPref;
    if (typeof globalPref === 'string') {
      const trimmed = globalPref.trim();
      if (trimmed !== '') {
        return trimmed;
      }
    }
    return defaultUserAgent();
  }

  @computed get serviceUserAgentPref(): string | null {
    if (typeof this.userAgentPref === 'string') {
      const trimmed = this.userAgentPref.trim();
      if (trimmed !== '') {
        return trimmed;
      }
    }
    return null;
  }

  @computed get userAgentWithoutChromeVersion(): string {
    const withChrome = this.defaultUserAgent;
    return withChrome.replace(/Chrome\/[\d.]+/, 'Chrome');
  }

  @computed get userAgent(): string {
    return this.serviceUserAgentPref || this.defaultUserAgent;
  }

  @action setWebviewReference(webview: HTMLIFrameElement | null): void {
    this.webview = webview;
  }

  @action _handleNavigate(_url: string): void {
    // In Tauri iframes we cannot override the user agent per-navigation
    debug('Navigation detected; user agent override not available for iframes');
  }

  _addWebviewEvents(webview: HTMLIFrameElement): void {
    debug('Adding event handlers');
    this._didNavigateListener = () => this._handleNavigate(webview.src);
    webview.addEventListener('load', this._didNavigateListener);
  }

  _removeWebviewEvents(webview: HTMLIFrameElement): void {
    debug('Removing event handlers');
    webview.removeEventListener('load', this._didNavigateListener);
  }
}

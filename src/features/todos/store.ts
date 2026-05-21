import { action, computed, makeObservable, observable } from 'mobx';
import localStorage from 'mobx-localstorage';
import type { Actions } from '../../actions/lib/actions';

import {
  CUSTOM_TODO_SERVICE,
  DEFAULT_IS_TODO_FEATURE_ENABLED_BY_USER,
  DEFAULT_TODOS_VISIBLE,
  DEFAULT_TODOS_WIDTH,
  TODOS_MIN_WIDTH,
  TODO_SERVICE_RECIPE_IDS,
} from '../../config';
import { isValidExternalURL } from '../../helpers/url-helpers';
import { ifUndefined } from '../../jsUtils';
import UserAgent from '../../models/UserAgent';
import type Reaction from '../../stores/lib/Reaction';
import { createReactions } from '../../stores/lib/Reaction';
import { ThemeType } from '../../themes';
import { createActionBindings } from '../utils/ActionBinding';
import FeatureStore from '../utils/FeatureStore';
import { todoActions } from './actions';
import { IPC, TODOS_ROUTES } from './constants';

const debug = require('../../preload-safe-debug')(
  'Ferdium:feature:todos:store',
);

export default class TodoStore extends FeatureStore {
  @observable stores: any = null;

  @observable isFeatureActive = false;

  @observable webview: HTMLIFrameElement | undefined;

  @observable userAgentModel = new UserAgent();

  isInitialized = false;

  actions: Actions | undefined;

  _allReactions: Reaction[] | undefined;

  constructor() {
    super();

    makeObservable(this);
  }

  @computed get width() {
    const width = ifUndefined<number>(this.settings.width, DEFAULT_TODOS_WIDTH);

    return width < TODOS_MIN_WIDTH ? TODOS_MIN_WIDTH : width;
  }

  @computed get isTodosPanelForceHidden() {
    return !this.isFeatureEnabledByUser;
  }

  @computed get isTodosPanelVisible() {
    return ifUndefined<boolean>(
      this.settings.isTodosPanelVisible,
      DEFAULT_TODOS_VISIBLE,
    );
  }

  @computed get isFeatureEnabledByUser() {
    return this.settings.isFeatureEnabledByUser;
  }

  @computed get settings() {
    return localStorage.getItem('todos') || {};
  }

  @computed get userAgent() {
    return this.userAgentModel.userAgent;
  }

  @computed get isUsingPredefinedTodoServer() {
    return (
      this.stores &&
      this.stores.settings.app.predefinedTodoServer !== CUSTOM_TODO_SERVICE
    );
  }

  @computed get todoUrl() {
    if (!this.stores) {
      return null;
    }
    return this.isUsingPredefinedTodoServer
      ? this.stores.settings.app.predefinedTodoServer
      : this.stores.settings.app.customTodoServer;
  }

  @computed get isTodoUrlValid() {
    return (
      !this.isUsingPredefinedTodoServer || isValidExternalURL(this.todoUrl)
    );
  }

  @computed get todoRecipeId() {
    if (
      this.isFeatureEnabledByUser &&
      this.isUsingPredefinedTodoServer &&
      this.todoUrl in TODO_SERVICE_RECIPE_IDS
    ) {
      return TODO_SERVICE_RECIPE_IDS[this.todoUrl];
    }
    return null;
  }

  // ========== PUBLIC API ========= //

  @action start(stores, actions) {
    debug('TodoStore::start');
    this.stores = stores;
    this.actions = actions;

    // ACTIONS

    this._registerActions(
      createActionBindings([
        [todoActions.resize, this._resize],
        [todoActions.toggleTodosPanel, this._toggleTodosPanel],
        [todoActions.setTodosWebview, this._setTodosWebview],
        [todoActions.handleHostMessage, this._handleHostMessage],
        [todoActions.handleClientMessage, this._handleClientMessage],
        [
          todoActions.toggleTodosFeatureVisibility,
          this._toggleTodosFeatureVisibility,
        ],
        [todoActions.openDevTools, this._openDevTools],
        [todoActions.reload, this._reload],
      ]),
    );

    // REACTIONS

    this._allReactions = createReactions([
      this._updateTodosConfig,
      this._firstLaunchReaction,
      this._routeCheckReaction,
    ]);

    this._registerReactions(this._allReactions);

    this.isFeatureActive = true;
  }

  @action stop() {
    super.stop();
    debug('TodoStore::stop');
    // this.reset(); // TODO: [TECH DEBT][PROP NOT IN CLASS] check it later
    this.isFeatureActive = false;
  }

  // ========== PRIVATE METHODS ========= //

  _updateSettings = changes => {
    localStorage.setItem('todos', {
      ...this.settings,
      ...changes,
    });
  };

  // Actions

  @action _resize = (width: number) => {
    this._updateSettings({
      width,
    });
  };

  @action _toggleTodosPanel = () => {
    this._updateSettings({
      isTodosPanelVisible: !this.isTodosPanelVisible,
    });
  };

  @action _setTodosWebview = ({ webview }) => {
    debug('_setTodosWebview', webview);
    if (this.webview !== webview) {
      this.webview = webview;
      this.userAgentModel.setWebviewReference(webview);
    }
  };

  @action _handleHostMessage = message => {
    debug('_handleHostMessage', message);
    if (message.action === 'todos:create' && this.webview?.contentWindow) {
      // Scope the message to the todos iframe's origin when possible
      let targetOrigin = '*';
      try {
        if (this.todoUrl) targetOrigin = new URL(this.todoUrl).origin;
      } catch {
        // fall back to '*' if the URL is not parseable
      }
      this.webview.contentWindow.postMessage(
        { channel: IPC.TODOS_HOST_CHANNEL, args: [message] },
        targetOrigin,
      );
    }
  };

  @action _handleClientMessage = ({
    channel,
    message = { action: '', data: { url: '', serviceId: '' } },
  }) => {
    debug('_handleClientMessage', channel, message);
    switch (message.action) {
      case 'todos:initialized': {
        this._onTodosClientInitialized();
        break;
      }
      case 'todos:goToService': {
        this._goToService(message.data);
        break;
      }
      default: {
        debug('Other message received', channel, message);
        if (this.stores.services.isTodosServiceAdded && this.actions) {
          this.actions.service.handleIPCMessage({
            serviceId: this.stores.services.isTodosServiceAdded.id,
            channel,
            args: message,
          });
        }
      }
    }
  };

  _handleNewWindowEvent = ({ url }) => {
    if (!this.actions) {
      return;
    }
    this.actions.app.openExternalUrl({ url });
  };

  @action _toggleTodosFeatureVisibility = () => {
    debug('_toggleTodosFeatureVisibility');

    const isFeatureEnabled = !this.settings.isFeatureEnabledByUser;
    this._updateSettings({
      isFeatureEnabledByUser: isFeatureEnabled,
      isTodosPanelVisible: isFeatureEnabled,
    });
  };

  _openDevTools = () => {
    debug('_openDevTools');
    // DevTools for iframes are not directly accessible in Tauri
  };

  _reload = () => {
    debug('_reload');

    const webview = document.querySelector<HTMLIFrameElement>('#todos-panel iframe');
    if (webview) {
      webview.src = webview.src; // eslint-disable-line no-self-assign
    }
  };

  // Todos client message handlers

  _onTodosClientInitialized = async () => {
    const { authToken } = this.stores.user;
    const { isDarkThemeActive } = this.stores.ui;
    const { locale } = this.stores.app;
    if (!this.webview?.contentWindow) return;
    // Use postMessage for iframe communication
    this.webview.contentWindow.postMessage(
      {
        channel: IPC.TODOS_HOST_CHANNEL,
        args: [{
          action: 'todos:configure',
          data: {
            authToken,
            locale,
            theme: isDarkThemeActive ? ThemeType.dark : ThemeType.default,
          },
        }],
      },
      '*',
    );

    if (!this.isInitialized) {
      this.isInitialized = true;
    }
  };

  _goToService = ({ url, serviceId }) => {
    if (url) {
      const webview = this.stores.services.one(serviceId).webview as HTMLIFrameElement | null;
      if (webview) webview.src = url;
    }
    if (this.actions) {
      this.actions.service.setActive({ serviceId });
    }
  };

  // Reactions

  _updateTodosConfig = () => {
    // Resend the config if any part changes in Franz:
    this._onTodosClientInitialized();
  };

  _firstLaunchReaction = () => {
    const { stats } = this.stores.settings.all;

    if (this.settings.isFeatureEnabledByUser === undefined) {
      this._updateSettings({
        isFeatureEnabledByUser: DEFAULT_IS_TODO_FEATURE_ENABLED_BY_USER,
      });
    }

    // Hide todos layer on first app start but show on second
    if (stats.appStarts <= 1) {
      this._updateSettings({
        isTodosPanelVisible: false,
      });
    } else if (stats.appStarts <= 2) {
      this._updateSettings({
        isTodosPanelVisible: true,
      });
    }
  };

  _routeCheckReaction = () => {
    const { pathname } = this.stores.router.location;

    if (pathname === TODOS_ROUTES.TARGET) {
      debug('Router is on todos route, show todos panel');
      // todosStore.start(stores, actions);
      this.stores.router.push('/');

      if (!this.isTodosPanelVisible) {
        this._updateSettings({
          isTodosPanelVisible: true,
        });
      }
    }
  };
}

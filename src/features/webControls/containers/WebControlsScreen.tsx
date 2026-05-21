import {
  type IReactionDisposer,
  action,
  autorun,
  makeObservable,
  observable,
} from 'mobx';
import { inject, observer } from 'mobx-react';
import { Component, type ReactElement } from 'react';
import type { StoresProps } from '../../../@types/ferdium-components.types';
import { SEARCH_ENGINE_URLS } from '../../../config';
import type Service from '../../../models/Service';
import WebControls from '../components/WebControls';

const URL_EVENTS = ['load'];

interface IProps extends Partial<StoresProps> {
  service: Service;
}

@inject('stores', 'actions')
@observer
class WebControlsScreen extends Component<IProps> {
  @observable url = '';

  @observable canGoBack = false;

  @observable canGoForward = false;

  webview: HTMLIFrameElement | null = null;

  autorunDisposer: IReactionDisposer | null = null;

  constructor(props) {
    super(props);

    makeObservable(this);
  }

  componentDidMount(): void {
    const { service } = this.props;

    this.autorunDisposer = autorun(() => {
      if (service.isAttached) {
        this.webview = service.webview as HTMLIFrameElement | null;
        if (this.webview) {
          this._setUrl(this.webview.src);
          for (const event of URL_EVENTS) {
            this.webview.addEventListener(event, this.handleWebviewEvent);
          }
        }
      }
    });
  }

  componentWillUnmount(): void {
    if (this.autorunDisposer) {
      this.autorunDisposer();
    }

    if (this.webview) {
      for (const event of URL_EVENTS) {
        this.webview.removeEventListener(event, this.handleWebviewEvent);
      }
    }
  }

  handleWebviewEvent = (_e: any) => {
    if (this.webview) {
      this._setUrl(this.webview.src);
    }
  };

  @action
  _setUrl(value: string): void {
    this.url = value;
  }

  @action
  _setUrlAndHistory(value: string): void {
    this._setUrl(value);
    // iframes don't expose history state - keep defaults
    this.canGoBack = false;
    this.canGoForward = false;
  }

  goHome(): void {
    if (!this.webview) {
      return;
    }
    // Reload to original src
    this.webview.src = this.webview.src;
  }

  reload(): void {
    if (!this.webview) {
      return;
    }
    this.webview.src = this.webview.src;
  }

  goBack(): void {
    // iframes don't support programmatic history navigation
  }

  goForward(): void {
  }

  navigate(url: string): void {
    if (!this.webview) {
      return;
    }

    try {
      // eslint-disable-next-line no-param-reassign
      url = new URL(url).toString();
    } catch {
      // eslint-disable-next-line no-param-reassign
      url =
        /^((?!-))(xn--)?[\da-z][\d_a-z-]{0,61}[\da-z]{0,1}\.(xn--)?([\da-z-]{1,61}|[\da-z-]{1,30}\.[a-z]{2,})$/.test(
          url,
        )
          ? `http://${url}`
          : SEARCH_ENGINE_URLS[this.props.stores!.settings.app.searchEngine]({
              searchTerm: url,
            });
    }

    if (this.webview) {
      this.webview.src = url;
      this._setUrl(url);
    }
  }

  openInBrowser(): void {
    const { openExternalUrl } = this.props.actions!.app;
    if (!this.webview) {
      return;
    }

    openExternalUrl({ url: this.url });
  }

  render(): ReactElement {
    return (
      <WebControls
        goHome={() => this.goHome()}
        reload={() => this.reload()}
        openInBrowser={() => this.openInBrowser()}
        canGoBack={this.canGoBack}
        goBack={() => this.goBack()}
        canGoForward={this.canGoForward}
        goForward={() => this.goForward()}
        navigate={url => this.navigate(url)}
        url={this.url}
      />
    );
  }
}

export default WebControlsScreen;

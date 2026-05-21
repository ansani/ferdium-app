import { action, makeObservable, observable } from 'mobx';
import { observer } from 'mobx-react';
import { Component, type ReactElement, createRef } from 'react';
import type ServiceModel from '../../../models/Service';
import type { RealStores } from '../../../stores';

const debug = require('../../../preload-safe-debug')('Ferdium:Services');

interface IProps {
  service: ServiceModel;
  setWebviewReference: (options: {
    serviceId: string;
    webview: HTMLIFrameElement | null;
  }) => void;
  detachService: (options: { service: ServiceModel }) => void;
  isSpellcheckerEnabled: boolean;
  stores?: RealStores;
}

@observer
class ServiceWebview extends Component<IProps> {
  @observable webview: HTMLIFrameElement | null = null;

  private iframeRef = createRef<HTMLIFrameElement>();

  constructor(props: IProps) {
    super(props);

    this.refocusWebview = this.refocusWebview.bind(this);
    this._setWebview = this._setWebview.bind(this);

    makeObservable(this);
  }

  componentWillUnmount(): void {
    const { service, detachService } = this.props;
    detachService({ service });
  }

  refocusWebview(): void {
    const { webview } = this;
    debug('Refocus Webview is called', this.props.service);
    if (!webview) {
      return;
    }

    if (this.props.service.isActive) {
      webview.blur();
      webview.focus();
    } else {
      debug('Refocus not required - Not active service');
    }
  }

  @action _setWebview(webview: HTMLIFrameElement | null): void {
    this.webview = webview;
  }

  render(): ReactElement {
    const { service, setWebviewReference } = this.props;

    return (
      <iframe
        ref={el => {
          this._setWebview(el);
          if (el) {
            el.addEventListener('load', this.refocusWebview);
            setWebviewReference({
              serviceId: service.id,
              webview: el,
            });
          }
        }}
        title={service.name}
        src={service.url}
        sandbox="allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-top-navigation allow-top-navigation-by-user-activation allow-downloads"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: service.isActive ? 'block' : 'none',
        }}
      />
    );
  }
}

export default ServiceWebview;

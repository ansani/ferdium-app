import classnames from 'classnames';
import { observer } from 'mobx-react';
import {
  Component,
  type MouseEvent,
  type ReactElement,
  createRef,
} from 'react';
import withStyles, { type WithStylesProps } from 'react-jss';
import type { TodoClientMessage } from '../actions';

const styles = theme => ({
  root: {
    background: theme.colorBackground,
    position: 'relative',
    borderLeft: [1, 'solid', theme.todos.todosLayer.borderLeftColor],
    zIndex: 300,

    transform: ({ isVisible, width, isTodosServiceActive }) =>
      `translateX(${isVisible || isTodosServiceActive ? 0 : width}px)`,

    '& webview': {
      height: '100%',
    },
  },
  resizeHandler: {
    position: 'absolute',
    left: 0,
    marginLeft: -5,
    width: 10,
    zIndex: 400,
    cursor: 'col-resize',
  },
  dragIndicator: {
    position: 'absolute',
    left: 0,
    width: 5,
    zIndex: 400,
    background: theme.todos.dragIndicator.background,
  },
  isTodosServiceActive: {
    width: 'calc(100% - 368px)',
    position: 'absolute',
    right: 0,
    zIndex: 0,
    borderLeftWidth: 0,
  },
  hidden: {
    borderLeftWidth: 0,
  },
});

interface IProps extends WithStylesProps<typeof styles> {
  isTodosServiceActive: boolean;
  isVisible: boolean;
  handleClientMessage: (channel: string, message: TodoClientMessage) => void;
  setTodosWebview: (webView: HTMLIFrameElement) => void;
  resize: (newWidth: number) => void;
  width: number;
  minWidth: number;
  userAgent: string;
  todoUrl: string;
  isTodoUrlValid: boolean;
}

interface IState {
  isDragging: boolean;
  width: number;
  initialPos: number;
  delta: number;
}

@observer
class TodosWebview extends Component<IProps, IState> {
  private node = createRef<HTMLDivElement>();

  private webview: HTMLIFrameElement | null = null;

  private _messageHandler: ((e: MessageEvent) => void) | null = null;

  constructor(props: IProps) {
    super(props);

    this.state = {
      isDragging: false,
      width: 300,
      initialPos: 0,
      delta: 0,
    };
    this.resizePanel = this.resizePanel.bind(this);
    this.stopResize = this.stopResize.bind(this);
  }

  componentDidMount() {
    // eslint-disable-next-line @eslint-react/no-set-state-in-component-did-mount
    this.setState({
      width: this.props.width,
    });

    if (this.node.current) {
      this.node.current.addEventListener('mousemove', this.resizePanel);
      this.node.current.addEventListener('mouseup', this.stopResize);
      this.node.current.addEventListener('mouseleave', this.stopResize);
    }
  }

  componentWillUnmount() {
    if (this.node.current) {
      this.node.current.removeEventListener('mousemove', this.resizePanel);
      this.node.current.removeEventListener('mouseup', this.stopResize);
      this.node.current.removeEventListener('mouseleave', this.stopResize);
    }

    this.stopListeningToIpcMessages();
  }

  startResize = (e: MouseEvent<HTMLDivElement>): void => {
    this.setState({
      isDragging: true,
      initialPos: e.clientX,
      delta: 0,
    });
  };

  resizePanel = (e: MouseEventInit): void => {
    const { minWidth } = this.props;
    const { isDragging, initialPos } = this.state;

    if (isDragging && Math.abs(e.clientX! - window.innerWidth) > minWidth) {
      const delta = e.clientX! - initialPos;

      this.setState({
        delta,
      });
    }
  };

  stopResize = (): void => {
    const { resize, minWidth } = this.props;
    const { isDragging, delta, width } = this.state;

    if (isDragging) {
      let newWidth = width + (delta < 0 ? Math.abs(delta) : -Math.abs(delta));

      if (newWidth < minWidth) {
        newWidth = minWidth;
      }

      this.setState({
        isDragging: false,
        delta: 0,
        width: newWidth,
      });

      resize(newWidth);
    }
  };

  startListeningToIpcMessages = (): void => {
    if (!this.webview) {
      return;
    }

    const { handleClientMessage } = this.props;
    this._messageHandler = (e: MessageEvent) => {
      // Only process messages from this todos iframe
      if (e.source !== this.webview?.contentWindow) return;
      const { channel, args } = (e.data || {}) as {
        channel?: string;
        args?: any[];
      };
      if (channel) handleClientMessage(channel, args?.[0]);
    };
    window.addEventListener('message', this._messageHandler);
  };

  stopListeningToIpcMessages = (): void => {
    if (this._messageHandler) {
      window.removeEventListener('message', this._messageHandler);
      this._messageHandler = null;
    }
  };

  render(): ReactElement {
    const {
      classes,
      isTodosServiceActive,
      isVisible,
      todoUrl,
      isTodoUrlValid,
    } = this.props;

    const { width, delta, isDragging } = this.state;
    let displayedWidth = isVisible ? width : 0;
    if (isTodosServiceActive) {
      displayedWidth = 0;
    }

    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <div
        className={classnames({
          [classes.root]: true,
          [classes.isTodosServiceActive]: isTodosServiceActive,
          'todos__todos-panel--expanded': isTodosServiceActive,
          [classes.hidden]: !isVisible,
        })}
        style={{ width: displayedWidth }}
        onMouseUp={() => this.stopResize()}
        ref={this.node}
        id="todos-panel"
      >
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className={classes.resizeHandler}
          style={{
            left: delta,
            ...(isDragging ? { width: 600, marginLeft: -200 } : {}),
          }} // This hack is required as resizing with webviews beneath behaves quite bad
          onMouseDown={this.startResize}
        />
        {isDragging && (
          <div
            className={classes.dragIndicator}
            style={{ left: delta }} // This hack is required as resizing with webviews beneath behaves quite bad
          />
        )}
        {isTodoUrlValid && (
          <iframe
            title="Ferdium Todos"
            style={{ width: '100%', height: '100%', border: 'none' }}
            src={todoUrl}
            sandbox="allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-top-navigation allow-top-navigation-by-user-activation allow-downloads"
            ref={el => {
              this.webview = el;
              if (el) {
                const { setTodosWebview } = this.props;
                setTodosWebview(el);
                el.addEventListener('load', () => {
                  this.startListeningToIpcMessages();
                });
              }
            }}
          />
        )}
      </div>
    );
  }
}

export default withStyles(styles, { injectTheme: true })(TodosWebview);

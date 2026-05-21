interface HTMLIFrameElement {
  send(channel: string, ...args: any[]): void;
  loadURL(url: string): void;
  openDevTools(): void;
  getTitle(): string;
  goBack(): void;
  goForward(): void;
  setZoomLevel(level: number): void;
  getZoomLevel(): number;
  audioMuted: boolean;
}

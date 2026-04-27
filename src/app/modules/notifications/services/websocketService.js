import { getApiBaseUrl, getToken } from '../../../shared/services/apiClient.js';

class WebSocketConnection {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 3000;
    this.messageListeners = new Set();
    this.errorListeners = new Set();
    this.connectListeners = new Set();
    this.isConnecting = false;
    this.shouldReconnect = true;
  }

  getWebSocketUrl() {
    const baseUrl = getApiBaseUrl();
    const token = getToken();
    if (!token) {
      return null;
    }
    // 本地开发模式：baseUrl 为空时使用当前页面 host（通过 Vite 代理）
    const wsBaseUrl = baseUrl
      ? baseUrl.replace(/^http/, 'ws')
      : `${window.location.protocol.replace(/^http/, 'ws')}//${window.location.host}`;
    return `${wsBaseUrl}/ws/notifications/?token=${token}`;
  }

  addMessageListener(listener) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  addErrorListener(listener) {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  addConnectListener(listener) {
    this.connectListeners.add(listener);
    return () => this.connectListeners.delete(listener);
  }

  connect() {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = this.getWebSocketUrl();
    if (!wsUrl) {
      this.errorListeners.forEach((listener) => listener(new Error('No API base URL or token')));
      return;
    }

    this.shouldReconnect = true;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.connectListeners.forEach((listener) => listener());
      };

      this.ws.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data);
          this.messageListeners.forEach((listener) => listener(notification));
        } catch (e) {
          console.warn('WebSocket message parse error:', e);
        }
      };

      this.ws.onerror = (error) => {
        this.isConnecting = false;
        console.error('WebSocket error:', error);
        this.errorListeners.forEach((listener) => listener(error));
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;

        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
          console.log(`WebSocket reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
          setTimeout(() => this.connect(), delay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.errorListeners.forEach((listener) => listener(new Error('WebSocket connection failed after max retries')));
        }
      };
    } catch (e) {
      this.isConnecting = false;
      this.errorListeners.forEach((listener) => listener(e));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsConnection = new WebSocketConnection();
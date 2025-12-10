import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { apiClient } from '@/lib/api';
import { logger } from '@/lib/logger';

type MessageType =
  | 'connected'
  | 'subscribed'
  | 'unsubscribed'
  | 'price_update'
  | 'position_update'
  | 'trade_executed'
  | 'signal_received'
  | 'ping'
  | 'pong'
  | 'error';

interface WebSocketMessage {
  type: MessageType;
  data?: any;
}

type MessageHandler = (data: any) => void;

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

export function useWebSocket() {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const handlersRef = useRef<Map<MessageType, Set<MessageHandler>>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Register message handler
  const subscribe = useCallback((type: MessageType, handler: MessageHandler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  // Subscribe to topic
  const subscribeTopic = useCallback((topic: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', topic }));
      logger.debug('WebSocket subscribed to topic', { topic });
    }
  }, []);

  // Unsubscribe from topic
  const unsubscribeTopic = useCallback((topic: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', topic }));
      logger.debug('WebSocket unsubscribed from topic', { topic });
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    const token = apiClient.getToken();
    if (!token || !user) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    logger.info('WebSocket connecting...', { url: WS_URL });
    const ws = new WebSocket(`${WS_URL}/connect?token=${token}`);

    ws.onopen = () => {
      logger.info('WebSocket connected');
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        setLastMessage(message);

        // Call registered handlers
        const handlers = handlersRef.current.get(message.type);
        if (handlers) {
          handlers.forEach(handler => handler(message.data));
        }

        // Handle ping
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (e) {
        logger.error('WebSocket failed to parse message', e);
      }
    };

    ws.onclose = (event) => {
      logger.info('WebSocket disconnected', { code: event.code, reason: event.reason });
      setIsConnected(false);
      wsRef.current = null;

      // Reconnect with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts && user) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        logger.debug('WebSocket reconnecting', { attempt: reconnectAttempts.current + 1, delay });
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      logger.error('WebSocket error', error);
    };

    wsRef.current = ws;
  }, [user]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    logger.info('WebSocket manually disconnected');
  }, []);

  // Send message
  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Auto-connect when authenticated
  useEffect(() => {
    const token = apiClient.getToken();
    if (user && token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    subscribe,
    subscribeTopic,
    unsubscribeTopic,
    connect,
    disconnect,
    send,
  };
}

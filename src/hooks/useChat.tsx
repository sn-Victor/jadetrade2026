import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { logger } from '@/lib/logger';

const BOT_API_URL = import.meta.env.VITE_BOT_API_URL || 'http://localhost:8000';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

interface UseChatOptions {
  maxHistory?: number;
  onError?: (error: Error) => void;
}

export function useChat(options: UseChatOptions = {}) {
  const { maxHistory = 10, onError } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendMessage = useCallback(async (userMessage: string): Promise<string> => {
    if (!userMessage.trim() || isLoading) {
      return '';
    }

    const trimmedMessage = userMessage.trim();
    setError(null);
    setIsLoading(true);

    // Add user message
    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmedMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    logger.trackAction('Chat message sent', { messageLength: trimmedMessage.length });

    try {
      const token = apiClient.getToken();
      const response = await fetch(`${BOT_API_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: trimmedMessage,
          history: messages.slice(-maxHistory),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Chat request failed');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      // Add empty assistant message to update
      setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: new Date() }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantMessage += parsed.content;
                setMessages(prev => [
                  ...prev.slice(0, -1),
                  { role: 'assistant', content: assistantMessage, timestamp: new Date() },
                ]);
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      logger.trackAction('Chat response received', { responseLength: assistantMessage.length });
      return assistantMessage;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      logger.error('Chat error', error);
      setError(error);

      // Add error message
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', timestamp: new Date() },
      ]);

      onError?.(error);
      return '';
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, maxHistory, onError]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    logger.trackAction('Chat cleared');
  }, []);

  // Non-streaming send for simple requests
  const sendMessageSimple = useCallback(async (userMessage: string): Promise<string> => {
    if (!userMessage.trim() || isLoading) {
      return '';
    }

    const trimmedMessage = userMessage.trim();
    setError(null);
    setIsLoading(true);

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: trimmedMessage, timestamp: new Date() }]);

    try {
      const token = apiClient.getToken();
      const response = await fetch(`${BOT_API_URL}/api/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: trimmedMessage,
          history: messages.slice(-maxHistory),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Chat request failed');
      }

      const data = await response.json();
      const assistantMessage = data.response || data.content || '';

      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage, timestamp: new Date() }]);
      return assistantMessage;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      logger.error('Chat error', error);
      setError(error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', timestamp: new Date() },
      ]);
      onError?.(error);
      return '';
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, maxHistory, onError]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    sendMessageSimple,
    clearMessages,
  };
}

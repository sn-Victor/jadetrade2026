// Logger utility for tracking user actions and errors
import { awsConfig } from '@/config/aws';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  userId?: string;
  page?: string;
  userAgent?: string;
  sessionId?: string;
}

class Logger {
  private queue: LogEntry[] = [];
  private userId: string | null = null;
  private sessionId: string;
  private flushInterval: number | null = null;
  private readonly API_URL = awsConfig.apiGateway.url;

  constructor() {
    // Generate unique session ID
    this.sessionId = this.generateSessionId();
    
    // Start flush interval (every 10 seconds)
    this.flushInterval = window.setInterval(() => this.flush(), 10000);
    
    // Flush on page unload
    window.addEventListener('beforeunload', () => this.flush());
  }

  private generateSessionId(): string {
    return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  setUserId(userId: string | null) {
    this.userId = userId;
  }

  private log(level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      userId: this.userId || undefined,
      page: window.location.pathname,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
    };

    this.queue.push(entry);

    // Console output with styling (for development)
    const styles = {
      debug: 'color: #888',
      info: 'color: #2196F3',
      warn: 'color: #FF9800',
      error: 'color: #F44336; font-weight: bold',
    };

    console.log(
      `%c[${level.toUpperCase()}] ${message}`,
      styles[level],
      data || ''
    );

    // Flush immediately for errors
    if (level === 'error') {
      this.flush();
    }

    // Keep queue size manageable
    if (this.queue.length > 50) {
      this.flush();
    }
  }

  private async flush() {
    if (this.queue.length === 0) return;

    const logsToSend = [...this.queue];
    this.queue = [];

    try {
      await fetch(`${this.API_URL}/api/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logsToSend }),
      });
    } catch (error) {
      // If sending fails, add logs back to queue (but limit size)
      this.queue = [...logsToSend.slice(-20), ...this.queue].slice(-50);
      console.warn('Failed to send logs to server', error);
    }
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  // Track specific user actions
  trackAction(action: string, details?: any) {
    this.info(`[ACTION] ${action}`, details);
  }

  trackPageView(page: string) {
    this.info(`[PAGE VIEW] ${page}`);
  }

  trackCheckout(tier: string, success: boolean) {
    this.info(`[CHECKOUT] ${tier}`, { success });
  }

  trackAuth(event: 'signup' | 'signin' | 'signout' | 'confirm', success: boolean, error?: string) {
    this.info(`[AUTH] ${event}`, { success, error });
  }

  // Force flush (call before navigation)
  forceFlush() {
    this.flush();
  }
}

export const logger = new Logger();
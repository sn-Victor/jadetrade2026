import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Trash2, Filter, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { awsConfig } from '@/config/aws';

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  data: any;
  user_id: string | null;
  page: string | null;
  session_id: string | null;
}

const levelColors: Record<string, string> = {
  debug: 'bg-gray-500/20 text-gray-400',
  info: 'bg-blue-500/20 text-blue-400',
  warn: 'bg-yellow-500/20 text-yellow-400',
  error: 'bg-red-500/20 text-red-400',
};

const Logs = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchLogs();
  }, [user, levelFilter]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (levelFilter) params.append('level', levelFilter);
      
      const res = await fetch(`${awsConfig.apiGateway.url}/api/logs?${params}`);
      const data = await res.json();
      setLogs(data || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearOldLogs = async () => {
    if (!confirm('Delete logs older than 7 days?')) return;
    try {
      await fetch(`${awsConfig.apiGateway.url}/api/logs`, { method: 'DELETE' });
      fetchLogs();
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const downloadLogs = () => {
    const content = JSON.stringify(logs, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter(log => 
    !filter || 
    log.message.toLowerCase().includes(filter.toLowerCase()) ||
    log.page?.toLowerCase().includes(filter.toLowerCase()) ||
    log.user_id?.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-primary">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-lg">Application Logs</span>
            <Badge variant="outline">{filteredLogs.length} entries</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={downloadLogs}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="destructive" size="sm" onClick={clearOldLogs}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Old
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-4 mb-6">
          <input
            type="text"
            placeholder="Search logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <div key={log.id} className="glass rounded-lg p-4 font-mono text-sm">
              <div className="flex items-start gap-4">
                <Badge className={levelColors[log.level] || 'bg-gray-500/20'}>
                  {log.level.toUpperCase()}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                    {log.page && <span> {log.page}</span>}
                    {log.user_id && <span> User: {log.user_id.slice(0, 8)}...</span>}
                  </div>
                  <p className="text-foreground break-words">{log.message}</p>
                  {log.data && Object.keys(log.data).length > 0 && (
                    <pre className="mt-2 p-2 bg-background/50 rounded text-xs text-muted-foreground overflow-x-auto">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No logs found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Logs;
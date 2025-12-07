import { OTPVerification } from '@/components/OTPVerification';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@clerk/clerk-react';
import { AlertCircle, AlertTriangle, Clock, Filter, Info, Loader2, Shield } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface Log {
  id: string;
  action: string;
  level: 'INFO' | 'WARN' | 'CRITICAL';
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export default function AccountLogs() {
  const [isVerified, setIsVerified] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const { getToken } = useAuth();

  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/logs`, {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Failed to fetch logs', error);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (isVerified) {
      fetchLogs();
    }
  }, [isVerified, fetchLogs]);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'WARN':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'WARN':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 flex items-center space-x-2">
          <Shield className="h-8 w-8" />
          <span>Account Logs</span>
        </h1>

        {!isVerified && (
          <Card>
            <CardHeader>
              <CardTitle>Verification Required</CardTitle>
              <CardDescription>Verify your account to view sensitive logs.</CardDescription>
            </CardHeader>
            <CardContent>
              <OTPVerification onVerified={() => setIsVerified(true)} />
            </CardContent>
          </Card>
        )}

        {isVerified && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Recent Activity</span>
              </CardTitle>
              <CardDescription>Your recent account activity and security events.</CardDescription>
              <p className="text-sm text-muted-foreground mt-2">
                Logs are cached and update every hour. They are not real-time.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select value={filterLevel} onValueChange={setFilterLevel}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by level" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border dark:bg-black/80 dark:border-white/20">
                    <SelectItem value="ALL">All Levels</SelectItem>
                    <SelectItem value="INFO">Info</SelectItem>
                    <SelectItem value="WARN">Warning</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading logs...</span>
                </div>
              ) : (
                (() => {
                  const filteredLogs = logs.filter((log) => {
                    const matchesSearch = log.action
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase());
                    const matchesLevel = filterLevel === 'ALL' || log.level === filterLevel;
                    return matchesSearch && matchesLevel;
                  });

                  return filteredLogs.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {filteredLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-start space-x-3 flex-1">
                            {getLevelIcon(log.level)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="font-medium text-sm">{log.action}</span>
                                <Badge
                                  variant="outline"
                                  className={`text-xs px-2 py-0.5 ${getLevelColor(log.level)}`}
                                >
                                  {log.level}
                                </Badge>
                              </div>
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {Object.entries(log.metadata).map(([key, value]) => (
                                    <span key={key} className="mr-3">
                                      <strong>{key}:</strong> {String(value)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                            {new Date(log.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        {logs.length === 0 ? 'No logs found.' : 'No logs match your filters.'}
                      </p>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

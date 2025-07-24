import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, RefreshCw, AlertTriangle, Zap } from 'lucide-react';
import { IgnitionLog, ExceptionLog, LogType } from '@/types/logs';
import { useFirebaseLogs } from '@/hooks/useFirebaseLogs';

interface LogTableProps {
  logType: LogType;
}

export function LogTable({ logType }: LogTableProps) {
  const [imeiFilter, setImeiFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const { logs, loading, error } = useFirebaseLogs(logType, imeiFilter);

  const handleImeiFilter = () => {
    setImeiFilter(searchTerm);
  };

  const clearFilter = () => {
    setSearchTerm('');
    setImeiFilter('');
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    try {
      // Handle Firestore timestamp
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleString();
      }
      
      // Handle your specific timestamp format: "23/07/2025 20:00:55.143"
      if (typeof timestamp === 'string') {
        // If it's already in a readable format, return as is
        if (timestamp.includes('/') && timestamp.includes(':')) {
          return timestamp;
        }
        // Otherwise try to parse as date
        return new Date(timestamp).toLocaleString();
      }
      
      // Handle regular date string
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp?.toString() || 'Invalid Date';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {logType === 'ignition' ? (
              <Zap className="h-5 w-5 text-blue-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            )}
            {logType === 'ignition' ? 'Ignition Logs' : 'Exception Logs'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-500" />
              <Input
                placeholder="Enter IMEI to filter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48"
                onKeyPress={(e) => e.key === 'Enter' && handleImeiFilter()}
              />
              <Button onClick={handleImeiFilter} size="sm">
                Filter
              </Button>
              {imeiFilter && (
                <Button onClick={clearFilter} variant="outline" size="sm">
                  Clear
                </Button>
              )}
            </div>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {imeiFilter && (
          <div className="text-sm text-gray-600">
            Showing logs for IMEI: <Badge variant="outline">{imeiFilter}</Badge>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IMEI</TableHead>
                  <TableHead>Timestamp</TableHead>
                  {logType === 'ignition' ? (
                    <>
                      <TableHead>Status</TableHead>
                      <TableHead>Voltage</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Error Code</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Severity</TableHead>
                    </>
                  )}
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={logType === 'ignition' ? 5 : 6} className="text-center py-8 text-gray-500">
                      {imeiFilter ? `No ${logType} logs found for IMEI: ${imeiFilter}` : `No ${logType} logs available`}
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        <Badge variant="outline">{log.imei}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatTimestamp(log.createdAt || log.timestamp)}
                      </TableCell>
                      {logType === 'ignition' ? (
                        <>
                          <TableCell>
                            <Badge 
                              variant={(log as IgnitionLog).status === 'ON' ? 'default' : 'secondary'}
                            >
                              {(log as IgnitionLog).status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(log as IgnitionLog).voltage !== undefined && (log as IgnitionLog).voltage !== null ? 
                              `${(log as IgnitionLog).voltage}V` : 'N/A'}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-mono text-sm">
                            {(log as ExceptionLog).errorCode || 'Unknown'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {(log as ExceptionLog).errorMessage || 'No details'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getSeverityColor((log as ExceptionLog).severity)}>
                              {(log as ExceptionLog).severity?.toUpperCase()}
                            </Badge>
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-sm">
                        {log.location && 
                         log.location.lat !== undefined && 
                         log.location.lng !== undefined &&
                         typeof log.location.lat === 'number' && 
                         typeof log.location.lng === 'number' ? 
                          `${log.location.lat.toFixed(4)}, ${log.location.lng.toFixed(4)}` : 
                          'N/A'
                        }
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
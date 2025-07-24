import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Progress } from './ui/progress'
import { Alert, AlertDescription } from './ui/alert'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Wifi, 
  WifiOff, 
  TrendingUp,
  RefreshCw,
  Server,
  Smartphone
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { networkIncidentService } from '../services/networkIncidentService'
import { NetworkIncident, RecoveryMetrics, DeviceRecoveryStatus } from '../types/networkIncident'
import { IgnitionLog, ExceptionLog } from '../types/logs'
import { parseTimestamp } from '../lib/dateUtils'

interface NetworkRecoveryDashboardProps {
  ignitionLogs: IgnitionLog[]
  exceptionLogs: ExceptionLog[]
}

export const NetworkRecoveryDashboard: React.FC<NetworkRecoveryDashboardProps> = ({
  ignitionLogs,
  exceptionLogs
}) => {
  const [incidents, setIncidents] = useState<NetworkIncident[]>([])
  const [metrics, setMetrics] = useState<RecoveryMetrics | null>(null)
  const [networkStatus, setNetworkStatus] = useState<{
    status: 'healthy' | 'degraded' | 'outage'
    affectedDevices: string[]
    lastIncident?: NetworkIncident
  } | null>(null)
  const [deviceStatuses, setDeviceStatuses] = useState<DeviceRecoveryStatus[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const analyzeNetworkData = React.useCallback(() => {
    setRefreshing(true)
    
    const analysis = networkIncidentService.analyzeNetworkEvents(ignitionLogs, exceptionLogs)
    setIncidents(analysis.incidents)
    setMetrics(analysis.metrics)
    
    const currentStatus = networkIncidentService.getCurrentNetworkStatus(analysis.events)
    setNetworkStatus(currentStatus)

    // Get device recovery statuses
    const uniqueDevices = Array.from(new Set([
      ...ignitionLogs.map(log => log.deviceImei || log.imei),
      ...exceptionLogs.map(log => log.deviceImei)
    ].filter(Boolean)))

    const deviceStats = uniqueDevices.map(deviceImei => 
      networkIncidentService.getDeviceRecoveryStatus(deviceImei, analysis.events)
    )
    setDeviceStatuses(deviceStats)
    
    setRefreshing(false)
  }, [ignitionLogs, exceptionLogs])

  useEffect(() => {
    analyzeNetworkData()
  }, [analyzeNetworkData])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'degraded': return 'text-yellow-600'
      case 'outage': return 'text-red-600'
      case 'online': return 'text-green-600'
      case 'offline': return 'text-red-600'
      case 'recovering': return 'text-yellow-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'outage': return <WifiOff className="h-4 w-4 text-red-600" />
      case 'online': return <Wifi className="h-4 w-4 text-green-600" />
      case 'offline': return <WifiOff className="h-4 w-4 text-red-600" />
      case 'recovering': return <RefreshCw className="h-4 w-4 text-yellow-600" />
      default: return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  // Prepare chart data for incident timeline
  const incidentTimelineData = incidents.slice(-10).map(incident => ({
    time: incident.startTime.toLocaleTimeString(),
    duration: incident.duration || 0,
    affectedDevices: incident.affectedDevices.length,
    severity: incident.severity
  }))

  // Prepare recovery pattern data
  const recoveryPatternData = metrics ? [
    { pattern: 'Simultaneous', count: metrics.recoveryPatterns.simultaneous },
    { pattern: 'Gradual', count: metrics.recoveryPatterns.gradual },
    { pattern: 'Partial', count: metrics.recoveryPatterns.partial }
  ] : []

  return (
    <div className="space-y-6">
      {/* Network Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Status</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {networkStatus && getStatusIcon(networkStatus.status)}
              <div className="text-2xl font-bold capitalize">
                {networkStatus?.status || 'Unknown'}
              </div>
            </div>
            {networkStatus?.affectedDevices.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {networkStatus.affectedDevices.length} devices affected
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{incidents.length}</div>
            <p className="text-xs text-muted-foreground">
              {incidents.filter(i => i.status === 'resolved').length} resolved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Recovery Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.averageOutageDuration || 0}m</div>
            <p className="text-xs text-muted-foreground">
              Longest: {metrics?.longestOutage || 0}m
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.recoveryRate || 0}%</div>
            <Progress value={metrics?.recoveryRate || 0} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Current Alerts */}
      {networkStatus?.status !== 'healthy' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Network {networkStatus?.status === 'outage' ? 'Outage' : 'Degradation'} Detected:</strong>
            {' '}{networkStatus?.affectedDevices.length} devices are currently affected.
            Devices: {networkStatus?.affectedDevices.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="incidents" className="w-full">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="incidents">Network Incidents</TabsTrigger>
            <TabsTrigger value="devices">Device Status</TabsTrigger>
            <TabsTrigger value="analytics">Recovery Analytics</TabsTrigger>
          </TabsList>
          <Button 
            onClick={analyzeNetworkData} 
            disabled={refreshing}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Analysis
          </Button>
        </div>

        <TabsContent value="incidents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Network Incidents</CardTitle>
              <CardDescription>
                Timeline of network outages and recovery events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {incidents.slice(-5).reverse().map((incident) => (
                  <div key={incident.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant={incident.severity === 'critical' ? 'destructive' : 
                                     incident.severity === 'high' ? 'default' : 'secondary'}>
                          {incident.severity}
                        </Badge>
                        <Badge variant={incident.status === 'resolved' ? 'default' : 'destructive'}>
                          {incident.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {incident.startTime.toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Duration:</span>
                        <div>{incident.duration ? `${incident.duration}m` : 'Ongoing'}</div>
                      </div>
                      <div>
                        <span className="font-medium">Affected Devices:</span>
                        <div>{incident.affectedDevices.length}</div>
                      </div>
                      <div>
                        <span className="font-medium">Recovered:</span>
                        <div>{incident.recoveredDevices.length}</div>
                      </div>
                      <div>
                        <span className="font-medium">Impact:</span>
                        <div>{incident.impactLevel}%</div>
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <span className="font-medium text-sm">Recovery Pattern:</span>
                      <Badge variant="outline" className="ml-2">
                        {incident.recoveryPattern}
                      </Badge>
                    </div>
                    
                    <div className="mt-2">
                      <span className="font-medium text-sm">Devices:</span>
                      <div className="text-sm text-muted-foreground mt-1">
                        {incident.affectedDevices.join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
                
                {incidents.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No network incidents detected
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Device Recovery Status</CardTitle>
              <CardDescription>
                Individual device connectivity and recovery metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {deviceStatuses.map((device) => (
                  <div key={device.deviceImei} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-2">
                        <Smartphone className="h-4 w-4" />
                        <span className="font-medium">{device.deviceImei}</span>
                        {getStatusIcon(device.status)}
                      </div>
                      <Badge variant={device.reliability > 95 ? 'default' : 
                                   device.reliability > 85 ? 'secondary' : 'destructive'}>
                        {device.reliability}% uptime
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Status:</span>
                        <div className={getStatusColor(device.status)}>
                          {device.status}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Last Seen:</span>
                        <div>{device.lastSeen.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="font-medium">Outages:</span>
                        <div>{device.outageCount}</div>
                      </div>
                      <div>
                        <span className="font-medium">Avg Recovery:</span>
                        <div>{device.averageRecoveryTime}m</div>
                      </div>
                    </div>
                    
                    {device.lastOutage && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium">Last Outage:</span>
                        <span className="ml-2 text-muted-foreground">
                          {device.lastOutage.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                
                {deviceStatuses.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No device data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Incident Timeline</CardTitle>
                <CardDescription>Recent incident duration and impact</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={incidentTimelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="duration" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Duration (min)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="affectedDevices" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      name="Affected Devices"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recovery Patterns</CardTitle>
                <CardDescription>How devices typically recover from outages</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={recoveryPatternData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="pattern" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {metrics?.frequentlyAffectedDevices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Frequently Affected Devices</CardTitle>
                <CardDescription>
                  Devices that experience the most network issues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {metrics.frequentlyAffectedDevices.map((deviceImei) => (
                    <div key={deviceImei} className="flex justify-between items-center p-2 border rounded">
                      <span className="font-medium">{deviceImei}</span>
                      <Badge variant="outline">High Risk</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default NetworkRecoveryDashboard
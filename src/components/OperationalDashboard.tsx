import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { AlertTriangle, Activity, Clock, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import { IgnitionLog, ExceptionLog } from '../types/logs'
import { SeverityLevel, TimeFilter, DeviceStatus, OperationalInsight, LogSummary, SEVERITY_MAPPING, TIME_FILTERS } from '../types/operations'

interface OperationalDashboardProps {
  ignitionLogs: IgnitionLog[]
  exceptionLogs: ExceptionLog[]
  loading: boolean
  onRefresh: () => void
}

export function OperationalDashboard({ ignitionLogs, exceptionLogs, loading, onRefresh }: OperationalDashboardProps) {
  const [timeFilter, setTimeFilter] = useState<string>('24h')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [deviceFilter, setDeviceFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('timestamp')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Get severity for exception
  const getSeverity = (exceptionType: string): SeverityLevel => {
    return SEVERITY_MAPPING[exceptionType] || SEVERITY_MAPPING['Default']
  }

  // Filter data by time
  const filterByTime = (logs: any[], hours: number) => {
    if (hours === 0) return logs // All time
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return logs.filter(log => {
      const logTime = log.createdAt?.toDate?.() || new Date(log.timestamp)
      return logTime >= cutoff
    })
  }

  // Filtered data based on current filters
  const filteredData = useMemo(() => {
    const selectedTimeFilter = TIME_FILTERS.find(f => f.value === timeFilter)
    const hours = selectedTimeFilter?.hours || 24

    let filteredIgnition = filterByTime(ignitionLogs, hours)
    let filteredExceptions = filterByTime(exceptionLogs, hours)

    // Device filter
    if (deviceFilter) {
      const searchTerm = deviceFilter.toLowerCase()
      filteredIgnition = filteredIgnition.filter(log => 
        (log.deviceImei || log.imei || '').toLowerCase().includes(searchTerm)
      )
      filteredExceptions = filteredExceptions.filter(log => 
        (log.deviceImei || log.imei || '').toLowerCase().includes(searchTerm)
      )
    }

    // Severity filter for exceptions
    if (severityFilter !== 'all') {
      filteredExceptions = filteredExceptions.filter(log => {
        const severity = getSeverity(log.main || log.errorCode || '')
        return severity.level === severityFilter
      })
    }

    return { ignition: filteredIgnition, exceptions: filteredExceptions }
  }, [ignitionLogs, exceptionLogs, timeFilter, deviceFilter, severityFilter])

  // Operational insights
  const insights = useMemo((): OperationalInsight[] => {
    const insights: OperationalInsight[] = []
    
    // Critical server down issues
    const serverDownLogs = filteredData.exceptions.filter(log => 
      (log.main || log.errorCode || '').includes('Server Down')
    )
    if (serverDownLogs.length > 0) {
      const affectedDevices = [...new Set(serverDownLogs.map(log => log.deviceImei || log.imei || 'Unknown'))]
      insights.push({
        type: 'critical',
        title: 'Server Connectivity Issues',
        description: 'Multiple devices reporting server unavailability',
        count: serverDownLogs.length,
        devices: affectedDevices,
        action: 'Check server status and network connectivity'
      })
    }

    // Devices with multiple exceptions
    const deviceExceptionCounts = filteredData.exceptions.reduce((acc, log) => {
      const device = log.deviceImei || log.imei || 'Unknown'
      acc[device] = (acc[device] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const problematicDevices = Object.entries(deviceExceptionCounts)
      .filter(([_, count]) => count >= 3)
      .map(([device]) => device)

    if (problematicDevices.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Devices with High Exception Rate',
        description: 'Devices reporting multiple exceptions',
        count: problematicDevices.length,
        devices: problematicDevices,
        action: 'Investigate device health and connectivity'
      })
    }

    // Recent ignition activity
    const recentIgnition = filteredData.ignition.filter(log => {
      const logTime = log.createdAt?.toDate?.() || new Date(log.timestamp || '')
      return Date.now() - logTime.getTime() < 60 * 60 * 1000 // Last hour
    })

    if (recentIgnition.length > 0) {
      const activeDevices = [...new Set(recentIgnition.map(log => log.deviceImei || log.imei || 'Unknown'))]
      insights.push({
        type: 'info',
        title: 'Recent Vehicle Activity',
        description: 'Vehicles with recent ignition events',
        count: recentIgnition.length,
        devices: activeDevices
      })
    }

    return insights
  }, [filteredData])

  // Device status summary
  const deviceStatuses = useMemo((): DeviceStatus[] => {
    const devices = new Map<string, DeviceStatus>()
    
    // Process ignition logs
    filteredData.ignition.forEach(log => {
      const imei = log.deviceImei || log.imei || 'Unknown'
      if (!devices.has(imei)) {
        devices.set(imei, {
          imei,
          lastSeen: new Date(0),
          status: 'offline',
          ignitionCount: 0,
          exceptionCount: 0,
          criticalExceptions: 0
        })
      }
      
      const device = devices.get(imei)!
      device.ignitionCount++
      
      const logTime = log.createdAt?.toDate?.() || new Date(log.timestamp || '')
      if (logTime > device.lastSeen) {
        device.lastSeen = logTime
      }
    })

    // Process exception logs
    filteredData.exceptions.forEach(log => {
      const imei = log.deviceImei || log.imei || 'Unknown'
      if (!devices.has(imei)) {
        devices.set(imei, {
          imei,
          lastSeen: new Date(0),
          status: 'offline',
          ignitionCount: 0,
          exceptionCount: 0,
          criticalExceptions: 0
        })
      }
      
      const device = devices.get(imei)!
      device.exceptionCount++
      device.lastException = log.main || log.errorCode || 'Unknown error'
      
      const severity = getSeverity(log.main || log.errorCode || '')
      if (severity.level === 'critical' || severity.level === 'high') {
        device.criticalExceptions++
      }
      
      const logTime = log.createdAt?.toDate?.() || new Date(log.timestamp || '')
      if (logTime > device.lastSeen) {
        device.lastSeen = logTime
      }
    })

    // Determine device status
    devices.forEach(device => {
      const hoursSinceLastSeen = (Date.now() - device.lastSeen.getTime()) / (1000 * 60 * 60)
      
      if (device.criticalExceptions > 0) {
        device.status = 'critical'
      } else if (device.exceptionCount > 2) {
        device.status = 'warning'
      } else if (hoursSinceLastSeen < 2) {
        device.status = 'online'
      } else {
        device.status = 'offline'
      }
    })

    return Array.from(devices.values()).sort((a, b) => {
      // Sort by status priority: critical > warning > online > offline
      const statusPriority = { critical: 4, warning: 3, online: 2, offline: 1 }
      return statusPriority[b.status] - statusPriority[a.status]
    })
  }, [filteredData])

  // Summary statistics
  const summary: LogSummary = useMemo(() => {
    const criticalExceptions = filteredData.exceptions.filter(log => {
      const severity = getSeverity(log.main || log.errorCode || '')
      return severity.level === 'critical' || severity.level === 'high'
    }).length

    return {
      totalLogs: filteredData.ignition.length + filteredData.exceptions.length,
      criticalIssues: criticalExceptions,
      devicesAffected: deviceStatuses.length,
      lastUpdate: new Date(),
      trends: {
        ignitionEvents: { current: filteredData.ignition.length, previous: 0 },
        exceptions: { current: filteredData.exceptions.length, previous: 0 }
      }
    }
  }, [filteredData, deviceStatuses])

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Operations Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600">Monitor device health and system performance</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                {TIME_FILTERS.map(filter => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Filter by device IMEI..."
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="w-full sm:w-48"
            />
          </div>

          <Button onClick={onRefresh} disabled={loading} variant="outline" size="sm" className="w-full sm:w-auto">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalLogs}</div>
            <p className="text-xs text-muted-foreground">
              {filteredData.ignition.length} ignition, {filteredData.exceptions.length} exceptions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.criticalIssues}</div>
            <p className="text-xs text-muted-foreground">
              Require immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.devicesAffected}</div>
            <p className="text-xs text-muted-foreground">
              Devices with recent activity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary.criticalIssues === 0 ? 'Good' : 'Issues'}
            </div>
            <p className="text-xs text-muted-foreground">
              Last updated: {summary.lastUpdate.toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Operational Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Operational Insights
            </CardTitle>
            <CardDescription>
              Key issues and recommendations based on current data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.map((insight, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  insight.type === 'critical' ? 'bg-red-50 border-red-200' :
                  insight.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={insight.type === 'critical' ? 'destructive' : 'secondary'}>
                        {insight.type.toUpperCase()}
                      </Badge>
                      <h4 className="font-semibold">{insight.title}</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                    <div className="text-sm">
                      <span className="font-medium">Count:</span> {insight.count} | 
                      <span className="font-medium ml-2">Devices:</span> {insight.devices.slice(0, 3).join(', ')}
                      {insight.devices.length > 3 && ` +${insight.devices.length - 3} more`}
                    </div>
                    {insight.action && (
                      <p className="text-sm font-medium text-blue-600 mt-2">
                        💡 {insight.action}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Device Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Device Status Overview</CardTitle>
          <CardDescription>
            Current status and health of all monitored devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {deviceStatuses.map((device) => (
              <div
                key={device.imei}
                className={`p-3 sm:p-4 rounded-lg border ${
                  device.status === 'critical' ? 'bg-red-50 border-red-200' :
                  device.status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                  device.status === 'online' ? 'bg-green-50 border-green-200' :
                  'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs sm:text-sm font-medium truncate flex-1 mr-2">{device.imei}</span>
                  <Badge
                    variant={
                      device.status === 'critical' ? 'destructive' :
                      device.status === 'warning' ? 'secondary' :
                      device.status === 'online' ? 'default' : 'outline'
                    }
                    className="text-xs flex-shrink-0"
                  >
                    {device.status.toUpperCase()}
                  </Badge>
                </div>
                
                <div className="space-y-1 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span>Ignition Events:</span>
                    <span className="font-medium">{device.ignitionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Exceptions:</span>
                    <span className="font-medium">{device.exceptionCount}</span>
                  </div>
                  {device.criticalExceptions > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Critical:</span>
                      <span className="font-medium">{device.criticalExceptions}</span>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-2">
                    Last seen: {device.lastSeen.toLocaleString()}
                  </div>
                  {device.lastException && (
                    <div className="text-xs text-gray-600 mt-1 truncate" title={device.lastException}>
                      Last issue: {device.lastException}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
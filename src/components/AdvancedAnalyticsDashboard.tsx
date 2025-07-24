import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { Calendar } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts'
import { 
  Activity, AlertTriangle, Battery, MapPin, Server, TrendingUp, 
  TrendingDown, Zap, Calendar as CalendarIcon, RefreshCw, Bell,
  BellOff, Volume2, VolumeX, Download, Eye, Settings
} from 'lucide-react'
import { format, subDays, subHours, startOfDay, endOfDay } from 'date-fns'
import { IgnitionLog, ExceptionLog } from '../types/logs'
import { parseTimestamp } from '../lib/dateUtils'
import { 
  DeviceHealthScore, TrendData, DevicePerformanceMetrics, 
  Anomaly, PredictiveAlert, ServerHealth, GeographicData, TimeRange 
} from '../types/analytics'
import { AnalyticsService } from '../services/analyticsService'
import { NotificationService } from '../services/notificationService'

interface AdvancedAnalyticsDashboardProps {
  ignitionLogs: IgnitionLog[]
  exceptionLogs: ExceptionLog[]
  loading: boolean
  onRefresh: () => void
}

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#f97316']

export const AdvancedAnalyticsDashboard: React.FC<AdvancedAnalyticsDashboardProps> = ({
  ignitionLogs,
  exceptionLogs,
  loading,
  onRefresh
}) => {
  const [selectedDevice, setSelectedDevice] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<string>('7d')
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>({
    from: undefined,
    to: undefined
  })
  const [showCalendar, setShowCalendar] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)

  const notificationService = NotificationService.getInstance()

  // Subscribe to notifications
  useEffect(() => {
    const unsubscribe = notificationService.subscribe(setNotifications)
    return unsubscribe
  }, [notificationService])

  // Get unique devices
  const devices = useMemo(() => {
    const deviceSet = new Set([
      ...ignitionLogs.map(log => log.deviceImei),
      ...exceptionLogs.map(log => log.deviceImei)
    ])
    return Array.from(deviceSet).sort()
  }, [ignitionLogs, exceptionLogs])

  // Filter data based on selected device and time range
  const filteredData = useMemo(() => {
    let filteredIgnitions = ignitionLogs
    let filteredExceptions = exceptionLogs

    // Filter by device
    if (selectedDevice !== 'all') {
      filteredIgnitions = ignitionLogs.filter(log => log.deviceImei === selectedDevice)
      filteredExceptions = exceptionLogs.filter(log => log.deviceImei === selectedDevice)
    }

    // Filter by time range
    let startDate: Date
    const endDate = new Date()

    if (timeRange === 'custom' && customDateRange.from && customDateRange.to) {
      startDate = startOfDay(customDateRange.from)
      const customEndDate = endOfDay(customDateRange.to)
      filteredIgnitions = filteredIgnitions.filter(log => {
        const logDate = parseTimestamp(log.timestamp)
        return logDate >= startDate && logDate <= customEndDate
      })
      filteredExceptions = filteredExceptions.filter(log => {
        const logDate = parseTimestamp(log.timestamp)
        return logDate >= startDate && logDate <= customEndDate
      })
    } else {
      switch (timeRange) {
        case '1h':
          startDate = subHours(endDate, 1)
          break
        case '4h':
          startDate = subHours(endDate, 4)
          break
        case '1d':
          startDate = subDays(endDate, 1)
          break
        case '3d':
          startDate = subDays(endDate, 3)
          break
        case '7d':
          startDate = subDays(endDate, 7)
          break
        case '30d':
          startDate = subDays(endDate, 30)
          break
        default:
          startDate = subDays(endDate, 7)
      }

      filteredIgnitions = filteredIgnitions.filter(log => parseTimestamp(log.timestamp) >= startDate)
      filteredExceptions = filteredExceptions.filter(log => parseTimestamp(log.timestamp) >= startDate)
    }

    return { ignitions: filteredIgnitions, exceptions: filteredExceptions }
  }, [ignitionLogs, exceptionLogs, selectedDevice, timeRange, customDateRange])

  // Calculate analytics
  const analytics = useMemo(() => {
    const trendData = AnalyticsService.generateTrendData(
      filteredData.ignitions, 
      filteredData.exceptions,
      timeRange === '30d' ? 30 : 7
    )

    const deviceHealthScores = devices.map(device => 
      AnalyticsService.calculateDeviceHealthScore(device, ignitionLogs, exceptionLogs)
    )

    const deviceMetrics = devices.map(device =>
      AnalyticsService.calculateDevicePerformanceMetrics(device, ignitionLogs, exceptionLogs)
    )

    const anomalies = AnalyticsService.detectAnomalies(ignitionLogs, exceptionLogs)
    const predictiveAlerts = AnalyticsService.generatePredictiveAlerts(ignitionLogs, exceptionLogs)
    const serverHealth = AnalyticsService.calculateServerHealth(exceptionLogs)
    const geographicData = AnalyticsService.generateGeographicData(ignitionLogs, exceptionLogs)

    return {
      trendData,
      deviceHealthScores,
      deviceMetrics,
      anomalies,
      predictiveAlerts,
      serverHealth,
      geographicData
    }
  }, [filteredData, devices, ignitionLogs, exceptionLogs, timeRange])

  // Generate alerts based on analytics
  useEffect(() => {
    if (!notificationsEnabled) return

    // Check for server down alerts
    if (analytics.serverHealth.status === 'offline') {
      notificationService.addNotification(
        NotificationService.createServerDownAlert(analytics.serverHealth.totalDevices)
      )
    }

    // Check for device offline alerts
    analytics.deviceMetrics.forEach(metric => {
      const hoursSinceLastSeen = (Date.now() - metric.lastSeen.getTime()) / (1000 * 60 * 60)
      if (hoursSinceLastSeen > 2) {
        notificationService.addNotification(
          NotificationService.createDeviceOfflineAlert(metric.imei)
        )
      }
    })

    // Check for battery alerts
    analytics.deviceMetrics.forEach(metric => {
      if (metric.averageVoltage > 0 && metric.averageVoltage < 11.5) {
        notificationService.addNotification(
          NotificationService.createBatteryLowAlert(metric.imei, metric.averageVoltage)
        )
      }
    })

    // Check for anomalies
    analytics.anomalies.forEach(anomaly => {
      if (anomaly.severity === 'critical' || anomaly.severity === 'high') {
        notificationService.addNotification(
          NotificationService.createAnomalyAlert(anomaly.imei, anomaly.type, anomaly.description)
        )
      }
    })
  }, [analytics, notificationsEnabled, notificationService])

  const handleNotificationToggle = () => {
    const newState = !notificationsEnabled
    setNotificationsEnabled(newState)
    notificationService.setEnabled(newState)
  }

  const handleSoundToggle = () => {
    const newState = !soundEnabled
    setSoundEnabled(newState)
    notificationService.setSoundEnabled(newState)
  }

  const exportData = () => {
    const data = {
      timeRange,
      selectedDevice,
      analytics: {
        ...analytics,
        exportedAt: new Date().toISOString()
      }
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select Device" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices ({devices.length})</SelectItem>
                {devices.map(device => (
                  <SelectItem key={device} value={device}>
                    {device}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="4h">Last 4 Hours</SelectItem>
                <SelectItem value="1d">Today</SelectItem>
                <SelectItem value="3d">Last 3 Days</SelectItem>
                <SelectItem value="7d">Last Week</SelectItem>
                <SelectItem value="30d">Last Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {timeRange === 'custom' && (
              <Popover open={showCalendar} onOpenChange={setShowCalendar}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-48 justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span className="truncate">
                      {customDateRange.from ? (
                        customDateRange.to ? (
                          <>
                            {format(customDateRange.from, "LLL dd")} -{" "}
                            {format(customDateRange.to, "LLL dd")}
                          </>
                        ) : (
                          format(customDateRange.from, "LLL dd, y")
                        )
                      ) : (
                        "Pick a date range"
                      )}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customDateRange.from}
                    selected={customDateRange}
                    onSelect={setCustomDateRange}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNotificationToggle}
              className={`${notificationsEnabled ? 'text-blue-600' : 'text-gray-400'} flex-shrink-0`}
            >
              {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">Alerts</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleSoundToggle}
              className={`${soundEnabled ? 'text-blue-600' : 'text-gray-400'} flex-shrink-0`}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">Sound</span>
            </Button>

            <Button variant="outline" size="sm" onClick={exportData} className="flex-shrink-0">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>

            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="flex-shrink-0">
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Notifications Panel */}
      {notifications.filter(n => !n.acknowledged).length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <div className="flex items-center justify-between">
              <span>
                {notifications.filter(n => !n.acknowledged).length} unacknowledged alert(s)
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  notifications.filter(n => !n.acknowledged).forEach(n => {
                    notificationService.acknowledgeNotification(n.id, 'Operations Team')
                  })
                }}
              >
                Acknowledge All
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 gap-1 h-auto p-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Overview</TabsTrigger>
          <TabsTrigger value="trends" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Trends</TabsTrigger>
          <TabsTrigger value="devices" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Devices</TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Alerts</TabsTrigger>
          <TabsTrigger value="server" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Server</TabsTrigger>
          <TabsTrigger value="map" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Map</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{devices.length}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.geographicData.filter(d => d.status === 'online').length} online
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Server Health</CardTitle>
                <Server className={`h-4 w-4 ${
                  analytics.serverHealth.status === 'online' ? 'text-green-500' :
                  analytics.serverHealth.status === 'degraded' ? 'text-yellow-500' : 'text-red-500'
                }`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.serverHealth.uptime.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.serverHealth.status.toUpperCase()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {analytics.anomalies.filter(a => a.severity === 'critical').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.anomalies.length} total anomalies
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Health Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.deviceHealthScores.length > 0 
                    ? Math.round(analytics.deviceHealthScores.reduce((sum, d) => sum + d.score, 0) / analytics.deviceHealthScores.length)
                    : 0
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  Out of 100
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Insights</CardTitle>
              <CardDescription>Key operational insights for immediate action</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.serverHealth.status !== 'online' && (
                <Alert className="border-red-200 bg-red-50">
                  <Server className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Server Issue:</strong> Server is {analytics.serverHealth.status}. 
                    {analytics.serverHealth.connectedDevices} of {analytics.serverHealth.totalDevices} devices affected.
                    <Badge variant="destructive" className="ml-2">Action Required</Badge>
                  </AlertDescription>
                </Alert>
              )}

              {analytics.anomalies.filter(a => a.severity === 'critical' || a.severity === 'high').slice(0, 3).map(anomaly => (
                <Alert key={anomaly.id} className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>Device {anomaly.imei}:</strong> {anomaly.description}
                    <Badge variant="outline" className="ml-2">{anomaly.type}</Badge>
                  </AlertDescription>
                </Alert>
              ))}

              {analytics.predictiveAlerts.filter(a => a.probability > 70).slice(0, 2).map(alert => (
                <Alert key={alert.id} className="border-blue-200 bg-blue-50">
                  <TrendingDown className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Predictive Alert:</strong> {alert.description}
                    <Badge variant="outline" className="ml-2">{alert.probability}% probability</Badge>
                  </AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Exception Trends</CardTitle>
                <CardDescription>Daily exception patterns over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="exceptions" stroke="#ef4444" strokeWidth={2} />
                    <Line type="monotone" dataKey="criticalIssues" stroke="#dc2626" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity Overview</CardTitle>
                <CardDescription>Ignitions vs Exceptions comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="ignitions" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="exceptions" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Server Downtime Analysis</CardTitle>
              <CardDescription>Server availability and downtime patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="serverDowntime" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Device Health Scores</CardTitle>
                <CardDescription>Overall health assessment for each device</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.deviceHealthScores.map(device => (
                    <div key={device.imei} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{device.imei}</div>
                        <div className="text-sm text-muted-foreground">
                          Last updated: {format(device.lastCalculated, 'MMM dd, HH:mm')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          device.score >= 80 ? 'text-green-600' :
                          device.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {device.score}
                        </div>
                        <div className="text-sm text-muted-foreground">/ 100</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Key performance indicators per device</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.deviceMetrics.map(metric => (
                    <div key={metric.imei} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{metric.imei}</h4>
                        <Badge variant={metric.uptime > 95 ? 'default' : metric.uptime > 80 ? 'secondary' : 'destructive'}>
                          {metric.uptime.toFixed(1)}% uptime
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">MTBF:</span>
                          <span className="ml-2 font-medium">{metric.mtbf.toFixed(1)}h</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Exceptions:</span>
                          <span className="ml-2 font-medium">{metric.totalExceptions}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Voltage:</span>
                          <span className="ml-2 font-medium">
                            {metric.averageVoltage > 0 ? `${metric.averageVoltage.toFixed(2)}V` : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last Seen:</span>
                          <span className="ml-2 font-medium">{format(metric.lastSeen, 'MMM dd, HH:mm')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Anomaly Detection</CardTitle>
                <CardDescription>Unusual patterns detected in device behavior</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.anomalies.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No anomalies detected</p>
                  ) : (
                    analytics.anomalies.map(anomaly => (
                      <Alert key={anomaly.id} className={
                        anomaly.severity === 'critical' ? 'border-red-200 bg-red-50' :
                        anomaly.severity === 'high' ? 'border-orange-200 bg-orange-50' :
                        'border-yellow-200 bg-yellow-50'
                      }>
                        <AlertTriangle className={`h-4 w-4 ${
                          anomaly.severity === 'critical' ? 'text-red-600' :
                          anomaly.severity === 'high' ? 'text-orange-600' : 'text-yellow-600'
                        }`} />
                        <AlertDescription>
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium">Device {anomaly.imei}</div>
                              <div className="text-sm">{anomaly.description}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {anomaly.recommendation}
                              </div>
                            </div>
                            <Badge variant={
                              anomaly.severity === 'critical' ? 'destructive' :
                              anomaly.severity === 'high' ? 'secondary' : 'outline'
                            }>
                              {anomaly.severity}
                            </Badge>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Predictive Alerts</CardTitle>
                <CardDescription>Potential issues predicted based on trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.predictiveAlerts.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No predictive alerts</p>
                  ) : (
                    analytics.predictiveAlerts.map(alert => (
                      <Alert key={alert.id} className="border-blue-200 bg-blue-50">
                        <TrendingDown className="h-4 w-4 text-blue-600" />
                        <AlertDescription>
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium">Device {alert.imei}</div>
                              <div className="text-sm">{alert.description}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                ETA: {Math.round(alert.estimatedTimeToFailure)} hours
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {alert.recommendation}
                              </div>
                            </div>
                            <Badge variant="outline">
                              {alert.probability}%
                            </Badge>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Server Tab */}
        <TabsContent value="server" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Server Status</CardTitle>
                <Server className={`h-4 w-4 ${
                  analytics.serverHealth.status === 'online' ? 'text-green-500' :
                  analytics.serverHealth.status === 'degraded' ? 'text-yellow-500' : 'text-red-500'
                }`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">
                  {analytics.serverHealth.status}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.serverHealth.uptime.toFixed(2)}% uptime
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Connected Devices</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.serverHealth.connectedDevices}
                </div>
                <p className="text-xs text-muted-foreground">
                  of {analytics.serverHealth.totalDevices} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.serverHealth.responseTime}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Average response
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Server Health Details</CardTitle>
              <CardDescription>Detailed server monitoring information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Uptime Statistics</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Current Uptime:</span>
                      <span className="font-medium">{analytics.serverHealth.uptime.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Downtime Today:</span>
                      <span className="font-medium">{analytics.serverHealth.downtimeToday} minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Downtime:</span>
                      <span className="font-medium">
                        {analytics.serverHealth.lastDowntime 
                          ? format(analytics.serverHealth.lastDowntime, 'MMM dd, HH:mm')
                          : 'None recorded'
                        }
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Connection Statistics</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total Devices:</span>
                      <span className="font-medium">{analytics.serverHealth.totalDevices}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Connected:</span>
                      <span className="font-medium text-green-600">{analytics.serverHealth.connectedDevices}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Disconnected:</span>
                      <span className="font-medium text-red-600">
                        {analytics.serverHealth.totalDevices - analytics.serverHealth.connectedDevices}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {analytics.serverHealth.status !== 'online' && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Server Issue Detected:</strong> The server is currently {analytics.serverHealth.status}.
                    This affects end-user service availability. Immediate attention required.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Map Tab */}
        <TabsContent value="map" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Device Locations (Pakistan)</CardTitle>
              <CardDescription>Geographic distribution and health status of devices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.geographicData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No location data available. Devices need to report GPS coordinates.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analytics.geographicData.map(device => (
                      <Card key={device.imei} className="border">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-medium">{device.imei}</div>
                              <div className="text-sm text-muted-foreground">{device.location}</div>
                            </div>
                            <Badge variant={
                              device.status === 'online' ? 'default' :
                              device.status === 'warning' ? 'secondary' :
                              device.status === 'critical' ? 'destructive' : 'outline'
                            }>
                              {device.status}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Health Score:</span>
                              <span className={`font-medium ${
                                device.healthScore >= 80 ? 'text-green-600' :
                                device.healthScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {device.healthScore}/100
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Coordinates:</span>
                              <span className="font-mono text-xs">
                                {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Last Seen:</span>
                              <span>{format(device.lastSeen, 'MMM dd, HH:mm')}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Map placeholder - would integrate with actual map service */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Interactive Map</h3>
                  <p className="text-gray-500">
                    Integration with Google Maps or similar service would show device locations
                    on an interactive map of Pakistan with color-coded health status indicators.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
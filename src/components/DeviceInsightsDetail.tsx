import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Calendar } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts'
import { 
  ArrowLeft, Activity, AlertTriangle, Battery, MapPin, 
  TrendingUp, TrendingDown, Zap, Calendar as CalendarIcon,
  Clock, Signal, Thermometer
} from 'lucide-react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { IgnitionLog, ExceptionLog } from '../types/logs'
import { parseTimestamp } from '../lib/dateUtils'
import { AnalyticsService } from '../services/analyticsService'
import { VehicleService } from '../services/vehicleService'

interface DeviceInsightsDetailProps {
  deviceImei: string
  ignitionLogs: IgnitionLog[]
  exceptionLogs: ExceptionLog[]
  onBack: () => void
}

export const DeviceInsightsDetail: React.FC<DeviceInsightsDetailProps> = ({
  deviceImei,
  ignitionLogs,
  exceptionLogs,
  onBack
}) => {
  const [timeRange, setTimeRange] = useState<string>('7d')
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>({
    from: undefined,
    to: undefined
  })
  const [showCalendar, setShowCalendar] = useState(false)

  // Filter data for this device and time range
  const deviceData = useMemo(() => {
    const deviceIgnitions = ignitionLogs.filter(log => 
      (log.deviceImei === deviceImei) || (log.imei === deviceImei)
    )
    const deviceExceptions = exceptionLogs.filter(log => 
      (log.deviceImei === deviceImei) || (log.imei === deviceImei)
    )

    // Filter by time range
    let startDate: Date
    const endDate = new Date()

    if (timeRange === 'custom' && customDateRange.from && customDateRange.to) {
      startDate = startOfDay(customDateRange.from)
      const customEndDate = endOfDay(customDateRange.to)
      return {
        ignitions: deviceIgnitions.filter(log => {
          const logDate = parseTimestamp(log.timestamp)
          return logDate >= startDate && logDate <= customEndDate
        }),
        exceptions: deviceExceptions.filter(log => {
          const logDate = parseTimestamp(log.timestamp)
          return logDate >= startDate && logDate <= customEndDate
        })
      }
    } else {
      switch (timeRange) {
        case '1h':
          startDate = new Date(Date.now() - 60 * 60 * 1000)
          break
        case '4h':
          startDate = new Date(Date.now() - 4 * 60 * 60 * 1000)
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

      return {
        ignitions: deviceIgnitions.filter(log => parseTimestamp(log.timestamp) >= startDate),
        exceptions: deviceExceptions.filter(log => parseTimestamp(log.timestamp) >= startDate)
      }
    }
  }, [deviceImei, ignitionLogs, exceptionLogs, timeRange, customDateRange])

  // Calculate device analytics
  const analytics = useMemo(() => {
    const deviceIgnitionLogs = ignitionLogs.filter(log => 
      (log.deviceImei === deviceImei) || (log.imei === deviceImei)
    )
    const deviceExceptionLogs = exceptionLogs.filter(log => 
      (log.deviceImei === deviceImei) || (log.imei === deviceImei)
    )

    const healthScore = AnalyticsService.calculateDeviceHealthScore(
      deviceImei, 
      deviceIgnitionLogs,
      deviceExceptionLogs
    )

    const performanceMetrics = AnalyticsService.calculateDevicePerformanceMetrics(
      deviceImei,
      deviceIgnitionLogs,
      deviceExceptionLogs
    )

    const anomalies = AnalyticsService.detectAnomalies(
      deviceIgnitionLogs,
      deviceExceptionLogs
    )

    const predictiveAlerts = AnalyticsService.generatePredictiveAlerts(
      deviceIgnitionLogs,
      deviceExceptionLogs
    )

    // Generate hourly activity data
    const hourlyData = []
    const hours = timeRange === '1d' ? 24 : timeRange === '3d' ? 72 : 168 // 7 days default
    
    for (let i = hours - 1; i >= 0; i--) {
      const hourStart = new Date(Date.now() - i * 60 * 60 * 1000)
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
      
      const hourIgnitions = deviceData.ignitions.filter(log => {
        const logDate = parseTimestamp(log.timestamp)
        return logDate >= hourStart && logDate < hourEnd
      })
      
      const hourExceptions = deviceData.exceptions.filter(log => {
        const logDate = parseTimestamp(log.timestamp)
        return logDate >= hourStart && logDate < hourEnd
      })

      hourlyData.push({
        time: format(hourStart, timeRange === '1d' ? 'HH:mm' : 'MMM dd HH:mm'),
        ignitions: hourIgnitions.length,
        exceptions: hourExceptions.length,
        voltage: hourIgnitions.length > 0 
          ? hourIgnitions.reduce((sum, log) => sum + (log.voltage || 0), 0) / hourIgnitions.length 
          : null
      })
    }

    // Exception severity breakdown
    const severityBreakdown = {
      critical: deviceData.exceptions.filter(e => 
        e.main?.toLowerCase().includes('server down') ||
        e.main?.toLowerCase().includes('critical')
      ).length,
      high: deviceData.exceptions.filter(e => 
        e.main?.toLowerCase().includes('timeout') ||
        e.main?.toLowerCase().includes('connection')
      ).length,
      medium: deviceData.exceptions.filter(e => 
        e.main?.toLowerCase().includes('retry') ||
        e.main?.toLowerCase().includes('phase')
      ).length,
      low: deviceData.exceptions.filter(e => 
        e.main?.toLowerCase().includes('warning') ||
        e.main?.toLowerCase().includes('low')
      ).length
    }

    return {
      healthScore,
      performanceMetrics,
      anomalies,
      predictiveAlerts,
      hourlyData,
      severityBreakdown
    }
  }, [deviceImei, ignitionLogs, exceptionLogs, deviceData, timeRange])

  // Get latest location
  const latestLocation = useMemo(() => {
    const logsWithLocation = deviceData.ignitions.filter(log => log.location?.latitude && log.location?.longitude)
    if (logsWithLocation.length === 0) return null
    
    const latest = logsWithLocation.sort((a, b) => parseTimestamp(b.timestamp).getTime() - parseTimestamp(a.timestamp).getTime())[0]
    return latest.location
  }, [deviceData.ignitions])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{VehicleService.getVehicleDisplayName(deviceImei)}</h1>
            <p className="text-muted-foreground">
              Detailed insights and analytics
              {deviceImei !== VehicleService.getVehicleDisplayName(deviceImei) && 
                ` • IMEI: ${deviceImei}`
              }
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
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
                <Button variant="outline" className="w-48">
                  <CalendarIcon className="mr-2 h-4 w-4" />
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
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={customDateRange.from}
                  selected={customDateRange}
                  onSelect={setCustomDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <Activity className={`h-4 w-4 ${
              analytics.healthScore.score >= 80 ? 'text-green-500' :
              analytics.healthScore.score >= 60 ? 'text-yellow-500' : 'text-red-500'
            }`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              analytics.healthScore.score >= 80 ? 'text-green-600' :
              analytics.healthScore.score >= 60 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {analytics.healthScore.score}
            </div>
            <p className="text-xs text-muted-foreground">Out of 100</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.performanceMetrics.uptime.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              MTBF: {analytics.performanceMetrics.mtbf.toFixed(1)}h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exceptions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {deviceData.exceptions.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.severityBreakdown.critical} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Battery</CardTitle>
            <Battery className={`h-4 w-4 ${
              analytics.performanceMetrics.averageVoltage >= 12.0 ? 'text-green-500' :
              analytics.performanceMetrics.averageVoltage >= 11.5 ? 'text-yellow-500' : 'text-red-500'
            }`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.performanceMetrics.averageVoltage > 0 
                ? `${analytics.performanceMetrics.averageVoltage.toFixed(2)}V`
                : 'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">Average voltage</p>
          </CardContent>
        </Card>
      </div>

      {/* Health Score Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Health Score Breakdown</CardTitle>
          <CardDescription>Detailed analysis of device health factors</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {analytics.healthScore.factors.connectivity}
              </div>
              <div className="text-sm text-muted-foreground">Connectivity</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {analytics.healthScore.factors.batteryHealth}
              </div>
              <div className="text-sm text-muted-foreground">Battery Health</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {analytics.healthScore.factors.errorRate}
              </div>
              <div className="text-sm text-muted-foreground">Error Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {analytics.healthScore.factors.uptime}
              </div>
              <div className="text-sm text-muted-foreground">Uptime</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
            <CardDescription>Ignitions and exceptions over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analytics.hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="ignitions" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                <Area type="monotone" dataKey="exceptions" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voltage Trend</CardTitle>
            <CardDescription>Battery voltage over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.hourlyData.filter(d => d.voltage !== null)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                <Tooltip />
                <Line type="monotone" dataKey="voltage" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Exception Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Exception Analysis</CardTitle>
          <CardDescription>Breakdown of exception types and severity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {analytics.severityBreakdown.critical}
              </div>
              <div className="text-sm text-muted-foreground">Critical</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {analytics.severityBreakdown.high}
              </div>
              <div className="text-sm text-muted-foreground">High</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {analytics.severityBreakdown.medium}
              </div>
              <div className="text-sm text-muted-foreground">Medium</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {analytics.severityBreakdown.low}
              </div>
              <div className="text-sm text-muted-foreground">Low</div>
            </div>
          </div>

          {/* Recent Exceptions */}
          <div className="space-y-2">
            <h4 className="font-medium">Recent Exceptions</h4>
            {deviceData.exceptions.slice(0, 5).map((exception, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{exception.main}</div>
                  <div className="text-sm text-muted-foreground">{exception.details}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {format(parseTimestamp(exception.timestamp), 'MMM dd, HH:mm')}
                  </div>
                  <Badge variant={
                    exception.main?.toLowerCase().includes('server down') ? 'destructive' :
                    exception.main?.toLowerCase().includes('timeout') ? 'secondary' : 'outline'
                  }>
                    {exception.main?.toLowerCase().includes('server down') ? 'Critical' :
                     exception.main?.toLowerCase().includes('timeout') ? 'High' : 'Medium'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alerts and Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Active Anomalies</CardTitle>
            <CardDescription>Unusual patterns detected for this device</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.anomalies.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No anomalies detected</p>
            ) : (
              <div className="space-y-3">
                {analytics.anomalies.map(anomaly => (
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
                          <div className="font-medium">{anomaly.description}</div>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Predictive Insights</CardTitle>
            <CardDescription>Potential issues based on current trends</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.predictiveAlerts.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No predictive alerts</p>
            ) : (
              <div className="space-y-3">
                {analytics.predictiveAlerts.map(alert => (
                  <Alert key={alert.id} className="border-blue-200 bg-blue-50">
                    <TrendingDown className="h-4 w-4 text-blue-600" />
                    <AlertDescription>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{alert.description}</div>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Location Information */}
      {latestLocation && (
        <Card>
          <CardHeader>
            <CardTitle>Location Information</CardTitle>
            <CardDescription>Latest known location and movement data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="font-medium">Coordinates</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {latestLocation.latitude.toFixed(6)}, {latestLocation.longitude.toFixed(6)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-green-500" />
                <div>
                  <div className="font-medium">Last Update</div>
                  <div className="text-sm text-muted-foreground">
                    {format(analytics.performanceMetrics.lastSeen, 'MMM dd, yyyy HH:mm')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Signal className="h-5 w-5 text-purple-500" />
                <div>
                  <div className="font-medium">Location Accuracy</div>
                  <div className="text-sm text-muted-foreground">
                    {analytics.performanceMetrics.locationAccuracy}%
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
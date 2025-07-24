import { IgnitionLog, ExceptionLog } from '../types/logs'
import { 
  DeviceHealthScore, 
  TrendData, 
  DevicePerformanceMetrics, 
  Anomaly, 
  PredictiveAlert,
  ServerHealth,
  GeographicData
} from '../types/analytics'
import { format, subDays, subHours, startOfDay, endOfDay } from 'date-fns'
import { parseTimestamp, getSafeTimestamp } from '../lib/dateUtils'

export class AnalyticsService {
  static calculateDeviceHealthScore(
    imei: string, 
    ignitionLogs: IgnitionLog[], 
    exceptionLogs: ExceptionLog[]
  ): DeviceHealthScore {
    const deviceIgnitions = ignitionLogs.filter(log => log.deviceImei === imei)
    const deviceExceptions = exceptionLogs.filter(log => log.deviceImei === imei)
    
    // Calculate connectivity score (based on recent activity)
    const recentLogs = [...deviceIgnitions, ...deviceExceptions]
      .filter(log => {
        const logDate = parseTimestamp(log.timestamp)
        const hourAgo = subHours(new Date(), 1)
        return logDate > hourAgo
      })
    const connectivity = Math.min(100, recentLogs.length * 10)
    
    // Calculate battery health (based on voltage trends)
    const voltageReadings = deviceIgnitions
      .filter(log => log.voltage)
      .map(log => log.voltage!)
      .slice(-10) // Last 10 readings
    
    const avgVoltage = voltageReadings.length > 0 
      ? voltageReadings.reduce((a, b) => a + b, 0) / voltageReadings.length 
      : 12.0
    
    const batteryHealth = Math.max(0, Math.min(100, (avgVoltage / 12.6) * 100))
    
    // Calculate error rate (lower is better)
    const totalLogs = deviceIgnitions.length + deviceExceptions.length
    const errorRate = totalLogs > 0 
      ? Math.max(0, 100 - (deviceExceptions.length / totalLogs) * 100)
      : 100
    
    // Calculate uptime (based on recent activity)
    const dayAgo = subDays(new Date(), 1)
    const recentActivity = recentLogs.filter(log => parseTimestamp(log.timestamp) > dayAgo)
    const uptime = Math.min(100, recentActivity.length * 5)
    
    // Overall score (weighted average)
    const score = Math.round(
      (connectivity * 0.3) + 
      (batteryHealth * 0.25) + 
      (errorRate * 0.25) + 
      (uptime * 0.2)
    )
    
    return {
      imei,
      score,
      factors: {
        connectivity: Math.round(connectivity),
        batteryHealth: Math.round(batteryHealth),
        errorRate: Math.round(errorRate),
        uptime: Math.round(uptime)
      },
      lastCalculated: new Date()
    }
  }
  
  static generateTrendData(
    ignitionLogs: IgnitionLog[], 
    exceptionLogs: ExceptionLog[],
    days: number = 7
  ): TrendData[] {
    const trends: TrendData[] = []
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayStart = startOfDay(date)
      const dayEnd = endOfDay(date)
      
      const dayIgnitions = ignitionLogs.filter(log => {
        const logDate = parseTimestamp(log.timestamp)
        return logDate >= dayStart && logDate <= dayEnd
      })
      
      const dayExceptions = exceptionLogs.filter(log => {
        const logDate = parseTimestamp(log.timestamp)
        return logDate >= dayStart && logDate <= dayEnd
      })
      
      const criticalIssues = dayExceptions.filter(log => 
        log.main?.toLowerCase().includes('server down') ||
        log.main?.toLowerCase().includes('connection timeout')
      ).length
      
      const serverDowntime = dayExceptions.filter(log =>
        log.main?.toLowerCase().includes('server down')
      ).length
      
      trends.push({
        date: format(date, 'MMM dd'),
        exceptions: dayExceptions.length,
        ignitions: dayIgnitions.length,
        criticalIssues,
        serverDowntime
      })
    }
    
    return trends
  }
  
  static calculateDevicePerformanceMetrics(
    imei: string,
    ignitionLogs: IgnitionLog[],
    exceptionLogs: ExceptionLog[]
  ): DevicePerformanceMetrics {
    const deviceIgnitions = ignitionLogs.filter(log => log.deviceImei === imei)
    const deviceExceptions = exceptionLogs.filter(log => log.deviceImei === imei)
    
    // Calculate uptime (percentage of time device was responsive)
    const totalHours = 24 * 7 // Last 7 days
    const activeHours = new Set(
      [...deviceIgnitions, ...deviceExceptions]
        .filter(log => {
          const logDate = parseTimestamp(log.timestamp)
          const weekAgo = subDays(new Date(), 7)
          return logDate > weekAgo
        })
        .map(log => format(parseTimestamp(log.timestamp), 'yyyy-MM-dd-HH'))
    ).size
    
    const uptime = (activeHours / totalHours) * 100
    
    // Calculate MTBF (Mean Time Between Failures)
    const failures = deviceExceptions.filter(log => 
      log.main?.toLowerCase().includes('server down') ||
      log.main?.toLowerCase().includes('connection timeout') ||
      log.main?.toLowerCase().includes('error')
    )
    
    const mtbf = failures.length > 1 
      ? totalHours / failures.length 
      : totalHours
    
    // Get last seen
    const allLogs = [...deviceIgnitions, ...deviceExceptions]
      .sort((a, b) => getSafeTimestamp(b.timestamp) - getSafeTimestamp(a.timestamp))
    
    const lastSeen = allLogs.length > 0 ? parseTimestamp(allLogs[0].timestamp) : new Date()
    
    // Calculate average voltage
    const voltageReadings = deviceIgnitions
      .filter(log => log.voltage)
      .map(log => log.voltage!)
    
    const averageVoltage = voltageReadings.length > 0
      ? voltageReadings.reduce((a, b) => a + b, 0) / voltageReadings.length
      : 0
    
    return {
      imei,
      uptime: Math.round(uptime * 100) / 100,
      mtbf: Math.round(mtbf * 100) / 100,
      totalExceptions: deviceExceptions.length,
      criticalExceptions: failures.length,
      lastSeen,
      averageVoltage: Math.round(averageVoltage * 100) / 100,
      locationAccuracy: 95 // Placeholder - would calculate from GPS data
    }
  }
  
  static detectAnomalies(
    ignitionLogs: IgnitionLog[],
    exceptionLogs: ExceptionLog[]
  ): Anomaly[] {
    const anomalies: Anomaly[] = []
    
    // Group by device
    const deviceGroups = new Map<string, { ignitions: IgnitionLog[], exceptions: ExceptionLog[] }>()
    
    ignitionLogs.forEach(log => {
      if (!deviceGroups.has(log.deviceImei)) {
        deviceGroups.set(log.deviceImei, { ignitions: [], exceptions: [] })
      }
      deviceGroups.get(log.deviceImei)!.ignitions.push(log)
    })
    
    exceptionLogs.forEach(log => {
      if (!deviceGroups.has(log.deviceImei)) {
        deviceGroups.set(log.deviceImei, { ignitions: [], exceptions: [] })
      }
      deviceGroups.get(log.deviceImei)!.exceptions.push(log)
    })
    
    // Detect anomalies for each device
    deviceGroups.forEach(({ ignitions, exceptions }, imei) => {
      // Voltage drop detection
      const recentVoltages = ignitions
        .filter(log => log.voltage)
        .slice(-5)
        .map(log => log.voltage!)
      
      if (recentVoltages.length >= 3) {
        const avgVoltage = recentVoltages.reduce((a, b) => a + b, 0) / recentVoltages.length
        if (avgVoltage < 11.5) {
          anomalies.push({
            id: `voltage_${imei}_${Date.now()}`,
            imei,
            type: 'voltage_drop',
            severity: avgVoltage < 11.0 ? 'critical' : 'high',
            description: `Low voltage detected: ${avgVoltage.toFixed(2)}V`,
            detectedAt: new Date(),
            value: avgVoltage,
            threshold: 11.5,
            recommendation: 'Check battery and charging system'
          })
        }
      }
      
      // Frequent restarts detection
      const recentExceptions = exceptions.filter(log => {
        const logDate = parseTimestamp(log.timestamp)
        const hourAgo = subHours(new Date(), 1)
        return logDate > hourAgo
      })
      
      if (recentExceptions.length > 5) {
        anomalies.push({
          id: `restarts_${imei}_${Date.now()}`,
          imei,
          type: 'frequent_restarts',
          severity: 'high',
          description: `${recentExceptions.length} exceptions in the last hour`,
          detectedAt: new Date(),
          value: recentExceptions.length,
          threshold: 5,
          recommendation: 'Investigate device stability and network connectivity'
        })
      }
    })
    
    return anomalies
  }
  
  static generatePredictiveAlerts(
    ignitionLogs: IgnitionLog[],
    exceptionLogs: ExceptionLog[]
  ): PredictiveAlert[] {
    const alerts: PredictiveAlert[] = []
    
    // Group by device
    const deviceGroups = new Map<string, { ignitions: IgnitionLog[], exceptions: ExceptionLog[] }>()
    
    ignitionLogs.forEach(log => {
      if (!deviceGroups.has(log.deviceImei)) {
        deviceGroups.set(log.deviceImei, { ignitions: [], exceptions: [] })
      }
      deviceGroups.get(log.deviceImei)!.ignitions.push(log)
    })
    
    exceptionLogs.forEach(log => {
      if (!deviceGroups.has(log.deviceImei)) {
        deviceGroups.set(log.deviceImei, { ignitions: [], exceptions: [] })
      }
      deviceGroups.get(log.deviceImei)!.exceptions.push(log)
    })
    
    deviceGroups.forEach(({ ignitions, exceptions }, imei) => {
      // Battery failure prediction
      const voltageReadings = ignitions
        .filter(log => log.voltage)
        .slice(-10)
        .map(log => ({ voltage: log.voltage!, timestamp: parseTimestamp(log.timestamp) }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      
      if (voltageReadings.length >= 5) {
        const trend = this.calculateVoltageTrend(voltageReadings)
        if (trend < -0.1) { // Declining voltage
          const currentVoltage = voltageReadings[voltageReadings.length - 1].voltage
          const estimatedFailureTime = (currentVoltage - 10.5) / Math.abs(trend) // Hours until 10.5V
          
          if (estimatedFailureTime < 72) { // Less than 3 days
            alerts.push({
              id: `battery_${imei}_${Date.now()}`,
              imei,
              type: 'battery_failure',
              probability: Math.min(95, Math.max(20, 100 - (estimatedFailureTime / 72) * 100)),
              estimatedTimeToFailure: Math.max(1, estimatedFailureTime),
              description: `Battery voltage declining at ${Math.abs(trend).toFixed(3)}V/hour`,
              recommendation: 'Schedule battery replacement within 48 hours',
              createdAt: new Date()
            })
          }
        }
      }
      
      // Connection degradation prediction
      const recentExceptions = exceptions
        .filter(log => {
          const logDate = parseTimestamp(log.timestamp)
          const daysAgo = subDays(new Date(), 3)
          return logDate > daysAgo
        })
        .filter(log => 
          log.main?.toLowerCase().includes('connection') ||
          log.main?.toLowerCase().includes('timeout') ||
          log.main?.toLowerCase().includes('server')
        )
      
      if (recentExceptions.length > 10) {
        const probability = Math.min(90, (recentExceptions.length / 20) * 100)
        alerts.push({
          id: `connection_${imei}_${Date.now()}`,
          imei,
          type: 'connection_degradation',
          probability,
          estimatedTimeToFailure: 24, // 24 hours
          description: `${recentExceptions.length} connection issues in last 3 days`,
          recommendation: 'Check network connectivity and signal strength',
          createdAt: new Date()
        })
      }
    })
    
    return alerts
  }
  
  private static calculateVoltageTrend(readings: { voltage: number, timestamp: Date }[]): number {
    if (readings.length < 2) return 0
    
    const n = readings.length
    const sumX = readings.reduce((sum, _, i) => sum + i, 0)
    const sumY = readings.reduce((sum, r) => sum + r.voltage, 0)
    const sumXY = readings.reduce((sum, r, i) => sum + (i * r.voltage), 0)
    const sumXX = readings.reduce((sum, _, i) => sum + (i * i), 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    return slope
  }
  
  static calculateServerHealth(exceptionLogs: ExceptionLog[]): ServerHealth {
    const now = new Date()
    const dayAgo = subDays(now, 1)
    
    // Get server-related exceptions from last 24 hours
    const serverExceptions = exceptionLogs.filter(log => {
      const logDate = parseTimestamp(log.timestamp)
      return logDate > dayAgo && (
        log.main?.toLowerCase().includes('server down') ||
        log.main?.toLowerCase().includes('server unavailable') ||
        log.main?.toLowerCase().includes('connection timeout')
      )
    })
    
    // Calculate server status
    const recentServerDown = serverExceptions.filter(log => {
      const logDate = parseTimestamp(log.timestamp)
      const hourAgo = subHours(now, 1)
      return logDate > hourAgo && log.main?.toLowerCase().includes('server down')
    })
    
    let status: 'online' | 'degraded' | 'offline' = 'online'
    if (recentServerDown.length > 0) {
      status = 'offline'
    } else if (serverExceptions.length > 5) {
      status = 'degraded'
    }
    
    // Calculate uptime percentage
    const totalMinutes = 24 * 60 // 24 hours
    const downtimeMinutes = serverExceptions.length * 2 // Assume 2 minutes per exception
    const uptime = Math.max(0, ((totalMinutes - downtimeMinutes) / totalMinutes) * 100)
    
    // Get unique devices that reported issues
    const affectedDevices = new Set(serverExceptions.map(log => log.deviceImei)).size
    const totalDevices = new Set(exceptionLogs.map(log => log.deviceImei)).size
    
    // Find last downtime
    const lastDowntime = serverExceptions.length > 0 
      ? parseTimestamp(serverExceptions[0].timestamp)
      : null
    
    return {
      status,
      uptime: Math.round(uptime * 100) / 100,
      responseTime: status === 'online' ? 150 : status === 'degraded' ? 500 : 0,
      connectedDevices: totalDevices - affectedDevices,
      totalDevices,
      lastDowntime,
      downtimeToday: downtimeMinutes
    }
  }
  
  static generateGeographicData(
    ignitionLogs: IgnitionLog[],
    exceptionLogs: ExceptionLog[]
  ): GeographicData[] {
    const deviceMap = new Map<string, GeographicData>()
    
    // Process ignition logs for location data
    ignitionLogs.forEach(log => {
      if (log.location?.latitude && log.location?.longitude) {
        const existing = deviceMap.get(log.deviceImei)
        const logDate = parseTimestamp(log.timestamp)
        
        if (!existing || logDate > existing.lastSeen) {
          const deviceExceptions = exceptionLogs.filter(e => e.deviceImei === log.deviceImei)
          const recentExceptions = deviceExceptions.filter(e => {
            const eDate = parseTimestamp(e.timestamp)
            const hourAgo = subHours(new Date(), 1)
            return eDate > hourAgo
          })
          
          let status: 'online' | 'warning' | 'critical' | 'offline' = 'online'
          const criticalExceptions = recentExceptions.filter(e => 
            e.main?.toLowerCase().includes('server down') ||
            e.main?.toLowerCase().includes('critical')
          )
          
          if (criticalExceptions.length > 0) {
            status = 'critical'
          } else if (recentExceptions.length > 2) {
            status = 'warning'
          } else if (logDate < subHours(new Date(), 2)) {
            status = 'offline'
          }
          
          // Calculate health score
          const healthScore = this.calculateDeviceHealthScore(
            log.deviceImei, 
            ignitionLogs.filter(l => l.deviceImei === log.deviceImei),
            deviceExceptions
          ).score
          
          deviceMap.set(log.deviceImei, {
            imei: log.deviceImei,
            latitude: log.location.latitude,
            longitude: log.location.longitude,
            location: log.address || 'Unknown Location',
            status,
            lastSeen: logDate,
            healthScore
          })
        }
      }
    })
    
    return Array.from(deviceMap.values())
  }
}
export interface DeviceMetadata {
  imei: string
  customerName: string
  location: string
  contactInfo: string
  installationDate: string
  vehicleType: string
  region: string
}

export interface DeviceHealthScore {
  imei: string
  score: number // 0-100
  factors: {
    connectivity: number
    batteryHealth: number
    errorRate: number
    uptime: number
  }
  lastCalculated: Date
}

export interface TrendData {
  date: string
  exceptions: number
  ignitions: number
  criticalIssues: number
  serverDowntime: number
}

export interface DevicePerformanceMetrics {
  imei: string
  uptime: number // percentage
  mtbf: number // hours
  totalExceptions: number
  criticalExceptions: number
  lastSeen: Date
  averageVoltage: number
  locationAccuracy: number
}

export interface Anomaly {
  id: string
  imei: string
  type: 'voltage_drop' | 'frequent_restarts' | 'connection_loss' | 'battery_degradation'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  detectedAt: Date
  value: number
  threshold: number
  recommendation: string
}

export interface PredictiveAlert {
  id: string
  imei: string
  type: 'battery_failure' | 'device_failure' | 'connection_degradation'
  probability: number // 0-100
  estimatedTimeToFailure: number // hours
  description: string
  recommendation: string
  createdAt: Date
}

export interface ServerHealth {
  status: 'online' | 'degraded' | 'offline'
  uptime: number // percentage
  responseTime: number // ms
  connectedDevices: number
  totalDevices: number
  lastDowntime: Date | null
  downtimeToday: number // minutes
}

export interface GeographicData {
  imei: string
  latitude: number
  longitude: number
  location: string
  status: 'online' | 'warning' | 'critical' | 'offline'
  lastSeen: Date
  healthScore: number
}

export interface TimeRange {
  start: Date
  end: Date
  label: string
}

export interface AlertNotification {
  id: string
  type: 'critical' | 'warning' | 'info'
  title: string
  message: string
  imei?: string
  timestamp: Date
  acknowledged: boolean
  acknowledgedBy?: string
  acknowledgedAt?: Date
}
export interface SeverityLevel {
  level: 'critical' | 'high' | 'medium' | 'low' | 'info'
  color: string
  bgColor: string
  description: string
  impact: string
}

export interface TimeFilter {
  label: string
  value: string
  hours: number
}

export interface DeviceStatus {
  imei: string
  lastSeen: Date
  status: 'online' | 'offline' | 'warning' | 'critical'
  ignitionCount: number
  exceptionCount: number
  criticalExceptions: number
  lastException?: string
}

export interface OperationalInsight {
  type: 'critical' | 'warning' | 'info'
  title: string
  description: string
  count: number
  devices: string[]
  action?: string
}

export interface LogSummary {
  totalLogs: number
  criticalIssues: number
  devicesAffected: number
  lastUpdate: Date
  trends: {
    ignitionEvents: { current: number; previous: number }
    exceptions: { current: number; previous: number }
  }
}

// Severity mapping for different exception types
export const SEVERITY_MAPPING: Record<string, SeverityLevel> = {
  'Server Down': {
    level: 'critical',
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    description: 'Service completely unavailable',
    impact: 'End users cannot access service'
  },
  'Connection Timeout': {
    level: 'high',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
    description: 'Network connectivity issues',
    impact: 'Intermittent service disruption'
  },
  'Retry Phase Change': {
    level: 'medium',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
    description: 'System attempting recovery',
    impact: 'Service degradation possible'
  },
  'GPS Signal Lost': {
    level: 'medium',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
    description: 'Location tracking unavailable',
    impact: 'Tracking accuracy affected'
  },
  'Low Battery': {
    level: 'low',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    description: 'Device power running low',
    impact: 'Device may shut down soon'
  },
  'Default': {
    level: 'info',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 border-gray-200',
    description: 'General system event',
    impact: 'No immediate impact'
  }
}

export const TIME_FILTERS: TimeFilter[] = [
  { label: 'Last Hour', value: '1h', hours: 1 },
  { label: 'Last 4 Hours', value: '4h', hours: 4 },
  { label: 'Today', value: '24h', hours: 24 },
  { label: 'Last 3 Days', value: '72h', hours: 72 },
  { label: 'This Week', value: '168h', hours: 168 },
  { label: 'All Time', value: 'all', hours: 0 }
]
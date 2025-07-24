export interface NetworkIncident {
  id: string
  startTime: Date
  endTime?: Date
  duration?: number // in minutes
  status: 'ongoing' | 'resolved'
  affectedDevices: string[] // IMEIs
  recoveredDevices: string[] // IMEIs that came back online
  severity: 'critical' | 'high' | 'medium'
  impactLevel: number // percentage of devices affected
  recoveryPattern: 'simultaneous' | 'gradual' | 'partial'
}

export interface NetworkEvent {
  id: string
  deviceImei: string
  timestamp: Date
  eventType: 'outage' | 'recovery' | 'timeout'
  details: string
  incidentId?: string
}

export interface RecoveryMetrics {
  totalOutages: number
  averageOutageDuration: number // minutes
  longestOutage: number // minutes
  shortestOutage: number // minutes
  recoveryRate: number // percentage
  frequentlyAffectedDevices: string[]
  recoveryPatterns: {
    simultaneous: number
    gradual: number
    partial: number
  }
}

export interface DeviceRecoveryStatus {
  deviceImei: string
  lastSeen: Date
  status: 'online' | 'offline' | 'recovering'
  lastOutage?: Date
  outageCount: number
  averageRecoveryTime: number // minutes
  reliability: number // percentage (uptime)
}
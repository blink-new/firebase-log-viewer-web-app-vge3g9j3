import { parseTimestamp } from '../lib/dateUtils'
import { IgnitionLog, ExceptionLog } from '../types/logs'
import { NetworkIncident, NetworkEvent, RecoveryMetrics, DeviceRecoveryStatus } from '../types/networkIncident'

export class NetworkIncidentService {
  private static instance: NetworkIncidentService
  private incidents: NetworkIncident[] = []
  private events: NetworkEvent[] = []

  static getInstance(): NetworkIncidentService {
    if (!NetworkIncidentService.instance) {
      NetworkIncidentService.instance = new NetworkIncidentService()
    }
    return NetworkIncidentService.instance
  }

  // Analyze logs to detect network incidents and recoveries
  analyzeNetworkEvents(ignitionLogs: IgnitionLog[], exceptionLogs: ExceptionLog[]): {
    incidents: NetworkIncident[]
    events: NetworkEvent[]
    metrics: RecoveryMetrics
  } {
    this.events = []
    this.incidents = []

    // Extract network-related events from exception logs
    const networkEvents = this.extractNetworkEvents(exceptionLogs)
    
    // Group events into incidents
    const incidents = this.groupEventsIntoIncidents(networkEvents)
    
    // Calculate recovery metrics
    const metrics = this.calculateRecoveryMetrics(incidents)

    return {
      incidents,
      events: networkEvents,
      metrics
    }
  }

  private extractNetworkEvents(exceptionLogs: ExceptionLog[]): NetworkEvent[] {
    const events: NetworkEvent[] = []

    exceptionLogs.forEach(log => {
      const timestamp = parseTimestamp(log.timestamp)
      const details = log.details?.toLowerCase() || ''
      const main = log.main?.toLowerCase() || ''

      let eventType: 'outage' | 'recovery' | 'timeout' | null = null

      // Detect outage events
      if (main.includes('server down') || 
          details.includes('server unavailable') ||
          details.includes('connection failed') ||
          details.includes('network error')) {
        eventType = 'outage'
      }
      
      // Detect recovery events
      else if (main.includes('server up') || 
               main.includes('connection restored') ||
               main.includes('network restored') ||
               details.includes('server available') ||
               details.includes('connection established') ||
               details.includes('back online') ||
               details.includes('connectivity restored')) {
        eventType = 'recovery'
      }
      
      // Detect timeout events (potential recovery indicators)
      else if (main.includes('timeout') || 
               details.includes('timeout') ||
               main.includes('retry') ||
               details.includes('attempting reconnection')) {
        eventType = 'timeout'
      }

      if (eventType) {
        events.push({
          id: log.id,
          deviceImei: log.deviceImei,
          timestamp,
          eventType,
          details: log.details || log.main || 'Network event detected'
        })
      }
    })

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  private groupEventsIntoIncidents(events: NetworkEvent[]): NetworkIncident[] {
    const incidents: NetworkIncident[] = []
    const deviceOutages = new Map<string, Date>() // Track when each device went down
    let currentIncident: NetworkIncident | null = null

    // Group events by time windows (incidents within 5 minutes are considered related)
    const INCIDENT_WINDOW = 5 * 60 * 1000 // 5 minutes in milliseconds

    events.forEach(event => {
      if (event.eventType === 'outage') {
        deviceOutages.set(event.deviceImei, event.timestamp)

        // Check if this is part of an existing incident or a new one
        if (!currentIncident || 
            event.timestamp.getTime() - currentIncident.startTime.getTime() > INCIDENT_WINDOW) {
          
          // Start new incident
          currentIncident = {
            id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            startTime: event.timestamp,
            status: 'ongoing',
            affectedDevices: [event.deviceImei],
            recoveredDevices: [],
            severity: 'critical',
            impactLevel: 0,
            recoveryPattern: 'simultaneous'
          }
          incidents.push(currentIncident)
        } else {
          // Add to existing incident
          if (!currentIncident.affectedDevices.includes(event.deviceImei)) {
            currentIncident.affectedDevices.push(event.deviceImei)
          }
        }

        // Update event with incident ID
        event.incidentId = currentIncident.id
      }
      
      else if (event.eventType === 'recovery') {
        const outageTime = deviceOutages.get(event.deviceImei)
        if (outageTime) {
          // Find the incident this recovery belongs to
          const incident = incidents.find(inc => 
            inc.affectedDevices.includes(event.deviceImei) && 
            inc.status === 'ongoing'
          )

          if (incident) {
            // Mark device as recovered
            if (!incident.recoveredDevices.includes(event.deviceImei)) {
              incident.recoveredDevices.push(event.deviceImei)
            }

            // Check if all devices have recovered
            if (incident.recoveredDevices.length === incident.affectedDevices.length) {
              incident.status = 'resolved'
              incident.endTime = event.timestamp
              incident.duration = Math.round(
                (event.timestamp.getTime() - incident.startTime.getTime()) / (1000 * 60)
              )
            }

            // Update recovery pattern
            incident.recoveryPattern = this.determineRecoveryPattern(incident)
            event.incidentId = incident.id
          }

          deviceOutages.delete(event.deviceImei)
        }
      }
    })

    // Calculate impact levels and finalize incidents
    incidents.forEach(incident => {
      incident.impactLevel = Math.round((incident.affectedDevices.length / this.getTotalDeviceCount()) * 100)
      
      // Determine severity based on impact and duration
      if (incident.impactLevel > 50 || (incident.duration && incident.duration > 30)) {
        incident.severity = 'critical'
      } else if (incident.impactLevel > 20 || (incident.duration && incident.duration > 10)) {
        incident.severity = 'high'
      } else {
        incident.severity = 'medium'
      }
    })

    return incidents
  }

  private determineRecoveryPattern(incident: NetworkIncident): 'simultaneous' | 'gradual' | 'partial' {
    if (incident.recoveredDevices.length === 0) return 'simultaneous'
    
    const recoveryRate = incident.recoveredDevices.length / incident.affectedDevices.length
    
    if (recoveryRate === 1) {
      // All devices recovered - check if it was simultaneous or gradual
      // This would require more detailed timing analysis
      return 'simultaneous'
    } else if (recoveryRate > 0.8) {
      return 'gradual'
    } else {
      return 'partial'
    }
  }

  private calculateRecoveryMetrics(incidents: NetworkIncident[]): RecoveryMetrics {
    const resolvedIncidents = incidents.filter(inc => inc.status === 'resolved')
    const durations = resolvedIncidents.map(inc => inc.duration || 0)
    
    const deviceRecoveryCount = new Map<string, number>()
    incidents.forEach(incident => {
      incident.affectedDevices.forEach(device => {
        deviceRecoveryCount.set(device, (deviceRecoveryCount.get(device) || 0) + 1)
      })
    })

    const frequentlyAffectedDevices = Array.from(deviceRecoveryCount.entries())
      .filter(([_, count]) => count > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([device]) => device)

    const recoveryPatterns = incidents.reduce((acc, incident) => {
      acc[incident.recoveryPattern]++
      return acc
    }, { simultaneous: 0, gradual: 0, partial: 0 })

    return {
      totalOutages: incidents.length,
      averageOutageDuration: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      longestOutage: durations.length > 0 ? Math.max(...durations) : 0,
      shortestOutage: durations.length > 0 ? Math.min(...durations) : 0,
      recoveryRate: resolvedIncidents.length > 0 ? Math.round((resolvedIncidents.length / incidents.length) * 100) : 0,
      frequentlyAffectedDevices,
      recoveryPatterns
    }
  }

  private getTotalDeviceCount(): number {
    // This should be dynamically calculated based on your actual device count
    // For now, we'll use a reasonable estimate
    return 10 // You can update this based on your actual device count
  }

  // Get current network status
  getCurrentNetworkStatus(events: NetworkEvent[]): {
    status: 'healthy' | 'degraded' | 'outage'
    affectedDevices: string[]
    lastIncident?: NetworkIncident
  } {
    const recentEvents = events.filter(event => 
      Date.now() - event.timestamp.getTime() < 30 * 60 * 1000 // Last 30 minutes
    )

    const recentOutages = recentEvents.filter(e => e.eventType === 'outage')
    const recentRecoveries = recentEvents.filter(e => e.eventType === 'recovery')

    const affectedDevices = recentOutages
      .filter(outage => !recentRecoveries.some(recovery => 
        recovery.deviceImei === outage.deviceImei && 
        recovery.timestamp > outage.timestamp
      ))
      .map(e => e.deviceImei)

    let status: 'healthy' | 'degraded' | 'outage' = 'healthy'
    if (affectedDevices.length > 0) {
      status = affectedDevices.length > 3 ? 'outage' : 'degraded'
    }

    return {
      status,
      affectedDevices,
      lastIncident: this.incidents[this.incidents.length - 1]
    }
  }

  // Get device recovery status
  getDeviceRecoveryStatus(deviceImei: string, events: NetworkEvent[]): DeviceRecoveryStatus {
    const deviceEvents = events.filter(e => e.deviceImei === deviceImei)
    const outages = deviceEvents.filter(e => e.eventType === 'outage')
    const recoveries = deviceEvents.filter(e => e.eventType === 'recovery')

    const lastEvent = deviceEvents[deviceEvents.length - 1]
    const lastOutage = outages[outages.length - 1]

    let status: 'online' | 'offline' | 'recovering' = 'online'
    if (lastEvent?.eventType === 'outage') {
      status = 'offline'
    } else if (lastEvent?.eventType === 'timeout') {
      status = 'recovering'
    }

    // Calculate average recovery time
    const recoveryTimes: number[] = []
    outages.forEach(outage => {
      const correspondingRecovery = recoveries.find(recovery => 
        recovery.timestamp > outage.timestamp
      )
      if (correspondingRecovery) {
        recoveryTimes.push(
          (correspondingRecovery.timestamp.getTime() - outage.timestamp.getTime()) / (1000 * 60)
        )
      }
    })

    const averageRecoveryTime = recoveryTimes.length > 0 
      ? Math.round(recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length)
      : 0

    // Calculate reliability (uptime percentage)
    const totalTime = deviceEvents.length > 0 
      ? Date.now() - deviceEvents[0].timestamp.getTime()
      : 0
    const totalOutageTime = recoveryTimes.reduce((a, b) => a + b, 0) * 60 * 1000
    const reliability = totalTime > 0 
      ? Math.round(((totalTime - totalOutageTime) / totalTime) * 100)
      : 100

    return {
      deviceImei,
      lastSeen: lastEvent?.timestamp || new Date(),
      status,
      lastOutage: lastOutage?.timestamp,
      outageCount: outages.length,
      averageRecoveryTime,
      reliability
    }
  }
}

export const networkIncidentService = NetworkIncidentService.getInstance()
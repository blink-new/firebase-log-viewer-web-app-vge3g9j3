import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, limit, getDocs, collectionGroup } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { IgnitionLog, ExceptionLog } from '../types/logs'

export function useFirebaseLogs() {
  const [ignitionLogs, setIgnitionLogs] = useState<IgnitionLog[]>([])
  const [exceptionLogs, setExceptionLogs] = useState<ExceptionLog[]>([])
  const [devices, setDevices] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Function to discover all devices using collection group queries
  const discoverDevicesFromLogs = async (): Promise<string[]> => {
    try {
      console.log('Discovering devices from logs...')
      const deviceIds = new Set<string>()
      
      // Get devices from ignition logs
      try {
        const ignitionRef = collectionGroup(db, 'ignition_logs')
        const ignitionSnapshot = await getDocs(query(ignitionRef, limit(100)))
        
        ignitionSnapshot.docs.forEach(doc => {
          const data = doc.data()
          const deviceId = data.deviceImei || data.imei
          if (deviceId) {
            deviceIds.add(deviceId)
            console.log(`Found device ${deviceId} in ignition logs`)
          }
        })
      } catch (err) {
        console.log('Error querying ignition logs:', err)
      }

      // Get devices from exception logs
      try {
        const exceptionRef = collectionGroup(db, 'exception_logs')
        const exceptionSnapshot = await getDocs(query(exceptionRef, limit(100)))
        
        exceptionSnapshot.docs.forEach(doc => {
          const data = doc.data()
          const deviceId = data.deviceImei || data.imei
          if (deviceId) {
            deviceIds.add(deviceId)
            console.log(`Found device ${deviceId} in exception logs`)
          }
        })
      } catch (err) {
        console.log('Error querying exception logs:', err)
      }

      const discoveredDevices = Array.from(deviceIds)
      console.log(`Discovered ${discoveredDevices.length} devices:`, discoveredDevices)
      return discoveredDevices
    } catch (err) {
      console.error('Error discovering devices from logs:', err)
      return []
    }
  }

  // Alternative method: discover devices from devices collection
  const discoverDevicesFromCollection = async (): Promise<string[]> => {
    try {
      console.log('Discovering devices from devices collection...')
      const devicesRef = collection(db, 'devices')
      const snapshot = await getDocs(devicesRef)
      
      const deviceIds: string[] = []
      
      for (const doc of snapshot.docs) {
        const deviceId = doc.id
        console.log(`Found device document: ${deviceId}`)
        
        // Check if this device has logs
        try {
          const ignitionRef = collection(db, `devices/${deviceId}/ignition_logs`)
          const ignitionSnapshot = await getDocs(query(ignitionRef, limit(1)))
          
          const exceptionRef = collection(db, `devices/${deviceId}/exception_logs`)
          const exceptionSnapshot = await getDocs(query(exceptionRef, limit(1)))
          
          if (!ignitionSnapshot.empty || !exceptionSnapshot.empty) {
            deviceIds.push(deviceId)
            console.log(`Device ${deviceId} has logs - adding to list`)
          }
        } catch (err) {
          console.log(`Error checking subcollections for device ${deviceId}:`, err)
        }
      }
      
      console.log(`Discovered ${deviceIds.length} devices with logs:`, deviceIds)
      return deviceIds
    } catch (err) {
      console.error('Error discovering devices from collection:', err)
      return []
    }
  }

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)

    try {
      // Try both methods to discover devices
      let discoveredDevices = await discoverDevicesFromCollection()
      
      // If no devices found from collection, try from logs
      if (discoveredDevices.length === 0) {
        console.log('No devices found from collection, trying from logs...')
        discoveredDevices = await discoverDevicesFromLogs()
      }
      
      setDevices(discoveredDevices)
      
      if (discoveredDevices.length === 0) {
        console.log('No devices found with logs')
        setIgnitionLogs([])
        setExceptionLogs([])
        setLoading(false)
        return () => {}
      }

      const allIgnitionLogs: IgnitionLog[] = []
      const allExceptionLogs: ExceptionLog[] = []
      const unsubscribeFunctions: (() => void)[] = []

      // Set up listeners for each device
      for (const deviceId of discoveredDevices) {
        console.log(`Setting up listeners for device: ${deviceId}`)
        
        // Set up ignition logs listener for this device
        const ignitionRef = collection(db, `devices/${deviceId}/ignition_logs`)
        const ignitionQuery = query(
          ignitionRef,
          orderBy('createdAt', 'desc'),
          limit(100)
        )

        const ignitionUnsubscribe = onSnapshot(
          ignitionQuery,
          (snapshot) => {
            console.log(`Ignition logs for ${deviceId}:`, snapshot.size, 'documents')
            
            const deviceIgnitionLogs = snapshot.docs.map(doc => {
              const data = doc.data()
              
              return {
                id: doc.id,
                deviceImei: data.deviceImei || data.imei || deviceId,
                imei: data.deviceImei || data.imei || deviceId,
                timestamp: data.timestamp || '',
                createdAt: data.createdAt,
                ignitionStatus: data.ignitionStatus !== undefined ? data.ignitionStatus : 
                              data.logType === 'acc_on' ? true : 
                              data.logType === 'acc_off' ? false : false,
                voltage: data.voltage || undefined,
                location: data.location ? {
                  latitude: data.location.latitude || 0,
                  longitude: data.location.longitude || 0
                } : undefined,
                message: data.message || '',
                details: data.details || '',
                address: data.address || '',
                logType: data.logType || ''
              } as IgnitionLog
            })

            // Update the combined ignition logs
            const otherDeviceLogs = allIgnitionLogs.filter(log => 
              (log.deviceImei || log.imei) !== deviceId
            )
            const updatedIgnitionLogs = [...otherDeviceLogs, ...deviceIgnitionLogs]
            allIgnitionLogs.length = 0
            allIgnitionLogs.push(...updatedIgnitionLogs)
            setIgnitionLogs([...allIgnitionLogs])
          },
          (err) => {
            console.error(`Failed to fetch ignition logs for ${deviceId}:`, err)
          }
        )

        unsubscribeFunctions.push(ignitionUnsubscribe)

        // Set up exception logs listener for this device
        const exceptionRef = collection(db, `devices/${deviceId}/exception_logs`)
        const exceptionQuery = query(
          exceptionRef,
          orderBy('createdAt', 'desc'),
          limit(100)
        )

        const exceptionUnsubscribe = onSnapshot(
          exceptionQuery,
          (snapshot) => {
            console.log(`Exception logs for ${deviceId}:`, snapshot.size, 'documents')
            
            const deviceExceptionLogs = snapshot.docs.map(doc => {
              const data = doc.data()
              
              return {
                id: doc.id,
                deviceImei: data.deviceImei || data.imei || deviceId,
                imei: data.deviceImei || data.imei || deviceId,
                timestamp: data.timestamp || '',
                createdAt: data.createdAt,
                main: data.main || '',
                errorCode: data.main || '',
                details: data.details || '',
                errorMessage: data.details || '',
                severity: data.severity || 'medium',
                location: data.location ? {
                  latitude: data.location.latitude || 0,
                  longitude: data.location.longitude || 0
                } : undefined
              } as ExceptionLog
            })

            // Update the combined exception logs
            const otherDeviceLogs = allExceptionLogs.filter(log => 
              (log.deviceImei || log.imei) !== deviceId
            )
            const updatedExceptionLogs = [...otherDeviceLogs, ...deviceExceptionLogs]
            allExceptionLogs.length = 0
            allExceptionLogs.push(...updatedExceptionLogs)
            setExceptionLogs([...allExceptionLogs])
          },
          (err) => {
            console.error(`Failed to fetch exception logs for ${deviceId}:`, err)
          }
        )

        unsubscribeFunctions.push(exceptionUnsubscribe)
      }

      setLoading(false)

      // Return cleanup function
      return () => {
        unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
      }
    } catch (err) {
      console.error('Error setting up logs listeners:', err)
      setError(`Error setting up logs listeners: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setLoading(false)
      return () => {}
    }
  }

  useEffect(() => {
    let cleanup: (() => void) | undefined

    const setupListeners = async () => {
      cleanup = await fetchLogs()
    }

    setupListeners()

    return () => {
      if (cleanup) {
        cleanup()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = async () => {
    const cleanup = await fetchLogs()
    return cleanup
  }

  return {
    ignitionLogs,
    exceptionLogs,
    devices,
    loading,
    error,
    refetch
  }
}
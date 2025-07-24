import React, { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { OperationalDashboard } from './components/OperationalDashboard'
import { EnhancedLogTable } from './components/EnhancedLogTable'
import { AdvancedAnalyticsDashboard } from './components/AdvancedAnalyticsDashboard'
import { DeviceInsightsDetail } from './components/DeviceInsightsDetail'
import { NetworkRecoveryDashboard } from './components/NetworkRecoveryDashboard'
import { VehicleManagement } from './components/VehicleManagement'

import { useFirebaseLogs } from './hooks/useFirebaseLogs'
import { VehicleService } from './services/vehicleService'
import { Activity, AlertTriangle, Wifi, WifiOff, BarChart3, Database, TrendingUp, Eye, ArrowLeft, Car } from 'lucide-react'

// Navigation state management
type NavigationState = {
  currentTab: string
  deviceInsightsDevice: string | null
}

function App() {
  const { ignitionLogs, exceptionLogs, loading, error, refetch } = useFirebaseLogs()
  const [navigationState, setNavigationState] = useState<NavigationState>({
    currentTab: 'dashboard',
    deviceInsightsDevice: null
  })

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state) {
        setNavigationState(event.state)
      } else {
        // Default state when no history state
        setNavigationState({
          currentTab: 'dashboard',
          deviceInsightsDevice: null
        })
      }
    }

    // Set initial state in browser history
    if (!window.history.state) {
      const initialState = {
        currentTab: 'dashboard',
        deviceInsightsDevice: null
      }
      window.history.replaceState(initialState, '', window.location.href)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Update browser history when navigation state changes
  const updateNavigation = (newState: Partial<NavigationState>) => {
    const updatedState = { ...navigationState, ...newState }
    setNavigationState(updatedState)
    
    // Update browser history
    const url = new URL(window.location.href)
    if (updatedState.deviceInsightsDevice) {
      url.searchParams.set('device', updatedState.deviceInsightsDevice)
      url.searchParams.set('view', 'insights')
    } else {
      url.searchParams.delete('device')
      url.searchParams.delete('view')
      url.searchParams.set('tab', updatedState.currentTab)
    }
    
    window.history.pushState(updatedState, '', url.toString())
  }

  // Handle tab changes
  const handleTabChange = (tabValue: string) => {
    if (tabValue === 'insights') {
      // Don't change tab directly for insights, let user select device first
      return
    }
    updateNavigation({ currentTab: tabValue, deviceInsightsDevice: null })
  }

  // Handle device insights navigation
  const handleDeviceInsightsSelect = (deviceImei: string) => {
    updateNavigation({ deviceInsightsDevice: deviceImei })
  }

  const handleBackFromDeviceInsights = () => {
    updateNavigation({ currentTab: 'insights', deviceInsightsDevice: null })
  }

  // Load state from URL on initial load
  useEffect(() => {
    const url = new URL(window.location.href)
    const device = url.searchParams.get('device')
    const view = url.searchParams.get('view')
    const tab = url.searchParams.get('tab')
    
    if (device && view === 'insights') {
      setNavigationState({
        currentTab: 'insights',
        deviceInsightsDevice: device
      })
    } else if (tab) {
      setNavigationState({
        currentTab: tab,
        deviceInsightsDevice: null
      })
    }
  }, [])

  // Prevent accidental page navigation away from the app
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only show warning if user is in the middle of viewing device insights
      if (navigationState.deviceInsightsDevice) {
        event.preventDefault()
        event.returnValue = 'Are you sure you want to leave? You will lose your current device insights view.'
        return event.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [navigationState.deviceInsightsDevice])

  // If device insights is selected, show the detail view
  if (navigationState.deviceInsightsDevice) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackFromDeviceInsights}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Devices</span>
                </Button>
                <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                  <Eye className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Device Insights</h1>
                  <p className="text-sm text-gray-500">
                    Detailed analytics for {VehicleService.getVehicleDisplayName(navigationState.deviceInsightsDevice)} 
                    {navigationState.deviceInsightsDevice !== VehicleService.getVehicleDisplayName(navigationState.deviceInsightsDevice) && 
                      ` (${navigationState.deviceInsightsDevice})`
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {error ? (
                  <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                    <WifiOff className="h-3 w-3" />
                    <span className="hidden sm:inline">Connection Error</span>
                    <span className="sm:hidden">Error</span>
                  </Badge>
                ) : (
                  <Badge variant="default" className="flex items-center gap-1 text-xs">
                    <Wifi className="h-3 w-3" />
                    <span className="hidden sm:inline">Connected</span>
                    <span className="sm:hidden">OK</span>
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DeviceInsightsDetail
            deviceImei={navigationState.deviceInsightsDevice}
            ignitionLogs={ignitionLogs}
            exceptionLogs={exceptionLogs}
            onBack={handleBackFromDeviceInsights}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-lg flex-shrink-0">
                <Database className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Operations Control Center</h1>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Real-time monitoring and operational insights</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {error ? (
                <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                  <WifiOff className="h-3 w-3" />
                  <span className="hidden sm:inline">Connection Error</span>
                  <span className="sm:hidden">Error</span>
                </Badge>
              ) : (
                <Badge variant="default" className="flex items-center gap-1 text-xs">
                  <Wifi className="h-3 w-3" />
                  <span className="hidden sm:inline">Connected</span>
                  <span className="sm:hidden">OK</span>
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Connection Error:</span>
              <span>{error}</span>
            </div>
          </div>
        )}



        {/* Tabs */}
        <Tabs value={navigationState.currentTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 gap-1 h-auto p-1">
            <TabsTrigger value="dashboard" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2">
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Operations</span>
              <span className="sm:hidden">Ops</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Analytics</span>
              <span className="sm:hidden">Charts</span>
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2">
              <Car className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Vehicles</span>
              <span className="sm:hidden">Cars</span>
            </TabsTrigger>
            <TabsTrigger value="network" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2">
              <Wifi className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Network Recovery</span>
              <span className="sm:hidden">Network</span>
            </TabsTrigger>
            <TabsTrigger value="ignition" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2">
              <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Ignition ({ignitionLogs.length})</span>
              <span className="sm:hidden">Ign ({ignitionLogs.length})</span>
            </TabsTrigger>
            <TabsTrigger value="exception" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2">
              <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Exceptions ({exceptionLogs.length})</span>
              <span className="sm:hidden">Exc ({exceptionLogs.length})</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2">
              <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Device Insights</span>
              <span className="sm:hidden">Devices</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <OperationalDashboard
              ignitionLogs={ignitionLogs}
              exceptionLogs={exceptionLogs}
              loading={loading}
              onRefresh={refetch}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <AdvancedAnalyticsDashboard
              ignitionLogs={ignitionLogs}
              exceptionLogs={exceptionLogs}
              loading={loading}
              onRefresh={refetch}
            />
          </TabsContent>

          <TabsContent value="vehicles">
            <VehicleManagement
              ignitionLogs={ignitionLogs}
              exceptionLogs={exceptionLogs}
            />
          </TabsContent>

          <TabsContent value="network">
            <NetworkRecoveryDashboard
              ignitionLogs={ignitionLogs}
              exceptionLogs={exceptionLogs}
            />
          </TabsContent>

          <TabsContent value="ignition">
            <EnhancedLogTable 
              logs={ignitionLogs} 
              type="ignition" 
              loading={loading}
            />
          </TabsContent>

          <TabsContent value="exception">
            <EnhancedLogTable 
              logs={exceptionLogs} 
              type="exception" 
              loading={loading}
            />
          </TabsContent>

          <TabsContent value="insights">
            <div className="space-y-6">
              <div className="text-center py-12">
                <Eye className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Device Insights</h3>
                <p className="text-gray-500 mb-6">
                  Select a device to view detailed insights, analytics, and predictions
                </p>
                
                <div className="max-w-2xl mx-auto">
                  <div className="grid gap-3">
                    {Array.from(new Set([
                      ...ignitionLogs.map(log => log.deviceImei || log.imei),
                      ...exceptionLogs.map(log => log.deviceImei || log.imei)
                    ])).filter(Boolean).sort().map(deviceImei => {
                      const vehicleInfo = VehicleService.getVehicleFullInfo(deviceImei!)
                      const ignitionCount = ignitionLogs.filter(log => (log.deviceImei || log.imei) === deviceImei).length
                      const exceptionCount = exceptionLogs.filter(log => (log.deviceImei || log.imei) === deviceImei).length
                      
                      return (
                        <button
                          key={deviceImei}
                          onClick={() => handleDeviceInsightsSelect(deviceImei!)}
                          className="flex items-center justify-between p-6 h-auto border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 cursor-pointer rounded-lg bg-white w-full text-left"
                        >
                          <div className="text-left flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="font-semibold text-gray-900 text-lg">
                                {vehicleInfo.displayName}
                              </div>
                              {vehicleInfo.vehicleName && vehicleInfo.displayName !== vehicleInfo.vehicleName && (
                                <Badge variant="secondary" className="text-xs">
                                  {vehicleInfo.vehicleName}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 mb-1">
                              IMEI: <span className="font-mono">{deviceImei}</span>
                            </div>
                            {vehicleInfo.model && (
                              <div className="text-sm text-gray-500 mb-2">
                                Model: {vehicleInfo.model}
                              </div>
                            )}
                            <div className="flex gap-4 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                {ignitionCount} ignitions
                              </span>
                              <span className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {exceptionCount} exceptions
                              </span>
                            </div>
                          </div>
                          <Eye className="h-6 w-6 text-gray-400 ml-4 flex-shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default App
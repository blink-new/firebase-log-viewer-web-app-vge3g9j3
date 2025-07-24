import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { ChevronUp, ChevronDown, Search, Filter, Download, Eye } from 'lucide-react'
import { IgnitionLog, ExceptionLog } from '../types/logs'
import { SEVERITY_MAPPING, SeverityLevel } from '../types/operations'

interface EnhancedLogTableProps {
  logs: (IgnitionLog | ExceptionLog)[]
  type: 'ignition' | 'exception'
  loading: boolean
}

export function EnhancedLogTable({ logs, type, loading }: EnhancedLogTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState('timestamp')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [deviceFilter, setDeviceFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Get severity for exception
  const getSeverity = (exceptionType: string): SeverityLevel => {
    return SEVERITY_MAPPING[exceptionType] || SEVERITY_MAPPING['Default']
  }

  // Get unique devices for filter
  const uniqueDevices = useMemo(() => {
    const devices = new Set(logs.map(log => (log as any).deviceImei || (log as any).imei || 'Unknown'))
    return Array.from(devices).sort()
  }, [logs])

  // Filtered and sorted data
  const processedLogs = useMemo(() => {
    let filtered = [...logs]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(log => {
        const searchableFields = [
          (log as any).deviceImei || (log as any).imei || '',
          (log as any).main || (log as any).errorCode || '',
          (log as any).details || (log as any).errorMessage || (log as any).message || '',
          (log as any).timestamp || ''
        ]
        return searchableFields.some(field => 
          field.toString().toLowerCase().includes(term)
        )
      })
    }

    // Device filter
    if (deviceFilter !== 'all') {
      filtered = filtered.filter(log => 
        ((log as any).deviceImei || (log as any).imei || 'Unknown') === deviceFilter
      )
    }

    // Severity filter (for exceptions only)
    if (type === 'exception' && severityFilter !== 'all') {
      filtered = filtered.filter(log => {
        const severity = getSeverity((log as any).main || (log as any).errorCode || '')
        return severity.level === severityFilter
      })
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'timestamp':
          aValue = (a as any).createdAt?.toDate?.() || new Date((a as any).timestamp || 0)
          bValue = (b as any).createdAt?.toDate?.() || new Date((b as any).timestamp || 0)
          break
        case 'device':
          aValue = (a as any).deviceImei || (a as any).imei || ''
          bValue = (b as any).deviceImei || (b as any).imei || ''
          break
        case 'severity':
          if (type === 'exception') {
            const aSeverity = getSeverity((a as any).main || (a as any).errorCode || '')
            const bSeverity = getSeverity((b as any).main || (b as any).errorCode || '')
            const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 }
            aValue = severityOrder[aSeverity.level]
            bValue = severityOrder[bSeverity.level]
          } else {
            aValue = 0
            bValue = 0
          }
          break
        case 'message':
          aValue = (a as any).main || (a as any).errorCode || (a as any).message || ''
          bValue = (b as any).main || (b as any).errorCode || (b as any).message || ''
          break
        default:
          aValue = (a as any)[sortField] || ''
          bValue = (b as any)[sortField] || ''
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [logs, searchTerm, sortField, sortDirection, severityFilter, deviceFilter, type])

  // Pagination
  const totalPages = Math.ceil(processedLogs.length / pageSize)
  const paginatedLogs = processedLogs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4 ml-1" /> : 
      <ChevronDown className="h-4 w-4 ml-1" />
  }

  const formatTimestamp = (log: any) => {
    const timestamp = log.createdAt?.toDate?.() || new Date(log.timestamp || '')
    return timestamp.toLocaleString()
  }

  const exportData = () => {
    const csvContent = [
      // Header
      type === 'ignition' 
        ? ['Timestamp', 'Device IMEI', 'Status', 'Message', 'Voltage', 'Location']
        : ['Timestamp', 'Device IMEI', 'Severity', 'Error Code', 'Message', 'Details'],
      // Data
      ...processedLogs.map(log => {
        if (type === 'ignition') {
          const ignitionLog = log as IgnitionLog
          return [
            formatTimestamp(ignitionLog),
            ignitionLog.deviceImei || ignitionLog.imei || 'N/A',
            ignitionLog.ignitionStatus ? 'ON' : 'OFF',
            ignitionLog.message || 'N/A',
            ignitionLog.voltage?.toString() || 'N/A',
            ignitionLog.location ? `${ignitionLog.location.latitude}, ${ignitionLog.location.longitude}` : 'N/A'
          ]
        } else {
          const exceptionLog = log as ExceptionLog
          const severity = getSeverity(exceptionLog.main || exceptionLog.errorCode || '')
          return [
            formatTimestamp(exceptionLog),
            exceptionLog.deviceImei || exceptionLog.imei || 'N/A',
            severity.level.toUpperCase(),
            exceptionLog.main || exceptionLog.errorCode || 'N/A',
            exceptionLog.details || exceptionLog.errorMessage || 'N/A',
            exceptionLog.details || 'N/A'
          ]
        }
      })
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type}_logs_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading {type} logs...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-4">
          <div>
            <CardTitle className="capitalize text-lg sm:text-xl">{type} Logs</CardTitle>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              {processedLogs.length} of {logs.length} logs
              {searchTerm && ` matching "${searchTerm}"`}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
              
              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="All Devices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  {uniqueDevices.map(device => (
                    <SelectItem key={device} value={device}>
                      {device}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {type === 'exception' && (
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-full sm:w-32">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button onClick={exportData} variant="outline" size="sm" className="w-full sm:w-auto">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="ml-2 sm:ml-0">Export CSV</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50 min-w-[140px] text-xs sm:text-sm"
                  onClick={() => handleSort('timestamp')}
                >
                  <div className="flex items-center">
                    Timestamp
                    <SortIcon field="timestamp" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50 min-w-[120px] text-xs sm:text-sm"
                  onClick={() => handleSort('device')}
                >
                  <div className="flex items-center">
                    Device IMEI
                    <SortIcon field="device" />
                  </div>
                </TableHead>
                {type === 'exception' && (
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50 min-w-[80px] text-xs sm:text-sm"
                    onClick={() => handleSort('severity')}
                  >
                    <div className="flex items-center">
                      Severity
                      <SortIcon field="severity" />
                    </div>
                  </TableHead>
                )}
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50 min-w-[100px] text-xs sm:text-sm"
                  onClick={() => handleSort('message')}
                >
                  <div className="flex items-center">
                    {type === 'ignition' ? 'Status' : 'Error Code'}
                    <SortIcon field="message" />
                  </div>
                </TableHead>
                <TableHead className="min-w-[200px] text-xs sm:text-sm">Details</TableHead>
                {type === 'ignition' && (
                  <>
                    <TableHead className="min-w-[80px] text-xs sm:text-sm">Voltage</TableHead>
                    <TableHead className="min-w-[120px] text-xs sm:text-sm">Location</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLogs.map((log, index) => {
                if (type === 'ignition') {
                  const ignitionLog = log as IgnitionLog
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-xs sm:text-sm whitespace-nowrap">
                        {formatTimestamp(ignitionLog)}
                      </TableCell>
                      <TableCell className="font-mono text-xs sm:text-sm">
                        {ignitionLog.deviceImei || ignitionLog.imei || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ignitionLog.ignitionStatus ? 'default' : 'secondary'} className="text-xs">
                          {ignitionLog.ignitionStatus ? 'ON' : 'OFF'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs sm:text-sm">
                        {ignitionLog.message || 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {ignitionLog.voltage ? `${ignitionLog.voltage}V` : 'N/A'}
                      </TableCell>
                      <TableCell className="font-mono text-xs sm:text-sm">
                        {ignitionLog.location 
                          ? `${ignitionLog.location.latitude?.toFixed(4)}, ${ignitionLog.location.longitude?.toFixed(4)}`
                          : 'N/A'
                        }
                      </TableCell>
                    </TableRow>
                  )
                } else {
                  const exceptionLog = log as ExceptionLog
                  const severity = getSeverity(exceptionLog.main || exceptionLog.errorCode || '')
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-xs sm:text-sm whitespace-nowrap">
                        {formatTimestamp(exceptionLog)}
                      </TableCell>
                      <TableCell className="font-mono text-xs sm:text-sm">
                        {exceptionLog.deviceImei || exceptionLog.imei || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            severity.level === 'critical' ? 'destructive' :
                            severity.level === 'high' ? 'destructive' :
                            severity.level === 'medium' ? 'secondary' :
                            'outline'
                          }
                          className={`${severity.color} text-xs`}
                        >
                          {severity.level.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-xs sm:text-sm">
                        {exceptionLog.main || exceptionLog.errorCode || 'N/A'}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="truncate text-xs sm:text-sm" title={exceptionLog.details || exceptionLog.errorMessage || 'N/A'}>
                          {exceptionLog.details || exceptionLog.errorMessage || 'N/A'}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                }
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <span className="text-xs sm:text-sm text-gray-600">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, processedLogs.length)} of {processedLogs.length} results
              </span>
              <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-8 h-8 p-0 text-xs"
                    >
                      {page}
                    </Button>
                  )
                })}
                {totalPages > 3 && (
                  <>
                    <span className="px-1 text-xs">...</span>
                    <Button
                      variant={currentPage === totalPages ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      className="w-8 h-8 p-0 text-xs"
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="sm:hidden">Next</span>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
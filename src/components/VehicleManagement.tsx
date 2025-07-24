import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Alert, AlertDescription } from './ui/alert'
import { Textarea } from './ui/textarea'
import { 
  Car, Edit, Plus, Save, X, Search, Download, Upload, 
  AlertCircle, CheckCircle, Trash2 
} from 'lucide-react'
import { VehicleService } from '../services/vehicleService'
import { VehicleAssignment } from '../types/vehicle'
import { IgnitionLog, ExceptionLog } from '../types/logs'
import { parseTimestamp } from '../lib/dateUtils'

interface VehicleManagementProps {
  ignitionLogs: IgnitionLog[]
  exceptionLogs: ExceptionLog[]
}

export function VehicleManagement({ ignitionLogs, exceptionLogs }: VehicleManagementProps) {
  const [assignments, setAssignments] = useState(VehicleService.getAllAssignments())
  const [searchQuery, setSearchQuery] = useState('')
  const [editingDevice, setEditingDevice] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [formData, setFormData] = useState({
    imei: '',
    vehicleName: '',
    nickname: '',
    model: '',
    color: '',
    notes: ''
  })
  const [importData, setImportData] = useState('')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Get all unique device IMEIs from logs
  const allDeviceImeis = useMemo(() => {
    return Array.from(new Set([
      ...ignitionLogs.map(log => log.deviceImei || log.imei),
      ...exceptionLogs.map(log => log.deviceImei || log.imei)
    ])).filter(Boolean).sort()
  }, [ignitionLogs, exceptionLogs])

  // Filter assignments based on search
  const filteredAssignments = useMemo(() => {
    if (!searchQuery) return assignments
    
    const query = searchQuery.toLowerCase()
    return Object.fromEntries(
      Object.entries(assignments).filter(([imei, assignment]) =>
        imei.toLowerCase().includes(query) ||
        assignment.vehicleName.toLowerCase().includes(query) ||
        assignment.nickname.toLowerCase().includes(query) ||
        assignment.model?.toLowerCase().includes(query) ||
        assignment.notes?.toLowerCase().includes(query)
      )
    )
  }, [assignments, searchQuery])

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleSave = (imei: string) => {
    if (!formData.vehicleName.trim() || !formData.nickname.trim()) {
      showMessage('error', 'Vehicle name and nickname are required')
      return
    }

    VehicleService.setAssignment(imei, {
      vehicleName: formData.vehicleName.trim(),
      nickname: formData.nickname.trim(),
      model: formData.model.trim() || undefined,
      color: formData.color.trim() || undefined,
      notes: formData.notes.trim() || undefined
    })

    setAssignments(VehicleService.getAllAssignments())
    setEditingDevice(null)
    setFormData({ imei: '', vehicleName: '', nickname: '', model: '', color: '', notes: '' })
    showMessage('success', 'Vehicle assignment saved successfully')
  }

  const handleEdit = (imei: string) => {
    const assignment = assignments[imei]
    if (assignment) {
      setFormData({
        imei,
        vehicleName: assignment.vehicleName,
        nickname: assignment.nickname,
        model: assignment.model || '',
        color: assignment.color || '',
        notes: assignment.notes || ''
      })
      setEditingDevice(imei)
    }
  }

  const handleDelete = (imei: string) => {
    if (confirm(`Are you sure you want to remove the assignment for ${imei}?`)) {
      VehicleService.removeAssignment(imei)
      setAssignments(VehicleService.getAllAssignments())
      showMessage('success', 'Vehicle assignment removed successfully')
    }
  }

  const handleAddNew = () => {
    if (!formData.imei.trim() || !formData.vehicleName.trim() || !formData.nickname.trim()) {
      showMessage('error', 'IMEI, vehicle name, and nickname are required')
      return
    }

    VehicleService.setAssignment(formData.imei.trim(), {
      vehicleName: formData.vehicleName.trim(),
      nickname: formData.nickname.trim(),
      model: formData.model.trim() || undefined,
      color: formData.color.trim() || undefined,
      notes: formData.notes.trim() || undefined
    })

    setAssignments(VehicleService.getAllAssignments())
    setShowAddDialog(false)
    setFormData({ imei: '', vehicleName: '', nickname: '', model: '', color: '', notes: '' })
    showMessage('success', 'New vehicle assignment added successfully')
  }

  const handleExport = () => {
    const data = VehicleService.exportAssignments()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vehicle-assignments-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showMessage('success', 'Vehicle assignments exported successfully')
  }

  const handleImport = () => {
    if (!importData.trim()) {
      showMessage('error', 'Please paste the JSON data to import')
      return
    }

    const result = VehicleService.importAssignments(importData)
    if (result.success) {
      setAssignments(VehicleService.getAllAssignments())
      setShowImportDialog(false)
      setImportData('')
      showMessage('success', 'Vehicle assignments imported successfully')
    } else {
      showMessage('error', result.error || 'Failed to import assignments')
    }
  }

  const getDeviceStats = (imei: string) => {
    const ignitionCount = ignitionLogs.filter(log => (log.deviceImei || log.imei) === imei).length
    const exceptionCount = exceptionLogs.filter(log => (log.deviceImei || log.imei) === imei).length
    return { ignitionCount, exceptionCount }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicle Management</h1>
          <p className="text-gray-600">Assign vehicle names and nicknames to device IMEIs</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Vehicle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Vehicle Assignment</DialogTitle>
                <DialogDescription>
                  Assign a vehicle name and nickname to a device IMEI
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new-imei">Device IMEI</Label>
                  <Input
                    id="new-imei"
                    value={formData.imei}
                    onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                    placeholder="Enter device IMEI"
                  />
                </div>
                <div>
                  <Label htmlFor="new-vehicle-name">Vehicle Name</Label>
                  <Input
                    id="new-vehicle-name"
                    value={formData.vehicleName}
                    onChange={(e) => setFormData({ ...formData, vehicleName: e.target.value })}
                    placeholder="e.g., Honda City"
                  />
                </div>
                <div>
                  <Label htmlFor="new-nickname">Nickname</Label>
                  <Input
                    id="new-nickname"
                    value={formData.nickname}
                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                    placeholder="e.g., City A100"
                  />
                </div>
                <div>
                  <Label htmlFor="new-model">Model (Optional)</Label>
                  <Input
                    id="new-model"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="e.g., Honda City 2023"
                  />
                </div>
                <div>
                  <Label htmlFor="new-color">Color (Optional)</Label>
                  <Input
                    id="new-color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="e.g., White"
                  />
                </div>
                <div>
                  <Label htmlFor="new-notes">Notes (Optional)</Label>
                  <Textarea
                    id="new-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes about this vehicle"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddNew} className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    Add Vehicle
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Import Vehicle Assignments</DialogTitle>
                <DialogDescription>
                  Paste the JSON data from a previous export
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder="Paste JSON data here..."
                  rows={10}
                />
                <div className="flex gap-2">
                  <Button onClick={handleImport} className="flex-1">
                    Import
                  </Button>
                  <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Message */}
      {message && (
        <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by IMEI, vehicle name, nickname, or model..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allDeviceImeis.length}</div>
            <p className="text-xs text-muted-foreground">From Firebase logs</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assigned Vehicles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{Object.keys(assignments).length}</div>
            <p className="text-xs text-muted-foreground">With vehicle names</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unassigned Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {allDeviceImeis.filter(imei => !assignments[imei!]).length}
            </div>
            <p className="text-xs text-muted-foreground">Need assignment</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {allDeviceImeis.filter(imei => {
                const stats = getDeviceStats(imei!)
                return stats.ignitionCount > 0 || stats.exceptionCount > 0
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">With recent activity</p>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>Vehicle Assignments</CardTitle>
          <CardDescription>
            Manage vehicle names and nicknames for easier device identification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Assigned Vehicles */}
            {Object.entries(filteredAssignments).length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Assigned Vehicles</h3>
                <div className="grid gap-3">
                  {Object.entries(filteredAssignments).map(([imei, assignment]) => {
                    const stats = getDeviceStats(imei)
                    const isEditing = editingDevice === imei
                    
                    return (
                      <div key={imei} className="border rounded-lg p-4">
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor={`vehicle-name-${imei}`}>Vehicle Name</Label>
                                <Input
                                  id={`vehicle-name-${imei}`}
                                  value={formData.vehicleName}
                                  onChange={(e) => setFormData({ ...formData, vehicleName: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`nickname-${imei}`}>Nickname</Label>
                                <Input
                                  id={`nickname-${imei}`}
                                  value={formData.nickname}
                                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`model-${imei}`}>Model</Label>
                                <Input
                                  id={`model-${imei}`}
                                  value={formData.model}
                                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`color-${imei}`}>Color</Label>
                                <Input
                                  id={`color-${imei}`}
                                  value={formData.color}
                                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor={`notes-${imei}`}>Notes</Label>
                              <Textarea
                                id={`notes-${imei}`}
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={2}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleSave(imei)}>
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingDevice(null)}>
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Car className="h-5 w-5 text-blue-500" />
                                <div>
                                  <div className="font-semibold text-lg">{assignment.nickname}</div>
                                  <div className="text-sm text-gray-600">{assignment.vehicleName}</div>
                                </div>
                                {assignment.model && (
                                  <Badge variant="secondary">{assignment.model}</Badge>
                                )}
                                {assignment.color && (
                                  <Badge variant="outline">{assignment.color}</Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 mb-2">
                                IMEI: <span className="font-mono">{imei}</span>
                              </div>
                              <div className="flex gap-4 text-sm text-gray-500">
                                <span>{stats.ignitionCount} ignitions</span>
                                <span>{stats.exceptionCount} exceptions</span>
                                <span>Updated: {parseTimestamp(assignment.updatedAt).toLocaleDateString()}</span>
                              </div>
                              {assignment.notes && (
                                <div className="text-sm text-gray-600 mt-2 italic">
                                  {assignment.notes}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button size="sm" variant="outline" onClick={() => handleEdit(imei)}>
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDelete(imei)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Unassigned Devices */}
            {allDeviceImeis.filter(imei => !assignments[imei!]).length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Unassigned Devices</h3>
                <div className="grid gap-2">
                  {allDeviceImeis.filter(imei => !assignments[imei!]).map(imei => {
                    const stats = getDeviceStats(imei!)
                    const isEditing = editingDevice === imei
                    
                    return (
                      <div key={imei} className="border rounded-lg bg-gray-50">
                        {isEditing ? (
                          <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2 mb-3">
                              <Car className="h-5 w-5 text-blue-500" />
                              <div>
                                <div className="font-medium">Assigning Vehicle to:</div>
                                <div className="text-sm text-gray-600 font-mono">{imei}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor={`vehicle-name-${imei}`}>Vehicle Name *</Label>
                                <Input
                                  id={`vehicle-name-${imei}`}
                                  value={formData.vehicleName}
                                  onChange={(e) => setFormData({ ...formData, vehicleName: e.target.value })}
                                  placeholder="e.g., Honda City"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`nickname-${imei}`}>Nickname *</Label>
                                <Input
                                  id={`nickname-${imei}`}
                                  value={formData.nickname}
                                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                                  placeholder="e.g., A100"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`model-${imei}`}>Model</Label>
                                <Input
                                  id={`model-${imei}`}
                                  value={formData.model}
                                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                  placeholder="e.g., Honda City 2023"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`color-${imei}`}>Color</Label>
                                <Input
                                  id={`color-${imei}`}
                                  value={formData.color}
                                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                  placeholder="e.g., White"
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor={`notes-${imei}`}>Notes</Label>
                              <Textarea
                                id={`notes-${imei}`}
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Additional notes about this vehicle"
                                rows={2}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleSave(imei!)}>
                                <Save className="h-3 w-3 mr-1" />
                                Save Assignment
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingDevice(null)}>
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-3">
                            <div>
                              <div className="font-mono font-medium">{imei}</div>
                              <div className="text-sm text-gray-500">
                                {stats.ignitionCount} ignitions, {stats.exceptionCount} exceptions
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                setFormData({
                                  imei: imei!,
                                  vehicleName: '',
                                  nickname: '',
                                  model: '',
                                  color: '',
                                  notes: ''
                                })
                                setEditingDevice(imei!)
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Assign
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
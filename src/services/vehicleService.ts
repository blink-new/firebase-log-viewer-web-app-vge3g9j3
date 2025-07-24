import { VehicleAssignment, VehicleConfig, DEFAULT_VEHICLE_ASSIGNMENTS } from '../types/vehicle'

const STORAGE_KEY = 'firebase-log-viewer-vehicle-assignments'

export class VehicleService {
  private static config: VehicleConfig = {
    assignments: { ...DEFAULT_VEHICLE_ASSIGNMENTS }
  }

  static {
    // Load from localStorage on initialization
    this.loadFromStorage()
  }

  private static loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        this.config = {
          assignments: {
            ...DEFAULT_VEHICLE_ASSIGNMENTS,
            ...parsed.assignments
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load vehicle assignments from storage:', error)
    }
  }

  private static saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config))
    } catch (error) {
      console.warn('Failed to save vehicle assignments to storage:', error)
    }
  }

  static getAllAssignments(): Record<string, VehicleAssignment> {
    return { ...this.config.assignments }
  }

  static getAssignment(imei: string): VehicleAssignment | null {
    return this.config.assignments[imei] || null
  }

  static getVehicleDisplayName(imei: string): string {
    const assignment = this.getAssignment(imei)
    if (assignment) {
      return assignment.nickname || assignment.vehicleName || imei
    }
    return imei
  }

  static getVehicleFullInfo(imei: string): { displayName: string; vehicleName?: string; model?: string } {
    const assignment = this.getAssignment(imei)
    if (assignment) {
      return {
        displayName: assignment.nickname || assignment.vehicleName || imei,
        vehicleName: assignment.vehicleName,
        model: assignment.model
      }
    }
    return { displayName: imei }
  }

  static setAssignment(imei: string, assignment: Omit<VehicleAssignment, 'imei' | 'createdAt' | 'updatedAt'>): void {
    const existing = this.config.assignments[imei]
    
    this.config.assignments[imei] = {
      ...assignment,
      imei,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date()
    }
    
    this.saveToStorage()
  }

  static removeAssignment(imei: string): void {
    delete this.config.assignments[imei]
    this.saveToStorage()
  }

  static updateAssignment(imei: string, updates: Partial<Omit<VehicleAssignment, 'imei' | 'createdAt'>>): void {
    const existing = this.config.assignments[imei]
    if (existing) {
      this.config.assignments[imei] = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      }
      this.saveToStorage()
    }
  }

  static searchAssignments(query: string): VehicleAssignment[] {
    const searchTerm = query.toLowerCase()
    return Object.values(this.config.assignments).filter(assignment =>
      assignment.imei.toLowerCase().includes(searchTerm) ||
      assignment.vehicleName.toLowerCase().includes(searchTerm) ||
      assignment.nickname.toLowerCase().includes(searchTerm) ||
      assignment.model?.toLowerCase().includes(searchTerm) ||
      assignment.notes?.toLowerCase().includes(searchTerm)
    )
  }

  static getAssignmentStats(): {
    totalAssignments: number
    assignedDevices: number
    unassignedDevices: number
    deviceImeis: string[]
  } {
    const allImeis = new Set<string>()
    
    // This would be populated with actual device IMEIs from Firebase
    // For now, we'll use the assignments as a base
    Object.keys(this.config.assignments).forEach(imei => allImeis.add(imei))
    
    return {
      totalAssignments: Object.keys(this.config.assignments).length,
      assignedDevices: Object.keys(this.config.assignments).length,
      unassignedDevices: 0, // Would be calculated based on actual device list
      deviceImeis: Array.from(allImeis)
    }
  }

  static exportAssignments(): string {
    return JSON.stringify(this.config, null, 2)
  }

  static importAssignments(jsonData: string): { success: boolean; error?: string } {
    try {
      const imported = JSON.parse(jsonData)
      if (imported.assignments && typeof imported.assignments === 'object') {
        this.config = {
          assignments: {
            ...this.config.assignments,
            ...imported.assignments
          }
        }
        this.saveToStorage()
        return { success: true }
      } else {
        return { success: false, error: 'Invalid format: missing assignments object' }
      }
    } catch (error) {
      return { success: false, error: `Failed to parse JSON: ${error}` }
    }
  }
}
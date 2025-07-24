export interface VehicleAssignment {
  imei: string
  vehicleName: string
  nickname: string
  model?: string
  color?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface VehicleConfig {
  assignments: Record<string, VehicleAssignment>
}

// Default vehicle assignments based on your examples
export const DEFAULT_VEHICLE_ASSIGNMENTS: Record<string, VehicleAssignment> = {
  'A100': {
    imei: 'A100',
    vehicleName: 'Honda City',
    nickname: 'City A100',
    model: 'Honda City',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  'B100': {
    imei: 'B100',
    vehicleName: 'Honda Civic',
    nickname: 'Civic B100',
    model: 'Honda Civic',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  'HD5501': {
    imei: 'HD5501',
    vehicleName: 'Honda BRV',
    nickname: 'BRV HD5501',
    model: 'Honda BRV',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  'C100': {
    imei: 'C100',
    vehicleName: 'Honda HRV',
    nickname: 'HRV C100',
    model: 'Honda HRV',
    createdAt: new Date(),
    updatedAt: new Date()
  }
}
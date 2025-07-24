export interface IgnitionLog {
  id: string
  imei: string
  timestamp: string
  createdAt: any // Firestore timestamp
  status: 'ON' | 'OFF' | 'UNKNOWN'
  voltage: number
  location: {
    lat: number
    lng: number
  }
  message?: string
  details?: string
  address?: string
  logType?: string
}

export interface ExceptionLog {
  id: string
  imei: string
  timestamp: string
  createdAt: any // Firestore timestamp
  errorCode: string
  errorMessage: string
  severity: 'low' | 'medium' | 'high'
  location: {
    lat: number
    lng: number
  }
}
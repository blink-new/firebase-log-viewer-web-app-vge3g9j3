import { AlertNotification } from '../types/analytics'

export class NotificationService {
  private static instance: NotificationService
  private notifications: AlertNotification[] = []
  private listeners: ((notifications: AlertNotification[]) => void)[] = []
  private audioContext: AudioContext | null = null
  private isEnabled = true
  private soundEnabled = true

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  private constructor() {
    this.requestNotificationPermission()
    this.initializeAudio()
  }

  private async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  private initializeAudio() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.warn('Audio context not supported:', error)
    }
  }

  private playAlertSound(type: 'critical' | 'warning' | 'info') {
    if (!this.soundEnabled || !this.audioContext) return

    try {
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      // Different frequencies for different alert types
      const frequencies = {
        critical: [800, 1000, 800], // Urgent beeping
        warning: [600, 800], // Medium beeping
        info: [400] // Single tone
      }

      const freq = frequencies[type]
      let time = this.audioContext.currentTime

      freq.forEach((frequency, index) => {
        oscillator.frequency.setValueAtTime(frequency, time)
        gainNode.gain.setValueAtTime(0.1, time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.2)
        time += 0.3
      })

      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(time)
    } catch (error) {
      console.warn('Failed to play alert sound:', error)
    }
  }

  addNotification(notification: Omit<AlertNotification, 'id' | 'timestamp' | 'acknowledged'>): void {
    if (!this.isEnabled) return

    const newNotification: AlertNotification = {
      ...notification,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false
    }

    this.notifications.unshift(newNotification)
    
    // Keep only last 100 notifications
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100)
    }

    // Show browser notification
    this.showBrowserNotification(newNotification)
    
    // Play sound alert
    this.playAlertSound(newNotification.type)
    
    // Notify listeners
    this.notifyListeners()
  }

  private showBrowserNotification(notification: AlertNotification): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.svg',
        tag: notification.id,
        requireInteraction: notification.type === 'critical'
      })

      // Auto-close after 10 seconds for non-critical alerts
      if (notification.type !== 'critical') {
        setTimeout(() => {
          browserNotification.close()
        }, 10000)
      }

      browserNotification.onclick = () => {
        window.focus()
        browserNotification.close()
      }
    }
  }

  acknowledgeNotification(id: string, acknowledgedBy: string): void {
    const notification = this.notifications.find(n => n.id === id)
    if (notification && !notification.acknowledged) {
      notification.acknowledged = true
      notification.acknowledgedBy = acknowledgedBy
      notification.acknowledgedAt = new Date()
      this.notifyListeners()
    }
  }

  getNotifications(): AlertNotification[] {
    return [...this.notifications]
  }

  getUnacknowledgedCount(): number {
    return this.notifications.filter(n => !n.acknowledged).length
  }

  getCriticalCount(): number {
    return this.notifications.filter(n => n.type === 'critical' && !n.acknowledged).length
  }

  subscribe(listener: (notifications: AlertNotification[]) => void): () => void {
    this.listeners.push(listener)
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener([...this.notifications])
      } catch (error) {
        console.error('Error notifying listener:', error)
      }
    })
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled
  }

  isNotificationEnabled(): boolean {
    return this.isEnabled
  }

  isSoundEnabled(): boolean {
    return this.soundEnabled
  }

  clearAll(): void {
    this.notifications = []
    this.notifyListeners()
  }

  clearAcknowledged(): void {
    this.notifications = this.notifications.filter(n => !n.acknowledged)
    this.notifyListeners()
  }

  // Predefined alert generators
  static createServerDownAlert(deviceCount: number): Omit<AlertNotification, 'id' | 'timestamp' | 'acknowledged'> {
    return {
      type: 'critical',
      title: 'Server Down Alert',
      message: `Server is down affecting ${deviceCount} device${deviceCount !== 1 ? 's' : ''}. End users cannot access the service.`,
      imei: undefined
    }
  }

  static createDeviceOfflineAlert(imei: string): Omit<AlertNotification, 'id' | 'timestamp' | 'acknowledged'> {
    return {
      type: 'warning',
      title: 'Device Offline',
      message: `Device ${imei} has been offline for more than 2 hours.`,
      imei
    }
  }

  static createBatteryLowAlert(imei: string, voltage: number): Omit<AlertNotification, 'id' | 'timestamp' | 'acknowledged'> {
    return {
      type: 'warning',
      title: 'Low Battery Alert',
      message: `Device ${imei} battery voltage is low (${voltage.toFixed(2)}V). Consider replacement.`,
      imei
    }
  }

  static createAnomalyAlert(imei: string, anomalyType: string, description: string): Omit<AlertNotification, 'id' | 'timestamp' | 'acknowledged'> {
    return {
      type: 'warning',
      title: 'Anomaly Detected',
      message: `${anomalyType} detected on device ${imei}: ${description}`,
      imei
    }
  }

  static createPredictiveAlert(imei: string, alertType: string, timeToFailure: number): Omit<AlertNotification, 'id' | 'timestamp' | 'acknowledged'> {
    return {
      type: 'info',
      title: 'Predictive Alert',
      message: `${alertType} predicted for device ${imei} in approximately ${Math.round(timeToFailure)} hours.`,
      imei
    }
  }
}
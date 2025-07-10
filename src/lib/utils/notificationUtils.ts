import { supabase } from '@/lib/supabase/client'

export interface NotificationSetting {
  id: string
  userEmail: string
  notificationType: string
  enabled: boolean
  channels: string[]
  createdAt: string
}

export interface NotificationQueue {
  id: string
  recipientEmail: string
  notificationType: string
  title: string
  message: string
  channels: string[]
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  sentAt?: string
  createdAt: string
}

export interface NotificationEvent {
  type: string
  title: string
  message: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  data?: any
  recipients?: string[]
}

// Predefined notification types and their default recipients
export const NotificationTypes = {
  // Production Events
  PRODUCTION_STARTED: 'production_started',
  PRODUCTION_COMPLETED: 'production_completed',
  BATCH_CREATED: 'batch_created',
  BATCH_COMPLETED: 'batch_completed',
  WASTAGE_THRESHOLD_EXCEEDED: 'wastage_threshold_exceeded',
  
  // Order Events
  ORDER_ALLOCATED: 'order_allocated',
  ORDER_READY_DISPATCH: 'order_ready_dispatch',
  ORDER_DISPATCHED: 'order_dispatched',
  ORDER_DELIVERED: 'order_delivered',
  
  // Inventory Events
  LOW_STOCK_ALERT: 'low_stock_alert',
  STOCK_MOVEMENT: 'stock_movement',
  
  // System Events
  SYSTEM_ERROR: 'system_error',
  DAILY_SUMMARY: 'daily_summary'
} as const

// Default notification recipients by type
export const DefaultRecipients = {
  [NotificationTypes.PRODUCTION_STARTED]: ['production_manager@unica.com'],
  [NotificationTypes.PRODUCTION_COMPLETED]: ['production_manager@unica.com', 'inventory_manager@unica.com'],
  [NotificationTypes.BATCH_CREATED]: ['production_team@unica.com'],
  [NotificationTypes.BATCH_COMPLETED]: ['production_manager@unica.com', 'quality_team@unica.com'],
  [NotificationTypes.WASTAGE_THRESHOLD_EXCEEDED]: ['production_manager@unica.com', 'quality_manager@unica.com'],
  [NotificationTypes.ORDER_ALLOCATED]: ['sales_team@unica.com'],
  [NotificationTypes.ORDER_READY_DISPATCH]: ['logistics_team@unica.com', 'sales_team@unica.com'],
  [NotificationTypes.ORDER_DISPATCHED]: ['customer_service@unica.com', 'sales_team@unica.com'],
  [NotificationTypes.ORDER_DELIVERED]: ['customer_service@unica.com'],
  [NotificationTypes.LOW_STOCK_ALERT]: ['inventory_manager@unica.com', 'production_planner@unica.com'],
  [NotificationTypes.STOCK_MOVEMENT]: ['inventory_manager@unica.com'],
  [NotificationTypes.SYSTEM_ERROR]: ['admin@unica.com'],
  [NotificationTypes.DAILY_SUMMARY]: ['management@unica.com']
}

export const notificationUtils = {
  // Get notification settings for a user
  getUserNotificationSettings: async (userEmail: string): Promise<NotificationSetting[]> => {
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_email', userEmail)
        .eq('enabled', true)
      
      if (error) {
        throw new Error(`Failed to get notification settings: ${error.message}`)
      }
      
      return data.map(setting => ({
        id: setting.id,
        userEmail: setting.user_email,
        notificationType: setting.notification_type,
        enabled: setting.enabled,
        channels: setting.channels,
        createdAt: setting.created_at
      }))
    } catch (error) {
      console.error('Error getting notification settings:', error)
      return []
    }
  },

  // Create or update notification setting
  updateNotificationSetting: async (
    userEmail: string,
    notificationType: string,
    enabled: boolean,
    channels: string[] = ['email']
  ): Promise<NotificationSetting> => {
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .upsert({
          user_email: userEmail,
          notification_type: notificationType,
          enabled: enabled,
          channels: channels
        })
        .select()
        .single()
      
      if (error) {
        throw new Error(`Failed to update notification setting: ${error.message}`)
      }
      
      return {
        id: data.id,
        userEmail: data.user_email,
        notificationType: data.notification_type,
        enabled: data.enabled,
        channels: data.channels,
        createdAt: data.created_at
      }
    } catch (error) {
      console.error('Error updating notification setting:', error)
      throw error
    }
  },

  // Send notification
  sendNotification: async (notification: NotificationEvent): Promise<void> => {
    try {
      // Get recipients for this notification type
      const recipients = notification.recipients || DefaultRecipients[notification.type as keyof typeof DefaultRecipients] || []
      
      if (recipients.length === 0) {
        console.warn(`No recipients configured for notification type: ${notification.type}`)
        return
      }
      
      // Get enabled notification settings for each recipient
      const notifications = []
      
      for (const email of recipients) {
        const settings = await notificationUtils.getUserNotificationSettings(email)
        const setting = settings.find(s => s.notificationType === notification.type)
        
        if (setting && setting.enabled) {
          notifications.push({
            recipient_email: email,
            notification_type: notification.type,
            title: notification.title,
            message: notification.message,
            channels: setting.channels,
            priority: notification.priority || 'normal',
            status: 'pending'
          })
        }
      }
      
      if (notifications.length === 0) {
        console.warn(`No enabled notifications found for type: ${notification.type}`)
        return
      }
      
      // Queue notifications
      const { error } = await supabase
        .from('notification_queue')
        .insert(notifications)
      
      if (error) {
        throw new Error(`Failed to queue notifications: ${error.message}`)
      }
      
      // Process notifications immediately for high priority
      if (notification.priority === 'high' || notification.priority === 'urgent') {
        await notificationUtils.processNotificationQueue(10) // Process up to 10 high priority notifications
      }
      
    } catch (error) {
      console.error('Error sending notification:', error)
      throw error
    }
  },

  // Process notification queue
  processNotificationQueue: async (limit: number = 50): Promise<void> => {
    try {
      const { data: notifications, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false }) // Process urgent first
        .order('created_at', { ascending: true }) // Then oldest first
        .limit(limit)
      
      if (error) {
        throw new Error(`Failed to get notification queue: ${error.message}`)
      }
      
      if (!notifications || notifications.length === 0) {
        return
      }
      
      for (const notification of notifications) {
        try {
          // Send notification based on channels
          const success = await notificationUtils.deliverNotification(notification)
          
          // Update status
          await supabase
            .from('notification_queue')
            .update({
              status: success ? 'sent' : 'failed',
              sent_at: success ? new Date().toISOString() : null
            })
            .eq('id', notification.id)
          
        } catch (error) {
          console.error(`Failed to process notification ${notification.id}:`, error)
          
          // Mark as failed
          await supabase
            .from('notification_queue')
            .update({ status: 'failed' })
            .eq('id', notification.id)
        }
      }
    } catch (error) {
      console.error('Error processing notification queue:', error)
    }
  },

  // Deliver notification via configured channels
  deliverNotification: async (notification: any): Promise<boolean> => {
    try {
      let success = false
      
      // Email delivery
      if (notification.channels.includes('email')) {
        success = await notificationUtils.sendEmail(notification)
      }
      
      // SMS delivery (placeholder for future implementation)
      if (notification.channels.includes('sms')) {
        // TODO: Implement SMS delivery
        console.log('SMS delivery not yet implemented')
      }
      
      // Push notification (placeholder for future implementation)
      if (notification.channels.includes('push')) {
        // TODO: Implement push notifications
        console.log('Push notifications not yet implemented')
      }
      
      return success
    } catch (error) {
      console.error('Error delivering notification:', error)
      return false
    }
  },

  // Send email notification using email service
  sendEmail: async (notification: any): Promise<boolean> => {
    try {
      // Import email service dynamically to avoid issues during build
      const { default: emailService } = await import('@/lib/email/emailService')
      
      // Create HTML email content
      const emailHTML = emailService.createNotificationEmailHTML(
        notification.title,
        notification.message,
        notification.priority,
        notification.data ? (typeof notification.data === 'string' ? JSON.parse(notification.data) : notification.data) : undefined
      )

      // Send email using the email service
      const success = await emailService.sendEmail({
        to: notification.recipient_email,
        subject: notification.title,
        html: emailHTML
      })

      if (success) {
        console.log(`Email notification sent successfully to ${notification.recipient_email}`)
      } else {
        console.error(`Failed to send email notification to ${notification.recipient_email}`)
      }
      
      return success
    } catch (error) {
      console.error('Error sending email:', error)
      return false
    }
  },

  // Predefined notification templates
  createProductionNotification: (type: 'started' | 'completed', data: {
    batchNumber: string
    productionType: string
    quantity: number
    wastagePercentage?: number
  }): NotificationEvent => {
    const templates = {
      started: {
        type: NotificationTypes.PRODUCTION_STARTED,
        title: `Production Started - ${data.batchNumber}`,
        message: `${data.productionType} production started for batch ${data.batchNumber}. Target quantity: ${data.quantity}m`,
        priority: 'normal' as const
      },
      completed: {
        type: NotificationTypes.PRODUCTION_COMPLETED,
        title: `Production Completed - ${data.batchNumber}`,
        message: `${data.productionType} production completed for batch ${data.batchNumber}. Quantity produced: ${data.quantity}m${data.wastagePercentage ? `. Wastage: ${data.wastagePercentage}%` : ''}`,
        priority: 'normal' as const
      }
    }
    
    return {
      ...templates[type],
      data
    }
  },

  createWastageAlert: (data: {
    batchNumber: string
    wastagePercentage: number
    threshold: number
  }): NotificationEvent => ({
    type: NotificationTypes.WASTAGE_THRESHOLD_EXCEEDED,
    title: `High Wastage Alert - ${data.batchNumber}`,
    message: `Wastage of ${data.wastagePercentage}% exceeds threshold of ${data.threshold}% for batch ${data.batchNumber}. Please investigate.`,
    priority: 'high',
    data
  }),

  createOrderNotification: (type: 'allocated' | 'dispatched' | 'delivered', data: {
    orderId: string
    customerName: string
    quantity: number
    batchNumbers?: string[]
  }): NotificationEvent => {
    const templates = {
      allocated: {
        type: NotificationTypes.ORDER_ALLOCATED,
        title: `Order Allocated - ${data.orderId}`,
        message: `Order for ${data.customerName} (${data.quantity}m) has been allocated${data.batchNumbers ? ` from batches: ${data.batchNumbers.join(', ')}` : ''}`,
        priority: 'normal' as const
      },
      dispatched: {
        type: NotificationTypes.ORDER_DISPATCHED,
        title: `Order Dispatched - ${data.orderId}`,
        message: `Order for ${data.customerName} (${data.quantity}m) has been dispatched`,
        priority: 'normal' as const
      },
      delivered: {
        type: NotificationTypes.ORDER_DELIVERED,
        title: `Order Delivered - ${data.orderId}`,
        message: `Order for ${data.customerName} (${data.quantity}m) has been delivered successfully`,
        priority: 'normal' as const
      }
    }
    
    return {
      ...templates[type],
      data
    }
  }
}

export default notificationUtils 
import { NextApiRequest, NextApiResponse } from 'next'
import emailService from '@/lib/email/emailService'
import notificationUtils from '@/lib/utils/notificationUtils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, type = 'connection' } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email address is required' })
    }

    let result = false

    switch (type) {
      case 'connection':
        // Test email service connection
        result = await emailService.testConnection()
        if (result) {
          result = await emailService.sendTestEmail(email)
        }
        break

      case 'notification':
        // Test notification system with a sample notification
        try {
          await notificationUtils.sendNotification({
            type: 'system_test',
            title: 'System Test Notification',
            message: 'This is a test notification to verify the email notification system is working correctly.',
            priority: 'normal',
            recipients: [email]
          })
          
          // Process the notification immediately
          const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/notifications/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ limit: 10 })
          })
          
          const processResult = await response.json()
          result = processResult.successful > 0
        } catch (error) {
          console.error('Notification test failed:', error)
          result = false
        }
        break

      case 'production':
        // Test production notification
        try {
          const productionNotification = notificationUtils.createProductionNotification('completed', {
            batchNumber: 'TEST-BATCH-001',
            productionType: 'coating',
            quantity: 150,
            wastagePercentage: 3.2
          })

          await notificationUtils.sendNotification({
            ...productionNotification,
            recipients: [email]
          })

          // Process the notification
          const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/notifications/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ limit: 10 })
          })
          
          const processResult = await response.json()
          result = processResult.successful > 0
        } catch (error) {
          console.error('Production notification test failed:', error)
          result = false
        }
        break

      case 'order':
        // Test order notification
        try {
          const orderNotification = notificationUtils.createOrderNotification('dispatched', {
            orderId: 'ORD-TEST-001',
            customerName: 'Test Customer Ltd',
            quantity: 200,
            batchNumbers: ['BATCH-001', 'BATCH-002']
          })

          await notificationUtils.sendNotification({
            ...orderNotification,
            recipients: [email]
          })

          // Process the notification
          const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/notifications/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ limit: 10 })
          })
          
          const processResult = await response.json()
          result = processResult.successful > 0
        } catch (error) {
          console.error('Order notification test failed:', error)
          result = false
        }
        break

      case 'wastage':
        // Test wastage alert
        try {
          const wastageAlert = notificationUtils.createWastageAlert({
            batchNumber: 'TEST-BATCH-002',
            wastagePercentage: 8.5,
            threshold: 5.0
          })

          await notificationUtils.sendNotification({
            ...wastageAlert,
            recipients: [email]
          })

          // Process the notification
          const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/notifications/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ limit: 10 })
          })
          
          const processResult = await response.json()
          result = processResult.successful > 0
        } catch (error) {
          console.error('Wastage notification test failed:', error)
          result = false
        }
        break

      default:
        return res.status(400).json({ error: 'Invalid test type' })
    }

    if (result) {
      res.status(200).json({
        success: true,
        message: `${type} test email sent successfully to ${email}`,
        type
      })
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to send ${type} test email`,
        type
      })
    }

  } catch (error) {
    console.error('Error sending test notification:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 
import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'
import emailService from '@/lib/email/emailService'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { limit = 50 } = req.body

    // Get pending notifications from queue
    const { data: notifications, error } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false }) // Process urgent first (urgent > high > normal > low)
      .order('created_at', { ascending: true }) // Then oldest first
      .limit(limit)

    if (error) {
      throw new Error(`Failed to get notification queue: ${error.message}`)
    }

    if (!notifications || notifications.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'No pending notifications to process',
        processed: 0 
      })
    }

    let processedCount = 0
    let successCount = 0
    let failedCount = 0

    // Process each notification
    for (const notification of notifications) {
      try {
        processedCount++
        let success = false

        // Process email notifications
        if (notification.channels && notification.channels.includes('email')) {
          const emailHTML = emailService.createNotificationEmailHTML(
            notification.title,
            notification.message,
            notification.priority,
            notification.data ? JSON.parse(notification.data || '{}') : undefined
          )

          success = await emailService.sendEmail({
            to: notification.recipient_email,
            subject: notification.title,
            html: emailHTML
          })
        }

        // Update notification status
        const updateData = {
          status: success ? 'sent' : 'failed',
          sent_at: success ? new Date().toISOString() : null
        }

        const { error: updateError } = await supabase
          .from('notification_queue')
          .update(updateData)
          .eq('id', notification.id)

        if (updateError) {
          console.error(`Failed to update notification ${notification.id}:`, updateError)
        }

        if (success) {
          successCount++
        } else {
          failedCount++
        }

      } catch (error) {
        console.error(`Failed to process notification ${notification.id}:`, error)
        failedCount++

        // Mark as failed
        await supabase
          .from('notification_queue')
          .update({ status: 'failed' })
          .eq('id', notification.id)
      }
    }

    res.status(200).json({
      success: true,
      message: `Processed ${processedCount} notifications`,
      processed: processedCount,
      successful: successCount,
      failed: failedCount
    })

  } catch (error) {
    console.error('Error processing notification queue:', error)
    res.status(500).json({ 
      error: 'Failed to process notification queue',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 
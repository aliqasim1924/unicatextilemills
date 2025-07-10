import nodemailer from 'nodemailer'

export interface EmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  attachments?: Array<{
    filename: string
    content?: Buffer | string
    path?: string
    cid?: string
  }>
}

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth?: {
    user: string
    pass: string
  }
  from: string
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private config: EmailConfig

  constructor() {
    this.config = this.getEmailConfig()
    this.initializeTransporter()
  }

  private getEmailConfig(): EmailConfig {
    // Get configuration from environment variables
    const host = process.env.SMTP_HOST || 'smtp.gmail.com'
    const port = parseInt(process.env.SMTP_PORT || '587')
    const secure = process.env.SMTP_SECURE === 'true'
    const user = process.env.SMTP_USER || ''
    const pass = process.env.SMTP_PASS || ''
    const from = process.env.SMTP_FROM || 'noreply@unicatextiles.com'

    return {
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      from
    }
  }

  private async initializeTransporter(): Promise<void> {
    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
        tls: {
          rejectUnauthorized: false // For development - set to true in production
        }
      })

      // Verify connection configuration
      if (this.config.auth && this.transporter) {
        await this.transporter.verify()
        console.log('Email service initialized successfully')
      } else {
        console.warn('Email service initialized without authentication - emails will not be sent')
      }
    } catch (error) {
      console.error('Failed to initialize email service:', error)
      this.transporter = null
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      console.error('Email transporter not initialized')
      return false
    }

    if (!this.config.auth) {
      console.warn('Email authentication not configured - skipping email send')
      return false
    }

    try {
      const mailOptions = {
        from: this.config.from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text,
        attachments: options.attachments
      }

      const result = await this.transporter.sendMail(mailOptions)
      console.log('Email sent successfully:', result.messageId)
      return true
    } catch (error) {
      console.error('Failed to send email:', error)
      return false
    }
  }

  // Create HTML email template for notifications
  createNotificationEmailHTML(title: string, message: string, priority: string, additionalData?: Record<string, unknown>): string {
    const priorityColors = {
      low: '#10B981',
      normal: '#3B82F6',
      high: '#F59E0B',
      urgent: '#EF4444'
    }

    const priorityColor = priorityColors[priority as keyof typeof priorityColors] || priorityColors.normal

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: ${priorityColor};
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 0 0 8px 8px;
            border: 1px solid #e0e0e0;
          }
          .priority-badge {
            background-color: ${priorityColor};
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            display: inline-block;
            margin-bottom: 15px;
          }
          .message {
            background-color: white;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid ${priorityColor};
            margin: 15px 0;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
          }
          .data-section {
            background-color: white;
            padding: 15px;
            border-radius: 6px;
            margin-top: 15px;
          }
          .data-item {
            margin: 8px 0;
            padding: 8px;
            background-color: #f8f9fa;
            border-radius: 4px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Unica Textiles</div>
          <h1 style="margin: 0;">${title}</h1>
        </div>
        
        <div class="content">
          <span class="priority-badge">${priority.toUpperCase()} Priority</span>
          
          <div class="message">
            <p>${message}</p>
          </div>
          
          ${additionalData ? `
            <div class="data-section">
              <h3 style="margin-top: 0; color: ${priorityColor};">Additional Information:</h3>
              ${Object.entries(additionalData).map(([key, value]) => `
                <div class="data-item">
                  <strong>${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong> ${value}
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          <div class="footer">
            <p>This is an automated notification from Unica Textiles Stock Management System.</p>
            <p>Please do not reply to this email. For support, contact your system administrator.</p>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  // Test email connectivity
  async testConnection(): Promise<boolean> {
    try {
      if (!this.transporter || !this.config.auth) {
        return false
      }
      await this.transporter.verify()
      return true
    } catch (error) {
      console.error('Email connection test failed:', error)
      return false
    }
  }

  // Send test email
  async sendTestEmail(to: string): Promise<boolean> {
    const testOptions: EmailOptions = {
      to: to,
      subject: 'Unica Textiles - Email Service Test',
      html: this.createNotificationEmailHTML(
        'Email Service Test',
        'This is a test email to verify that the email notification system is working correctly.',
        'normal',
        {
          testTime: new Date().toISOString(),
          service: 'Email Notification System',
          status: 'Active'
        }
      )
    }

    return await this.sendEmail(testOptions)
  }
}

// Create singleton instance
const emailService = new EmailService()

export default emailService
export { EmailService } 
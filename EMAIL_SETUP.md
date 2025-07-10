# Email Notification Setup Guide

## Overview
The Unica Textiles Stock Management system includes a comprehensive email notification system that sends automated alerts for various business events such as low stock, production updates, order status changes, and system alerts.

## Required Environment Variables

Add the following environment variables to your `.env.local` file:

### SMTP Configuration
Choose one of the following SMTP configurations based on your email provider:

#### Option 1: Gmail (Recommended for Development)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Unica Textiles System <your-email@gmail.com>"
```

**Important for Gmail:**
- You must use an App Password, not your regular password
- Enable 2-Factor Authentication on your Gmail account
- Generate an App Password: Google Account > Security > 2-Step Verification > App passwords

#### Option 2: Outlook/Microsoft 365
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
SMTP_FROM="Unica Textiles System <your-email@outlook.com>"
```

#### Option 3: Custom SMTP Server
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-username
SMTP_PASS=your-password
SMTP_FROM="Unica Textiles System <noreply@yourdomain.com>"
```

### Notification Recipients
Configure different email addresses for different types of notifications:

```env
NOTIFICATION_RECIPIENTS_MANAGEMENT=manager@unicatextiles.com,director@unicatextiles.com
NOTIFICATION_RECIPIENTS_PRODUCTION=production@unicatextiles.com,supervisor@unicatextiles.com
NOTIFICATION_RECIPIENTS_SALES=sales@unicatextiles.com,customer.service@unicatextiles.com
NOTIFICATION_RECIPIENTS_WAREHOUSE=warehouse@unicatextiles.com,logistics@unicatextiles.com
```

## Testing Email Configuration

1. **Test Email Service**
   Navigate to any page in the application and open the browser console. The email service initialization status will be logged.

2. **Use the Notification Test Panel**
   The system includes a notification test panel accessible from the dashboard. It allows you to test different notification types.

3. **API Endpoint Testing**
   You can test the email service using the API endpoint:
   ```bash
   POST /api/notifications/test
   Content-Type: application/json
   
   {
     "type": "test",
     "recipient": "test@example.com"
   }
   ```

## Notification Types

The system sends notifications for the following events:

### 1. Stock Alerts
- **Low Stock**: When inventory falls below minimum levels
- **Stock Received**: When new stock is added
- **Stock Issued**: When stock is allocated to orders

### 2. Order Notifications
- **New Order**: When a customer order is created
- **Order Confirmed**: When an order is confirmed
- **Order Status Changes**: When order status is updated
- **Order Completed**: When an order is delivered

### 3. Production Alerts
- **Production Started**: When production begins
- **Production Completed**: When production is finished
- **Production Delays**: When production is behind schedule
- **Quality Issues**: When quality checks fail

### 4. System Alerts
- **System Errors**: Critical system errors
- **Data Backup**: Backup completion notifications
- **Security Alerts**: Authentication or security issues

## Email Templates

The system uses HTML email templates with the following features:
- Professional styling consistent with the application
- Priority-based color coding (High, Normal, Low)
- Company branding and contact information
- Mobile-responsive design

## Troubleshooting

### Common Issues

1. **Email Not Sending**
   - Check SMTP credentials
   - Verify firewall settings
   - Ensure port 587 is not blocked
   - Check spam/junk folders

2. **Gmail Authentication Errors**
   - Use App Password instead of regular password
   - Enable 2-Factor Authentication
   - Check "Less secure app access" (if not using App Password)

3. **Outlook Authentication Errors**
   - Ensure account has SMTP enabled
   - Check for modern authentication requirements
   - Verify account is not locked

### Debug Mode
Enable debug logging by setting:
```env
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true
```

## Production Deployment

For production deployment:

1. **Use Secure SMTP**
   Set `SMTP_SECURE=true` for port 465 (SSL)
   
2. **Configure Proper From Address**
   Use your domain's email address for the SMTP_FROM field
   
3. **Set Up SPF/DKIM Records**
   Configure DNS records to prevent emails from being marked as spam
   
4. **Monitor Email Delivery**
   Set up monitoring to track email delivery success/failure rates

## Security Considerations

1. **Environment Variables**
   - Never commit SMTP credentials to version control
   - Use secure environment variable management in production
   
2. **Email Content**
   - Sanitize all dynamic content in emails
   - Avoid including sensitive information in email subjects
   
3. **Rate Limiting**
   - The system includes built-in rate limiting for notifications
   - Configure appropriate limits for your email provider

## Support

For additional support with email configuration:
- Check the application logs for detailed error messages
- Verify network connectivity to SMTP servers
- Test SMTP configuration using external tools like telnet
- Contact your email provider for specific SMTP requirements

---

**Note:** This email system is designed for business notifications. For high-volume marketing emails, consider using dedicated email services like SendGrid, Mailgun, or Amazon SES. 
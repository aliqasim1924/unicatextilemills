// Application Configuration
export const config = {
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Unica Textiles Stock Management',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://unicatextilemills.netlify.app',
    description: 'Professional textile stock management system',
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },
  qr: {
    baseUrl: process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://unicatextilemills.netlify.app',
  },
  pdf: {
    apiUrl: process.env.NEXT_PUBLIC_PDF_API_URL || '/api/pdf',
  },
  features: {
    realTimeUpdates: true,
    qrCodeGeneration: true,
    pdfGeneration: true,
    auditTrail: true,
  },
  ui: {
    theme: 'light',
    primaryColor: 'blue',
    itemsPerPage: 10,
  },
  business: {
    companyName: 'Unica Textile Mills',
    address: 'Industrial Estate, Textile City',
    phone: '+1 (555) 123-4567',
    email: 'info@unicatextiles.com',
  },
  security: {
    pinRequired: true,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
  },
}

export default config

// Validate required environment variables
export function validateConfig() {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]

  const missing = requiredVars.filter(
    (varName) => !process.env[varName]
  )

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env.local file.'
    )
  }
} 
import fs from 'fs'
import path from 'path'

// Convert logo to base64 for reliable PDF generation
export const getLogoBase64 = (): string => {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'Logo.png')
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath)
      return `data:image/png;base64,${logoBuffer.toString('base64')}`
    }
  } catch (error) {
    console.warn('Could not load logo for PDF:', error)
  }
  
  // Fallback: return empty string if logo can't be loaded
  return ''
}

// Alternative: Small inline SVG logo as fallback
export const getFallbackLogoSvg = (): string => {
  return `data:image/svg+xml;base64,${Buffer.from(`
    <svg width="120" height="60" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="60" fill="#2563eb" rx="8"/>
      <text x="60" y="20" text-anchor="middle" fill="white" font-family="Arial" font-size="10" font-weight="bold">UNICA</text>
      <text x="60" y="35" text-anchor="middle" fill="white" font-family="Arial" font-size="10" font-weight="bold">TEXTILE</text>
      <text x="60" y="50" text-anchor="middle" fill="white" font-family="Arial" font-size="10" font-weight="bold">MILLS</text>
    </svg>
  `).toString('base64')}`
} 
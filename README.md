# Unica Textiles Stock Management System

A comprehensive textile stock management system built with Next.js, TypeScript, Supabase, and Tailwind CSS.

## 🚀 Features

- **Stock Management**: Track base and finished fabric inventory
- **Customer Management**: Manage customer profiles and orders
- **Order Processing**: Handle customer orders with automatic allocation
- **Production Management**: Plan and track weaving/coating production
- **QR Code System**: Generate and track fabric rolls with QR codes
- **Shipment Tracking**: Monitor rolls sent to customers
- **PDF Generation**: Professional documents for orders and reports
- **Real-time Updates**: Live data synchronization with Supabase
- **Audit Trail**: Complete business event logging

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Heroicons
- **Database**: Supabase (PostgreSQL)
- **PDF Generation**: React-PDF, Puppeteer, jsPDF
- **QR Codes**: QR code generation and scanning
- **Deployment**: AWS (via GitHub Actions)

## 📋 Prerequisites

- Node.js 18.17 or later
- npm or yarn
- Supabase account and project

## 🔧 Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/textiles-stock-management.git
cd textiles-stock-management
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Update your `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

5. Run the database migrations:
   - Copy the SQL from `DATABASE_MIGRATIONS.sql` and run in Supabase SQL Editor
   - Copy the SQL from `SHIPMENT_MIGRATIONS.sql` and run in Supabase SQL Editor

6. Start the development server:
```bash
npm run dev
```

## 🗄️ Database Setup

The application uses Supabase as the backend. Run the following SQL migrations in your Supabase SQL Editor:

1. **Core Tables**: Run `DATABASE_MIGRATIONS.sql`
2. **Shipment Tracking**: Run `SHIPMENT_MIGRATIONS.sql`

## 🔄 QR Code System

The QR code system works as follows:

1. **Generation**: QR codes are automatically generated when production orders are completed
2. **Scanning**: QR codes can be scanned with any phone camera
3. **Downloads**: Scanning opens a PDF or text file with roll details
4. **Lifecycle**: QR codes are hidden from the main page once rolls are shipped
5. **Tracking**: Shipped rolls can be viewed in the Shipments section

## 🚢 Shipment Tracking

The shipment tracking system:

- Automatically removes QR codes from active view when rolls are shipped
- Groups shipments by customer orders
- Provides expandable views of shipped rolls
- Maintains QR code functionality for shipped items
- Tracks delivery status and history

## 📦 Deployment

### AWS Deployment via GitHub

1. Push your code to GitHub
2. Set up AWS credentials in GitHub Secrets
3. Configure your production environment variables
4. Deploy using GitHub Actions

### Environment Variables for Production

Set these in your production environment:

```
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_supabase_anon_key
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
NEXT_PUBLIC_QR_BASE_URL=https://your-production-domain.com
```

## 🔐 Security

- Row Level Security (RLS) enabled on all tables
- PIN-based authorization for critical operations
- Secure environment variable handling
- Audit trail for all business operations

## 📊 Features Overview

### Core Modules
- **Dashboard**: Key metrics and quick actions
- **Orders**: Customer order management
- **Customers**: Customer database
- **Fabrics**: Product catalog
- **Stock**: Inventory management
- **Production**: Manufacturing workflow
- **QR Codes**: Active roll tracking
- **Shipments**: Delivery tracking

### Advanced Features
- **Real-time Updates**: Live data synchronization
- **PDF Generation**: Professional documents
- **QR Code Integration**: Mobile-friendly scanning
- **Audit Trail**: Complete operation logging
- **Responsive Design**: Mobile and desktop optimized

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please contact the development team or create an issue in the GitHub repository.

---

Built with ❤️ for Unica Textile Mills

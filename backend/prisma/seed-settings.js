const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const DEFAULT_SETTINGS = [
  // Tax Settings
  {
    key: 'tax_enabled',
    value: 'true',
    category: 'tax',
    type: 'boolean',
    label: 'Enable Tax Calculation',
    description: 'Whether to calculate and display taxes on sales',
  },
  {
    key: 'tax_default_rate',
    value: '8.5',
    category: 'tax',
    type: 'number',
    label: 'Default Tax Rate (%)',
    description: 'Global tax rate applied to sales (0-100)',
  },
  {
    key: 'tax_name',
    value: 'Sales Tax',
    category: 'tax',
    type: 'string',
    label: 'Tax Name',
    description: 'Name displayed on receipts (e.g., Sales Tax, VAT)',
  },
  // Store Settings
  {
    key: 'store_name',
    value: 'Aether POS Store',
    category: 'store',
    type: 'string',
    label: 'Store Name',
    description: 'Your business/store name',
  },
  {
    key: 'store_address',
    value: '',
    category: 'store',
    type: 'string',
    label: 'Store Address',
    description: 'Complete address for receipts',
  },
  {
    key: 'store_phone',
    value: '',
    category: 'store',
    type: 'string',
    label: 'Store Phone',
    description: 'Customer service phone number',
  },
  {
    key: 'store_email',
    value: '',
    category: 'store',
    type: 'string',
    label: 'Store Email',
    description: 'Customer service email address',
  },
  {
    key: 'store_website',
    value: '',
    category: 'store',
    type: 'string',
    label: 'Store Website',
    description: 'Your business website URL',
  },
  {
    key: 'business_registration',
    value: '',
    category: 'store',
    type: 'string',
    label: 'Business Registration Number',
    description: 'Tax ID, EIN, or registration number',
  },
  {
    key: 'store_logo_url',
    value: '',
    category: 'store',
    type: 'string',
    label: 'Store Logo URL',
    description: 'URL to logo image for receipts',
  },
  // Receipt Settings
  {
    key: 'receipt_header_text',
    value: 'THANK YOU FOR YOUR PURCHASE',
    category: 'receipt',
    type: 'string',
    label: 'Receipt Header Text',
    description: 'Text displayed at the top of receipts',
  },
  {
    key: 'receipt_footer_text',
    value: 'Come Again Soon!',
    category: 'receipt',
    type: 'string',
    label: 'Receipt Footer Text',
    description: 'Text displayed at the bottom of receipts',
  },
  {
    key: 'receipt_show_order_number',
    value: 'true',
    category: 'receipt',
    type: 'boolean',
    label: 'Show Order Number',
    description: 'Display order/transaction number on receipts',
  },
  {
    key: 'receipt_header_lines',
    value: '50',
    category: 'receipt',
    type: 'number',
    label: 'Receipt Width (characters)',
    description: 'Number of characters per line on thermal receipts',
  },
  // Payment Settings
  {
    key: 'default_payment_method',
    value: 'CASH',
    category: 'payment',
    type: 'string',
    label: 'Default Payment Method',
    description: 'Default payment method for new transactions',
  },
  {
    key: 'accepted_payment_methods',
    value: 'CASH,CARD,MOBILE_PAYMENT',
    category: 'payment',
    type: 'string',
    label: 'Accepted Payment Methods',
    description: 'Comma-separated list of accepted payment types',
  },
  {
    key: 'refund_days_allowed',
    value: '30',
    category: 'payment',
    type: 'number',
    label: 'Refund Period (days)',
    description: 'Number of days customers can request refunds',
  },
  // Inventory Settings
  {
    key: 'low_stock_threshold',
    value: '10',
    category: 'inventory',
    type: 'number',
    label: 'Low Stock Threshold',
    description: 'Quantity at which items are marked as low stock',
  },
  {
    key: 'auto_reorder_enabled',
    value: 'false',
    category: 'inventory',
    type: 'boolean',
    label: 'Enable Auto-Reorder',
    description: 'Automatically create purchase orders for low stock items',
  },
  {
    key: 'default_supplier_discount',
    value: '0',
    category: 'inventory',
    type: 'number',
    label: 'Default Supplier Discount (%)',
    description: 'Default discount percentage for supplier purchases',
  },
  // User/Employee Settings
  {
    key: 'default_user_role',
    value: 'CASHIER',
    category: 'user',
    type: 'string',
    label: 'Default User Role',
    description: 'Default role assigned to new employees',
  },
  {
    key: 'require_password_change_first_login',
    value: 'true',
    category: 'user',
    type: 'boolean',
    label: 'Require Password Change on First Login',
    description: 'Force new users to change password on first login',
  },
  {
    key: 'session_timeout_minutes',
    value: '30',
    category: 'user',
    type: 'number',
    label: 'Session Timeout (minutes)',
    description: 'Minutes before automatic logout due to inactivity',
  },
  // System Settings
  {
    key: 'currency',
    value: 'USD',
    category: 'system',
    type: 'string',
    label: 'Currency',
    description: 'Default currency code (USD, EUR, GBP, etc.)',
  },
  {
    key: 'timezone',
    value: 'UTC',
    category: 'system',
    type: 'string',
    label: 'Timezone',
    description: 'Business timezone (e.g., America/New_York)',
  },
  {
    key: 'date_format',
    value: 'MM/DD/YYYY',
    category: 'system',
    type: 'string',
    label: 'Date Format',
    description: 'Format for displaying dates',
  },
  {
    key: 'time_format',
    value: '12h',
    category: 'system',
    type: 'string',
    label: 'Time Format',
    description: '12h or 24h format',
  },
  {
    key: 'language',
    value: 'en',
    category: 'system',
    type: 'string',
    label: 'Language',
    description: 'System language (en, es, fr, etc.)',
  },
  {
    key: 'backup_frequency',
    value: 'daily',
    category: 'system',
    type: 'string',
    label: 'Backup Frequency',
    description: 'How often to create backups (hourly, daily, weekly)',
  },
]

const DEFAULT_TAX_RATES = [
  {
    name: 'Sales Tax - Standard',
    rate: 8.5,
    location: null,
    description: 'Standard sales tax rate',
    isActive: true,
    isDefault: true,
  },
  {
    name: 'Sales Tax - Reduced',
    rate: 5.0,
    location: null,
    description: 'Reduced rate for specific items',
    isActive: true,
    isDefault: false,
  },
]

async function main() {
  console.log('Seeding default settings...')

  // Create default settings
  for (const setting of DEFAULT_SETTINGS) {
    await prisma.settings.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    })
  }

  console.log(`✓ Created ${DEFAULT_SETTINGS.length} default settings`)

  // Create default tax rates
  for (const rate of DEFAULT_TAX_RATES) {
    await prisma.taxRate.upsert({
      where: { name: rate.name },
      update: {},
      create: rate,
    })
  }

  console.log(`✓ Created ${DEFAULT_TAX_RATES.length} default tax rates`)
  console.log('✓ Settings seed complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

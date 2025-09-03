# 🚀 Medius — Full-Stack Escrow & Marketplace Platform

## 📋 Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Payment Systems](#payment-systems)
- [Authentication & Security](#authentication--security)
- [Frontend Features](#frontend-features)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## 🎯 Overview

**Medius** is a comprehensive full-stack escrow and marketplace platform designed for secure peer-to-peer transactions. Built with modern web technologies, it provides a complete solution for buying/selling digital goods with built-in escrow protection, multi-currency payments, and comprehensive moderation systems.

### Key Features
- ✅ **Secure Escrow System**: Automated escrow management with dispute resolution
- ✅ **Multi-Currency Payments**: PayPal integration + 50+ cryptocurrencies via Tatum
- ✅ **Dynamic Delivery System**: Seller-configurable webhooks triggered on escrow funding
- ✅ **Tiered Pricing Rules**: Flexible fee structures with method and currency overrides
- ✅ **Per-Currency Fee Overrides**: Fixed USD or percentage fees per cryptocurrency
- ✅ **Real-time Messaging**: Pre-escrow chat system between buyers and sellers
- ✅ **Content Moderation**: AI-powered text and image moderation using OpenAI
- ✅ **Admin Dashboard**: Complete administrative control and monitoring
- ✅ **Referral System**: Built-in affiliate program with automatic payouts
- ✅ **Responsive Design**: Mobile-first UI with dark theme
- ✅ **Real-time Notifications**: Live updates for all user actions

### Use Cases
- Digital marketplace for software, art, music, courses
- Freelance service escrow
- NFT marketplace with escrow
- Any peer-to-peer transaction requiring trust


---

## 🏗️ Architecture

### System Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Next.js)     │◄──►│   (Flask)       │◄──►│   (Supabase)    │
│                 │    │                 │    │                 │
│ • React SPA     │    │ • REST API      │    │ • PostgreSQL    │
│ • SSR Pages     │    │ • JWT Auth      │    │ • RLS Policies  │
│ • Real-time     │    │ • Webhooks      │    │ • Realtime subs │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                   ┌─────────────────┐    ┌─────────────────┐
                   │ Payment Gateways│    │   External APIs │
                   │                 │    │                 │
                   │ • PayPal        │    │ • Tatum Crypto  │
                   │ • Tatum Crypto  │    │ • OpenAI Mod.   │
                   │ • Webhooks      │    │ • Email Service │
                   └─────────────────┘    └─────────────────┘
```

### Data Flow
1. **User Registration**: Supabase Auth → Profile creation → Database
2. **Listing Creation**: Upload images → AI moderation → Database storage
3. **Purchase Flow**: Cart → Payment auth → Escrow creation → Funds held
4. **Escrow Release**: Buyer confirms → Funds released → Seller payout
5. **Dispute Resolution**: Admin review → Manual resolution → Funds distributed

---

## 🛠️ Tech Stack

### Backend
- **Framework**: Flask 3.0+ with Flask-CORS, Flask-Limiter
- **Database**: Supabase (PostgreSQL with RLS)
- **Authentication**: Supabase Auth with JWT tokens
- **Payments**: Tatum API for crypto, PayPal REST API
- **Moderation**: OpenAI API for content moderation
- **File Storage**: Supabase Storage for images
- **Real-time**: Supabase Realtime for messaging
- **Rate Limiting**: Flask-Limiter with Redis backend

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom components
- **State Management**: React hooks + Context API
- **Forms**: React Hook Form with validation
- **Icons**: Lucide React
- **Charts**: Recharts for admin dashboard
- **Real-time**: Supabase Realtime subscriptions

### DevOps & Tools
- **Version Control**: Git with conventional commits
- **Package Manager**: npm for frontend, pip for backend
- **Environment**: dotenv for configuration
- **Testing**: Jest + React Testing Library (planned)
- **Linting**: ESLint + Prettier
- **Deployment**: Netlify (frontend), Railway/Heroku (backend)


---

## 📁 Project Structure

```
medius/
├── backend/                          # Flask API backend
│   ├── app.py                       # Main Flask application
│   ├── requirements.txt             # Python dependencies
│   ├── env-example.txt              # Environment template
│   ├── __pycache__/                 # Python cache (gitignored)
│   ├── check_end.py                 # Escrow finalization logic
│   ├── debug_server.py             # Development server with hot reload
│   ├── derive.py                    # Cryptocurrency derivation utilities
│   ├── test_import.py               # Import testing script
│   └── test_connection.py           # Database connection testing
├── frontend/                        # Next.js frontend application
│   ├── app/                         # Next.js App Router pages
│   │   ├── admin/                   # Admin dashboard pages
│   │   │   ├── page.tsx            # Admin overview
│   │   │   ├── users/              # User management
│   │   │   ├── escrows/            # Escrow management
│   │   │   ├── reports/            # Report management
│   │   │   └── referrals/          # Referral system
│   │   ├── auth/                   # Authentication pages
│   │   │   ├── page.tsx            # Login page
│   │   │   └── callback/           # OAuth callback
│   │   ├── marketplace/            # Marketplace pages
│   │   │   ├── page.tsx            # Marketplace listing
│   │   │   ├── create/             # Create listing
│   │   │   └── [id]/               # Individual listing
│   │   ├── cart/                   # Shopping cart
│   │   ├── messages/               # Messaging system
│   │   ├── profile/                # User profile
│   │   ├── referrals/              # Referral dashboard
│   │   └── escrow/[id]/            # Escrow details
│   ├── components/                 # Reusable React components
│   │   ├── ui/                     # Base UI components
│   │   ├── AuthForm.tsx            # Authentication form
│   │   ├── EscrowChat.tsx          # Chat component
│   │   ├── HotProducts.tsx         # Featured products carousel
│   │   └── Navbar.tsx              # Navigation component
│   ├── lib/                        # Utility libraries
│   │   ├── api.ts                  # API client functions
│   │   ├── supabase.ts             # Supabase client
│   │   └── types.ts                # TypeScript type definitions
│   ├── package.json                # Node dependencies
│   ├── next.config.ts              # Next.js configuration
│   └── tailwind.config.js          # Tailwind configuration
├── schema.sql                      # Database schema (idempotent)
├── MARKETPLACE_README.md           # Detailed marketplace specification
├── AUTHORIZATION_FIX_README.md     # Authorization system details
├── package.json                    # Root package.json for monorepo
├── requirements.txt                # Root Python dependencies
└── README.md                       # This file
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase account
- PayPal Business account (optional)
- Tatum API key (optional)

### 1. Clone & Setup
```bash
git clone <repository-url>
cd medius
```

### 2. Supabase Setup
1. Create new Supabase project
2. Copy database URL, anon key, and service role key
3. Run schema.sql in Supabase SQL editor

### 3. Backend Setup
```bash
cd backend
pip install -r requirements.txt
cp env-example.txt .env
# Edit .env with your values
python app.py
```

### 4. Frontend Setup
```bash
cd frontend
npm install
cp env-example.txt .env.local
# Edit .env.local with your values
npm run dev
```

### 5. Access Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Admin: http://localhost:3000/admin

---

## ⚙️ Detailed Setup

### Supabase Configuration

1. **Create Project**
   - Go to supabase.com and create new project
   - Choose your region and database password

2. **Get API Keys**
   - Project Settings → API
   - Copy: Project URL, Anon Key, Service Role Key, JWT Secret

3. **Database Setup**
   - Go to SQL Editor
   - Run the contents of `schema.sql`
   - Verify tables are created: `profiles`, `escrows`, `listings`, etc.

4. **Storage Setup**
   - Storage → Create bucket named `listing-images`
   - Set bucket to public
   - Configure RLS policies for image access

### Backend Configuration

1. **Install Dependencies**
```bash
cd backend
pip install -r requirements.txt
```

2. **Environment Setup**
```bash
cp env-example.txt .env
# Edit .env with your configuration
```

3. **Run Development Server**
```bash
python debug_server.py  # For hot reload
# OR
python app.py           # Production server
```

### Frontend Configuration

1. **Install Dependencies**
```bash
cd frontend
npm install
```

2. **Environment Setup**
```bash
cp env-example.txt .env.local
# Edit .env.local with your configuration
```

3. **Development Server**
```bash
npm run dev      # Development with hot reload
npm run build    # Production build
npm start        # Production server
```


---

## 🔧 Environment Variables

### Backend (Required)
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Application URLs
FRONTEND_URL=http://localhost:3000

# Security
ENCRYPTION_KEY=your-32-character-encryption-key
ADMIN_SERVICE_KEY=your-admin-service-key
```

### Backend (Payments - Optional)
```bash
# PayPal Configuration
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox  # or 'live'
PAYPAL_WEBHOOK_ID=your-webhook-id

# Crypto Configuration (Tatum)
TATUM_API_KEY=your-tatum-api-key

# Platform Wallets (for crypto escrow)
PLATFORM_BTC_ADDRESS=your-btc-address
PLATFORM_ETH_ADDRESS=your-eth-address
PLATFORM_USDT_ERC20_ADDRESS=your-usdt-address
PLATFORM_BNB_ADDRESS=your-bnb-address
```

### Backend (Moderation)
```bash
MODERATION_PROVIDER=openai
MODERATION_API_KEY=your-openai-api-key
MODERATION_THRESHOLDS={"text": 0.8, "image": 0.6}
```

### Backend (Optional Features)
```bash
# Referral System
REFERRAL_RATE=0.20
MIN_WITHDRAW_USD=5.0

# Rate Limiting (requests per hour)
RL_CART_LIST=1000
RL_CART_ADD=500
RL_CART_QTY=600
RL_CART_CHECKOUT=200

# Development
USE_NGROK=true
NGROK_AUTHTOKEN=your-ngrok-token
PORT=5000
FLASK_ENV=development

# Dynamic Delivery (Outbound Callbacks)
OUTBOUND_CALLBACK_TIMEOUT_MS=5000
OUTBOUND_CALLBACK_RETRY_MAX=3
OUTBOUND_CALLBACK_USER_AGENT=Medius/1.0
OUTBOUND_CALLBACK_BLOCK_PRIVATE=true
```

### Frontend
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```


---

## 📡 API Documentation

### Authentication
All API endpoints require Bearer token authentication:
```bash
Authorization: Bearer <supabase-jwt-token>
```

### Core Endpoints

#### Marketplace
```http
GET    /api/marketplace           # List marketplace items
GET    /api/marketplace/:id       # Get specific listing
POST   /api/marketplace           # Create listing
PATCH  /api/marketplace/:id       # Update listing
DELETE /api/marketplace/:id       # Delete listing
POST   /api/marketplace/:id/pause # Pause listing
POST   /api/marketplace/:id/resume # Resume listing
GET    /api/marketplace/hot-products # Get trending items
```

#### Cart Management
```http
GET    /api/cart                  # Get user's cart
POST   /api/cart                  # Add item to cart
POST   /api/cart/qty              # Update item quantity
DELETE /api/cart/:item_id         # Remove from cart
POST   /api/cart/checkout         # Create checkout session
```

#### Escrow System
```http
POST   /api/escrows               # Create escrow
GET    /api/escrows/:id           # Get escrow details
POST   /api/escrows/:id/seller-details # Add seller info
POST   /api/escrows/:id/check-payment # Check payment status
POST   /api/escrows/:id/confirm   # Confirm delivery & release
POST   /api/escrows/:id/refund    # Request refund
```

#### Messaging
```http
GET    /api/messages              # Get user conversations
POST   /api/messages/start        # Start conversation
GET    /api/messages/:id          # Get conversation messages
POST   /api/messages/:id          # Send message
```

#### User Management
```http
GET    /api/profile/me            # Get current user profile
PATCH  /api/profile/me            # Update profile
GET    /api/users/:username       # Get user profile
GET    /api/users/search          # Search users
```

#### Admin (Requires admin role)
```http
GET    /api/admin/overview        # Dashboard stats
GET    /api/admin/users           # User management
GET    /api/admin/escrows         # Escrow oversight
GET    /api/admin/reports         # Report management
POST   /api/admin/moderation/config # Update moderation settings
```

### Webhooks
```http
POST   /api/paypal/webhook        # PayPal webhook handler
POST   /api/dynamic-delivery/callback # Dynamic delivery webhook (internal)
```

### Dynamic Delivery Webhooks

#### Outbound Callbacks
The system automatically sends POST requests to seller-configured URLs when escrows are funded:

**Headers:**
```
Content-Type: application/json
User-Agent: Medius/1.0
X-Medius-Event: escrow.funded
X-Medius-Idempotency-Key: <uuid>
X-Medius-Timestamp: <epoch-ms>
```

**Retry Policy:**
- 3 retries with exponential backoff (1s, 2s, 4s)
- Idempotency keys prevent duplicate processing
- Automatic failure tracking and logging

**Security:**
- HTTPS-only URLs required
- Private IP addresses blocked (configurable)
- 5-second timeout per request


---

## 🗄️ Database Schema

### Core Tables

#### Users & Profiles
```sql
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  avatar_url TEXT,
  bio TEXT,
  rating DECIMAL(3,2),
  volume_usd DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

#### Marketplace
```sql
listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  price_usd DECIMAL(12,2) NOT NULL,
  accept_all BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',
  rating DECIMAL(3,2),
  seller_volume_usd DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id),
  url TEXT NOT NULL,
  alt_text TEXT,
  order_index INTEGER DEFAULT 0
)

listing_currencies (
  listing_id UUID REFERENCES listings(id),
  currency TEXT NOT NULL,
  network TEXT, -- For crypto (ERC20, BEP20, etc.)
  PRIMARY KEY (listing_id, currency, COALESCE(network, ''))
)
```

#### Escrow System
```sql
escrows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES profiles(id),
  seller_id UUID REFERENCES profiles(id),
  listing_id UUID REFERENCES listings(id),
  amount_usd DECIMAL(12,2) NOT NULL,
  amount_crypto DECIMAL(18,8),
  currency TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  paypal_order_id TEXT,
  crypto_tx_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

escrow_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID REFERENCES escrows(id),
  sender_id UUID REFERENCES profiles(id),
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  created_at TIMESTAMP DEFAULT NOW()
)
```

#### Cart & Checkout
```sql
cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  listing_id UUID REFERENCES listings(id),
  quantity INTEGER DEFAULT 1,
  selected_currency TEXT,
  created_at TIMESTAMP DEFAULT NOW()
)

checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  total_usd DECIMAL(12,2) NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  paypal_order_id TEXT,
  crypto_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
)
```

#### Messaging
```sql
conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES profiles(id),
  seller_id UUID REFERENCES profiles(id),
  listing_id UUID REFERENCES listings(id),
  created_at TIMESTAMP DEFAULT NOW()
)

conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  sender_id UUID REFERENCES profiles(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
)
```

### Row Level Security (RLS) Policies

All tables have comprehensive RLS policies ensuring:
- Users can only access their own data
- Sellers can manage their listings
- Buyers can view purchased items
- Admins have full access
- Public data (listings) is readable by all


---

## 💳 Payment Systems

### PayPal Integration

#### Flow
1. **Authorization**: Create PayPal order with item details
2. **Approval**: User approves payment on PayPal
3. **Capture**: Capture authorized payment (held in escrow)
4. **Release**: Release funds to seller on completion
5. **Refund**: Process refunds if needed

#### Webhook Events
- `PAYMENT.AUTHORIZATION.CREATED`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.REFUNDED`

### Crypto Integration (Tatum)

#### Supported Currencies
- Bitcoin (BTC)
- Ethereum (ETH)
- USDT (ERC20, BEP20)
- USDC (ERC20, BEP20)
- BNB (BEP20)
- And 50+ more cryptocurrencies

#### Flow
1. **Address Generation**: Generate unique escrow address per transaction
2. **Payment Monitoring**: Watch for incoming payments
3. **Confirmation**: Wait for required confirmations
4. **Distribution**: Release funds to seller on completion
5. **Refunds**: Return funds to buyer if needed

#### Platform Wallets
Each currency needs a platform wallet for escrow:
```bash
PLATFORM_BTC_ADDRESS=bc1q...
PLATFORM_ETH_ADDRESS=0x...
PLATFORM_USDT_ERC20_ADDRESS=0x...
```

### Dynamic Delivery System

#### Overview
The Dynamic Delivery system allows sellers to configure webhooks that are triggered when their escrows are funded, enabling automated product delivery and order fulfillment.

#### Features
- ✅ **Seller-Configured URLs**: Each listing can have a custom delivery webhook
- ✅ **Secure Callbacks**: HTTPS-only with configurable security options
- ✅ **Retry Logic**: Exponential backoff with up to 3 retries
- ✅ **Idempotency**: Prevents duplicate processing with unique keys
- ✅ **Comprehensive Payload**: Includes escrow, listing, buyer, and seller details

#### Webhook Payload
```json
{
  "event": "escrow.funded",
  "idempotency_key": "uuid-string",
  "escrow": {
    "id": "escrow-uuid",
    "status": "funded",
    "funded_at": "2025-09-03T12:34:56Z",
    "amount_usd": 49.99,
    "currency": "USDT-ERC20",
    "payment_method": "crypto"
  },
  "listing": {
    "id": "listing-uuid",
    "title": "My Product"
  },
  "buyer": {
    "id": "buyer-uuid",
    "username": "buyer123"
  },
  "seller": {
    "id": "seller-uuid",
    "username": "seller123"
  }
}
```

#### Configuration
```bash
# Outbound callback settings
OUTBOUND_CALLBACK_TIMEOUT_MS=5000
OUTBOUND_CALLBACK_RETRY_MAX=3
OUTBOUND_CALLBACK_USER_AGENT=Medius/1.0
OUTBOUND_CALLBACK_BLOCK_PRIVATE=true
```

### Tiered Pricing Rules

#### Overview
Flexible pricing system that supports both percentage and fixed USD fees with tiered structures based on transaction amounts.

#### Supported Structures

**Method-Based Tiers** (PayPal/Crypto):
```json
{
  "methods": {
    "paypal": {
      "tiers": [
        { "min_amount": 0, "percent": 2.0, "fixed_usd": 0 }
      ]
    },
    "crypto": {
      "tiers": [
        { "min_amount": 0, "max_amount": 50, "percent": 2.0, "fixed_usd": 0 },
        { "min_amount": 50, "percent": 1.5, "fixed_usd": 0 }
      ]
    }
  }
}
```

**Per-Currency Overrides** (Fixed USD):
```json
{
  "currencies": {
    "BTC": { "fixed_usd": 0.5 },
    "ETH": { "fixed_usd": 0.75 },
    "USDT-TRON": { "fixed_usd": 1.0 }
  }
}
```

#### Calculation Logic
```
Final Price = Base Price × (1 + Method Fee%) + Method Fixed + Currency Override
```

**Example:**
- Base Price: $49.99
- PayPal Fee: 2% = $1.00
- BTC Override: +$0.50 (fixed USD)
- **Total: $51.49**

#### Configuration
- **Method Fees**: Configured via `pricing_rules.methods` in listing creation
- **Currency Overrides**: Configurable per listing via UI
- **Fee Types**: Support both percentage and fixed USD amounts

### Content Moderation
- **Text**: OpenAI `/v1/moderations` (`omni-moderation-latest`)
- **Images**: OpenAI `/v1/responses` with image URL input and strict JSON parse
- **Configuration**: Provider/key/thresholds via env or `/api/admin/moderation/config`

---

## 🔐 Authentication & Security

### Authentication Flow
1. **Registration**: Email/password or OAuth via Supabase
2. **JWT Token**: Issued by Supabase, validated by backend
3. **Session Management**: Automatic token refresh
4. **Role-based Access**: User/Admin roles with different permissions

### Security Features
- **Row Level Security**: Database-level access control
- **Rate Limiting**: Configurable limits per endpoint
- **CORS Protection**: Restricted origins in production
- **Input Validation**: Comprehensive validation on all inputs
- **Content Moderation**: AI-powered content filtering
- **Audit Logging**: All admin actions logged
- **Encryption**: Sensitive data encrypted at rest

### Rate Limiting
```python
# Configurable per endpoint
RL_CART_LIST = "1000 per hour"
RL_CART_ADD = "500 per hour"
RL_CART_CHECKOUT = "200 per hour"
```


---

## 🎨 Frontend Features

### Pages & Routes

#### Public Pages
- `/` - Homepage with featured listings
- `/marketplace` - Marketplace with filters and search
- `/marketplace/[id]` - Individual listing details
- `/profiles/[username]` - User profiles

#### Authenticated Pages
- `/marketplace/create` - Create new listing
- `/cart` - Shopping cart
- `/messages` - Messaging inbox
- `/profile` - User profile management
- `/referrals` - Referral dashboard
- `/escrow/[id]` - Escrow details and chat

#### Admin Pages
- `/admin` - Admin dashboard
- `/admin/users` - User management
- `/admin/escrows` - Escrow oversight
- `/admin/reports` - Report management

### Key Components

#### UI Components
- **Navbar**: Navigation with cart badge and notifications
- **AuthForm**: Login/register with validation
- **MarketplaceFilters**: Advanced filtering system
- **HotProducts**: Featured products carousel
- **EscrowChat**: Real-time messaging
- **PaymentSelector**: PayPal vs Crypto selection
- **CryptoSelector**: Currency selection with networks

#### Features
- **Responsive Design**: Mobile-first approach
- **Dark Theme**: Consistent black/gold theme
- **Real-time Updates**: Live notifications and chat
- **Progressive Loading**: Optimized performance
- **Error Boundaries**: Graceful error handling
- **Accessibility**: WCAG compliant


---

## 🔄 Development Workflow

### Local Development
```bash
# Backend
cd backend
python debug_server.py  # Hot reload enabled

# Frontend (new terminal)
cd frontend
npm run dev

# Database changes
# Edit schema.sql, run in Supabase SQL editor
```

### Git Workflow
```bash
# Feature development
git checkout -b feature/new-feature
# Make changes
git commit -m "feat: add new feature"
git push origin feature/new-feature

# Hotfixes
git checkout -b hotfix/critical-fix
# Fix issue
git commit -m "fix: critical bug fix"
git push origin hotfix/critical-fix
```

### Code Quality
```bash
# Frontend
npm run lint      # ESLint check
npm run format    # Prettier formatting
npm run type-check # TypeScript validation

# Backend
# Python linting with flake8/black (configure as needed)
```

---

## 🧪 Testing

### Testing Strategy
- **Unit Tests**: Individual functions and components
- **Integration Tests**: API endpoints and database operations
- **E2E Tests**: Full user flows with Playwright
- **Performance Tests**: Load testing for critical endpoints

### Test Categories

#### Backend Tests
- API endpoint validation
- Database operations
- Payment integration
- Authentication flows
- Rate limiting
- Error handling

#### Frontend Tests
- Component rendering
- User interactions
- Form validation
- API integration
- Error states
- Accessibility

### Test Commands
```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- src/components/Button.test.tsx

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

---

## 🚀 Deployment

### Frontend Deployment (Netlify)

1. **Connect Repository**
   - Connect GitHub repository to Netlify
   - Set build command: `npm run build`
   - Set publish directory: `.next`

2. **Environment Variables**
   - Set all `NEXT_PUBLIC_*` variables in Netlify dashboard

3. **Build Settings**
   - Node version: 18+
   - Build command: `cd frontend && npm install && npm run build`
   - Publish directory: `frontend/.next`

### Backend Deployment (Railway/Heroku)

1. **Railway Deployment**
   ```bash
   # Connect GitHub repo
   # Set environment variables
   # Deploy automatically on push
   ```

2. **Heroku Deployment**
   ```bash
   heroku create medius-backend
   heroku config:set SUPABASE_URL=...
   git push heroku main
   ```

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates configured
- [ ] Domain DNS configured
- [ ] Monitoring and logging set up
- [ ] Backup strategy implemented
- [ ] Security headers configured

---

## 🔧 Troubleshooting

### Common Issues

#### Database Connection
```bash
# Check Supabase connection
python -c "import supabase; print('Connection OK')"

# Verify RLS policies
# Check Supabase dashboard → Authentication → Policies
```

#### Authentication Issues
```bash
# Check JWT token validity
# Verify SUPABASE_JWT_SECRET matches Supabase project
# Check CORS settings for frontend domain
```

#### Payment Issues
```bash
# PayPal webhook not working
# - Verify PAYPAL_WEBHOOK_ID is correct
# - Check webhook URL is accessible
# - Verify SSL certificate

# Crypto payments not processing
# - Check TATUM_API_KEY
# - Verify platform wallet addresses
# - Check Tatum dashboard for transaction status
```

#### Frontend Issues
```bash
# Build failing
npm run build  # Check for TypeScript errors

# API calls failing
# - Verify NEXT_PUBLIC_API_URL
# - Check CORS configuration
# - Verify backend is running
```

#### Performance Issues
```bash
# Slow API responses
# - Check database indexes
# - Review rate limiting settings
# - Monitor database query performance

# Frontend slow loading
# - Check bundle size: npm run analyze
# - Optimize images
# - Implement code splitting
```

### Debug Commands
```bash
# Backend debug
python debug_server.py  # Hot reload with detailed logging

# Frontend debug
npm run dev -- --inspect  # Enable Node.js inspector

# Database debug
# Use Supabase dashboard → SQL Editor for queries
# Check logs in Supabase dashboard → Logs
```

---

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/medius.git`
3. Create feature branch: `git checkout -b feature/amazing-feature`
4. Follow the development workflow above
5. Submit pull request with detailed description

### Code Standards
- **Python**: Follow PEP 8, use type hints
- **TypeScript**: Use strict mode, proper typing
- **React**: Functional components with hooks
- **Commits**: Conventional commits (`feat:`, `fix:`, `docs:`)
- **Documentation**: Update README for new features

### Pull Request Process
1. **Create PR**: Use descriptive title and detailed description
2. **Code Review**: Address review comments
3. **Testing**: Ensure all tests pass
4. **Merge**: Squash merge with conventional commit message

### Issue Reporting
- Use GitHub Issues for bugs and feature requests
- Include: Steps to reproduce, expected vs actual behavior, environment details
- For security issues: Email maintainers directly

---

## 📊 Monitoring & Analytics

### Application Monitoring
- **Error Tracking**: Sentry for error monitoring
- **Performance**: New Relic or DataDog for APM
- **Uptime**: UptimeRobot or Pingdom monitoring

### Business Analytics
- **User Behavior**: PostHog or Mixpanel
- **Revenue Tracking**: Stripe/PayPal webhooks
- **Conversion Funnels**: Custom analytics

### Database Monitoring
- **Query Performance**: Supabase dashboard
- **Storage Usage**: Monitor file uploads
- **RLS Policy Effectiveness**: Audit log analysis

---

## 🔄 Future Roadmap

### Phase 1 (Current)
- ✅ Basic marketplace functionality
- ✅ PayPal and crypto payments
- ✅ Escrow system
- ✅ Admin dashboard
- ✅ Content moderation

### Phase 2 (Next)
- 🔄 Mobile app (React Native)
- 🔄 Advanced analytics dashboard
- 🔄 Multi-language support
- 🔄 Advanced dispute resolution
- 🔄 API marketplace for developers

### Phase 3 (Future)
- 🔄 AI-powered matching
- 🔄 Decentralized escrow options
- 🔄 NFT marketplace integration
- 🔄 Advanced fraud detection
- 🔄 Enterprise features
---

## 📚 Function Documentation

### 🎨 Frontend Functions

#### Core Utility Functions

##### `apiRequest(url: string, options?: RequestInit): Promise<Response>`
**Location:** `frontend/lib/api.ts`
- **Purpose:** Makes API requests with automatic ngrok bypass headers
- **Parameters:**
  - `url`: The API endpoint URL
  - `options`: Optional RequestInit object
- **Features:**
  - Automatically converts `http://` to `https://` for ngrok URLs
  - Adds `ngrok-skip-browser-warning` header
  - Sets `User-Agent` header
  - Configures CORS credentials

##### `authApiRequest(url: string, session: any, options?: RequestInit): Promise<Response>`
**Location:** `frontend/lib/api.ts`
- **Purpose:** Makes authenticated API requests with JWT tokens
- **Parameters:**
  - `url`: The API endpoint URL
  - `session`: Supabase session object containing access token
  - `options`: Optional RequestInit object
- **Features:**
  - Validates session and access token
  - Adds `Authorization: Bearer <token>` header
  - Handles ngrok URL conversion
  - Throws error if no access token available

##### `handleApiError(response: Response): Promise<Response>`
**Location:** `frontend/lib/api.ts`
- **Purpose:** Processes API error responses with detailed error handling
- **Parameters:**
  - `response`: The Response object from fetch
- **Features:**
  - Parses JSON error responses
  - Extracts error messages, details, and troubleshooting info
  - Logs additional error context
  - Throws formatted error messages

##### `cn(...inputs: ClassValue[]): string`
**Location:** `frontend/lib/utils.ts`
- **Purpose:** Combines Tailwind CSS classes with clsx and tailwind-merge
- **Parameters:**
  - `inputs`: Array of class values (strings, booleans, undefined, null)
- **Features:**
  - Merges conflicting Tailwind classes
  - Filters out falsy values
  - Returns optimized class string

#### Authentication Components

##### `AuthForm`
**Location:** `frontend/components/AuthForm.tsx`
- **Purpose:** Handles user login and registration
- **State:**
  - `isLogin`: Toggle between login/register modes
  - `email`: User email input
  - `password`: User password input
  - `username`: Username for registration
  - `loading`: Loading state during auth
  - `error`: Error message display

**Functions:**
- **`handleAuth(e: React.FormEvent)`**: Processes login/registration
  - Validates inputs
  - Calls Supabase auth methods
  - Sanitizes username for registration
  - Creates user profile in database
  - Redirects to dashboard on success

- **`sanitizeUsername(value: string): string`**: Cleans username input
  - Converts to lowercase
  - Removes invalid characters
  - Ensures minimum length
  - Adds fallback for invalid usernames

#### Escrow Chat Functions

##### `EscrowChat`
**Location:** `frontend/components/EscrowChat.tsx`
- **Purpose:** Real-time messaging component for escrow transactions
- **State:**
  - `messages`: Array of chat messages
  - `newMessage`: Current message being typed
  - `sellerAddress`: Crypto payout address
  - `buyerAddress`: Refund address
  - `processingRefund`: Refund processing state

**Key Functions:**
- **`fetchMessages()`**: Loads chat history from database
- **`sendMessage(e: React.FormEvent)`**: Sends new message with optimistic UI
- **`addSystemMessage(text: string)`**: Adds system notification messages
- **`addSystemMessageOnce(key: string, text: string, meta?: any)`**: Adds unique system messages
- **`handleAddressSubmit()`**: Processes seller crypto address submission
- **`handleBuyerAddressSubmit()`**: Processes buyer refund address
- **`handleAmountConfirmation()`**: Confirms escrow amount by seller
- **`handleProcessRefund()`**: Initiates crypto refund process
- **`handlePaypalEmailSubmit()`**: Saves PayPal email for payouts
- **`displayName(name: string): string`**: Truncates long usernames
- **`formatTime(iso: string): string`**: Formats timestamps for display
- **`getSenderName(senderId: string): string`**: Gets display name for message sender
- **`getSenderAvatar(senderId: string)`**: Generates user avatar component

**Sub-components:**
- **`SystemBubble`**: Displays system messages with different severity levels
  - Error, warning, success, and info variants
  - Expandable details for debugging
  - Color-coded styling

#### UI Components

##### `Button`
**Location:** `frontend/components/ui/button.tsx`
- **Purpose:** Flexible button component with multiple variants
- **Variants:**
  - `default`: Primary button style
  - `destructive`: Red/delete button
  - `outline`: Outlined button
  - `secondary`: Secondary button
  - `ghost`: Transparent button
  - `link`: Link-style button
- **Sizes:** `sm`, `default`, `lg`, `icon`

##### `StatefulButton`
**Location:** `frontend/components/ui/stateful-button.tsx`
- **Purpose:** Button with loading states and success animations
- **States:**
  - `idle`: Default state
  - `enter`: Success animation entering
  - `preExit`: Preparing for exit animation
  - `exit`: Exit animation
  - `reset`: Reset to idle

**Animation Phases:**
- Loading spinner during async operations
- Success message slides up on completion
- Smooth transitions between states
- Automatic cleanup of timers

#### Supabase Integration

##### `supabase`
**Location:** `frontend/lib/supabase.ts`
- **Purpose:** Supabase client instance for database operations
- **Configuration:**
  - Uses environment variables for URL and anon key
  - Configured for real-time subscriptions
  - Handles authentication state

##### `isSupabaseConfigured(): boolean`
**Location:** `frontend/lib/supabase.ts`
- **Purpose:** Validates Supabase configuration
- **Returns:** `true` if both URL and anon key are configured

---

### 🔧 Backend Functions

#### Core Application Setup

##### Flask Application Configuration
**Location:** `backend/app.py`
- **CORS Configuration**: Handles cross-origin requests
- **Rate Limiting**: Flask-Limiter for API protection
- **Environment Variables**: Loads configuration from `.env`
- **Supabase Client**: Database and auth integration

#### Authentication & Authorization

##### `require_auth(f): decorator`
**Location:** `backend/app.py`
- **Purpose:** Validates JWT tokens for protected endpoints
- **Process:**
  - Extracts Authorization header
  - Decodes JWT token
  - Validates token expiration
  - Sets request.user_id

##### `require_admin(f): decorator`
**Location:** `backend/app.py`
- **Purpose:** Restricts access to admin-only endpoints
- **Process:** Checks user's admin role in database

##### `require_service_key(f): decorator`
**Location:** `backend/app.py`
- **Purpose:** Validates service key for internal operations
- **Use:** Admin operations and webhook endpoints

#### Marketplace Endpoints

##### `/api/marketplace` (GET)
**Location:** `backend/app.py`
- **Purpose:** Lists marketplace items with filtering
- **Parameters:**
  - `q`: Search query
  - `currency`: Filter by cryptocurrency
  - `payment_method`: Filter by payment type
  - `min_price`, `max_price`: Price range filters
  - `page`, `limit`: Pagination

##### `/api/marketplace/:id` (GET)
**Location:** `backend/app.py`
- **Purpose:** Retrieves individual listing details
- **Returns:** Complete listing data with images and metadata

##### `/api/marketplace` (POST)
**Location:** `backend/app.py`
- **Purpose:** Creates new marketplace listing
- **Process:**
  - Validates input data
  - Uploads images to Supabase Storage
  - Applies AI content moderation
  - Creates listing record with pricing rules
  - Configures dynamic delivery webhook if provided

**Request Body:**
```json
{
  "title": "Product Title",
  "description": "Product description",
  "price_usd": 49.99,
  "accept_all": true,
  "payment_methods": ["crypto", "paypal"],
  "fulfillment_url": "https://seller-api.com/webhook",
  "pricing_rules": {
    "currencies": {
      "BTC": { "fixed_usd": 0.5 },
      "ETH": { "fixed_usd": 0.75 }
    }
  }
}
```

#### Cart Management

##### `/api/cart` (GET)
**Location:** `backend/app.py`
- **Purpose:** Retrieves user's shopping cart
- **Returns:** Cart items with listing details

##### `/api/cart` (POST)
**Location:** `backend/app.py`
- **Purpose:** Adds item to cart
- **Process:**
  - Validates listing exists and is active
  - Checks for duplicate cart items
  - Creates cart entry

##### `/api/cart/checkout` (POST)
**Location:** `backend/app.py`
- **Purpose:** Creates checkout session
- **Process:**
  - Calculates total amount
  - Creates payment intent (PayPal/Tatum)
  - Returns payment details

#### Escrow System

##### `/api/escrows` (POST)
**Location:** `backend/app.py`
- **Purpose:** Creates new escrow transaction
- **Process:**
  - Validates cart items
  - Calculates escrow amount
  - Creates escrow record
  - Initiates payment flow

##### `/api/escrows/:id/confirm` (POST)
**Location:** `backend/app.py`
- **Purpose:** Releases escrow funds to seller
- **Process:**
  - Validates buyer permission
  - Checks escrow status
  - Processes payout (PayPal/crypto)

##### `/api/escrows/:id/refund` (POST)
**Location:** `backend/app.py`
- **Purpose:** Processes escrow refund
- **Process:**
  - Validates refund eligibility
  - Initiates refund transaction
  - Updates escrow status

#### Payment Integration

##### PayPal Functions
**Location:** `backend/app.py`

- **`create_paypal_order(amount, currency)`**: Creates PayPal payment order
- **`capture_paypal_payment(order_id)`**: Captures authorized payment
- **`process_paypal_payout(recipient_email, amount)`**: Sends funds to seller
- **`process_paypal_refund(capture_id, amount)`**: Processes refunds

##### Crypto Functions (Tatum)
**Location:** `backend/app.py`

- **`create_crypto_address(currency)`**: Generates escrow wallet address
- **`monitor_crypto_payment(tx_hash, expected_amount)`**: Tracks payment confirmation
- **`send_crypto_payout(recipient_address, amount, currency)`**: Transfers funds to seller
- **`process_crypto_refund(refund_address, amount, currency)`**: Returns funds to buyer

#### Content Moderation

##### `/api/admin/moderation/config` (GET/POST)
**Location:** `backend/app.py`
- **Purpose:** Manages content moderation settings
- **Features:**
  - Configures AI provider (OpenAI)
  - Sets moderation thresholds
  - Enables/disables content filtering

##### `moderate_content(text: str, images?: list): dict`
**Location:** `backend/app.py`
- **Purpose:** Applies AI content moderation
- **Process:**
  - Calls OpenAI moderation API
  - Analyzes text for prohibited content
  - Reviews images for inappropriate material
  - Returns moderation decision and confidence scores

#### Real-time Features

##### WebSocket/SSE Implementation
**Location:** `backend/app.py`
- **Purpose:** Handles real-time updates for chat and notifications
- **Features:**
  - Server-sent events for live updates
  - Message broadcasting
  - User presence tracking
  - Typing indicators

#### Database Operations

##### User Profile Functions
**Location:** `backend/app.py`

- **`create_profile(user_id, username, email)`**: Creates user profile
- **`update_profile(user_id, updates)`**: Updates user information
- **`get_profile(user_id)`**: Retrieves user profile
- **`search_users(query)`**: Searches for users by username/email

##### Listing Functions
**Location:** `backend/app.py`

- **`create_listing(seller_id, data)`**: Creates marketplace listing
- **`update_listing(listing_id, updates)`**: Updates listing details
- **`delete_listing(listing_id)`**: Removes listing
- **`search_listings(filters)`**: Searches marketplace listings

##### Escrow Functions
**Location:** `backend/app.py`

- **`create_escrow(buyer_id, seller_id, listing_id, amount)`**: Creates escrow
- **`update_escrow_status(escrow_id, status)`**: Changes escrow status
- **`get_escrow_details(escrow_id)`**: Retrieves escrow information
- **`validate_escrow_access(user_id, escrow_id)`**: Checks user permissions

#### Utility Functions

##### Error Handling
**Location:** `backend/app.py`

- **`handle_api_error(error, context)`**: Formats error responses
- **`log_error(error, user_id, endpoint)`**: Logs errors with context
- **`send_error_notification(error, severity)`**: Sends error alerts

##### Security Functions
**Location:** `backend/app.py`

- **`validate_jwt_token(token)`**: Verifies JWT authenticity
- **`sanitize_input(data)`**: Cleans user input
- **`rate_limit_check(user_id, endpoint)`**: Implements rate limiting
- **`audit_log(action, user_id, details)`**: Records security events

---

## 🎨 UI Component Documentation

### Core UI Components

#### Button Variants
**Location:** `frontend/components/ui/button.tsx`
- **default**: Primary orange button with shadow
- **destructive**: Red button for delete/cancel actions
- **outline**: Bordered button with hover effects
- **secondary**: Gray secondary button
- **ghost**: Transparent button for subtle actions
- **link**: Text link with underline on hover

#### Input Components
**Location:** `frontend/components/ui/input.tsx`
- **Standard Input**: Text input with focus states
- **Password Input**: Masked text input
- **Email Input**: Email-validated input
- **Number Input**: Numeric input with validation

#### Card Components
**Location:** `frontend/components/ui/card.tsx`
- **Card**: Basic container with border and shadow
- **CardHeader**: Card header section
- **CardContent**: Main card content area
- **CardFooter**: Card footer section

#### Dialog/Modal Components
**Location:** `frontend/components/ui/dialog.tsx`
- **Dialog**: Modal overlay component
- **DialogTrigger**: Button to open dialog
- **DialogContent**: Modal content container
- **DialogHeader**: Modal header section
- **DialogFooter**: Modal footer with actions

#### Form Components
**Location:** `frontend/components/ui/label.tsx`
- **Label**: Form field labels
- **Form**: Form wrapper component
- **FormField**: Individual form field wrapper
- **FormControl**: Form input wrapper
- **FormMessage**: Error message display

### Specialized Components

#### `HotProducts` Component
**Location:** `frontend/components/HotProducts.tsx`
- **Purpose**: Featured products carousel with 3D effects
- **Features**:
  - Auto-rotating carousel
  - Live purchase count simulation
  - Keyboard navigation (arrow keys)
  - Hover pause functionality
  - Smooth 3D transitions
  - Rating stars and pricing display
  - "HOT" badge for trending items

**Props:**
- `products`: Array of product objects
- `autoplay`: Enable/disable auto-rotation
- `slideIntervalMs`: Rotation speed in milliseconds
- `simulatePurchases`: Enable live purchase simulation
- `onProductClick`: Click handler for products

#### `EscrowChat` Component
**Location:** `frontend/components/EscrowChat.tsx`
- **Purpose**: Real-time escrow communication interface
- **Features**:
  - Live messaging with Supabase realtime
  - System message notifications
  - Address collection for crypto payments
  - Amount confirmation prompts
  - Refund processing interface
  - Message timestamps and sender avatars
  - Typing indicators and presence

**State Management:**
- Message history with optimistic updates
- Address submission for payouts
- Refund address collection
- PayPal email collection
- Loading states for async operations

#### `AuthForm` Component
**Location:** `frontend/components/AuthForm.tsx`
- **Purpose**: User authentication interface
- **Features**:
  - Login/register toggle
  - Email/password validation
  - Username creation for registration
  - Error handling and display
  - Loading states with spinner
  - Automatic profile creation
  - Redirect after successful auth

**Validation:**
- Email format validation
- Password requirements
- Username sanitization
- Duplicate username checking

#### `MarketplaceFilters` Component
**Location:** `frontend/components/MarketplaceFilters.tsx`
- **Purpose**: Advanced filtering for marketplace listings
- **Filters**:
  - Search query input
  - Payment method selection
  - Cryptocurrency selection
  - Price range slider
  - Category filters
  - Rating filters

#### `StatefulButton` Component
**Location:** `frontend/components/ui/stateful-button.tsx`
- **Purpose**: Button with async states and success animations
- **Animation Phases**:
  1. **Loading**: Shows spinner during async operation
  2. **Success**: Displays success message with animation
  3. **Reset**: Returns to idle state
- **Features**:
  - Prevents double-clicks during async operations
  - Smooth text transitions
  - Automatic state cleanup
  - Customizable success content

#### `UniversalSelector` Component
**Location:** `frontend/components/selector.tsx`
- **Purpose**: Generic, reusable dropdown selector for any type of selectable data
- **Features**:
  - TypeScript generics for type safety
  - Customizable display fields and search fields
  - Custom render functions for options and selected items
  - Search functionality with real-time filtering
  - Duplicate prevention and validation
  - Dark theme styling matching the app design

**Props:**
- `value?: string` - Currently selected value
- `onValueChange?: (value: string) => void` - Selection change handler
- `options?: T[]` - Array of selectable items
- `displayFields?: (keyof T)[]` - Fields to display in the UI
- `searchFields?: (keyof T)[]` - Fields to search through
- `renderOption?: (item: T, isSelected: boolean) => ReactNode` - Custom option renderer
- `renderSelected?: (item: T) => ReactNode` - Custom selected item renderer
- `placeholder?: string` - Placeholder text
- `emptyMessage?: string` - Message when no results found

#### `CurrencySelectorRow` Component
**Location:** `frontend/components/selector.tsx`
- **Purpose**: Specialized row component for per-currency fee overrides in listing creation
- **Features**:
  - Integrated cryptocurrency dropdown selector
  - Fixed USD amount input field
  - Duplicate currency prevention
  - Remove button for row deletion
  - Real-time validation and error handling
  - Supports both percentage and fixed USD modes

**Props:**
- `value: { currency: string; amount: number | '' }` - Current row data
- `onChange: (value) => void` - Change handler for row updates
- `onRemove: () => void` - Remove handler for row deletion
- `used: string[]` - Array of already used currencies
- `suffix?: string` - Display suffix ('%' or '$')

### Layout Components

#### `Navbar` Component
**Location:** `frontend/components/Navbar.tsx`
- **Purpose**: Main navigation header
- **Features**:
  - Logo and branding
  - Navigation links
  - Cart icon with badge
  - User menu dropdown
  - Mobile responsive design
  - Notification indicators

#### `Footer` Component
**Location:** `frontend/components/Footer.tsx`
- **Purpose**: Site footer with links and information
- **Sections**:
  - Company information
  - Navigation links
  - Social media links
  - Legal pages
  - Newsletter signup

### Utility Components

#### `RouteLoader` Component
**Location:** `frontend/components/RouteLoader.tsx`
- **Purpose**: Loading states for page transitions
- **Features**:
  - Skeleton loading screens
  - Progressive loading indicators
  - Smooth transitions between routes

#### `TransactionOverlay` Component
**Location:** `frontend/components/TransactionOverlay.tsx`
- **Purpose**: Transaction status overlay
- **Features**:
  - Payment processing indicators
  - Success/failure animations
  - Transaction details display
  - Action buttons for next steps

---

## 📄 Page Components & Functions

### Marketplace Pages

#### `MarketplacePage`
**Location:** `frontend/app/marketplace/page.tsx`
- **Purpose**: Main marketplace listing page with search and filters
- **State Management**:
  - `items`: Array of marketplace listings
  - `hotProducts`: Featured products (currently hidden)
  - `loading`: Page loading state
  - `error`: Error message display
  - `q`: Search query string
  - `currency`: Selected cryptocurrency filter
  - `paymentMethod`: Payment method filter
  - `priceRange`: Price range filter object
  - `page`: Current pagination page
  - `limit`: Items per page limit
  - `message`: Success/info message display

**Key Functions:**
- **`fetchListings(p?: number)`**: Loads marketplace listings with filters
  - Applies search query, currency, payment method, and price filters
  - Handles pagination
  - Logs search activity for recommendations
- **`fetchHotProducts()`**: Loads trending products (currently disabled)
- **`addToCart(listing, method, selectedCurrency?)`**: Adds item to cart
  - Validates user authentication
  - Creates cart entry with payment method
  - Shows success animation
- **`addDefaultToCart(listing)`**: Quick add to cart with auto-selected payment method
- **`startMessaging(listing)`**: Initiates conversation with seller
  - Creates conversation thread
  - Redirects to messages page

#### `MarketplaceItemPage`
**Location:** `frontend/app/marketplace/[id]/page.tsx`
- **Purpose**: Individual listing detail page
- **Features**:
  - Full listing information display
  - Image gallery
  - Seller information
  - Rating and reviews
  - Purchase options
  - Message seller functionality

#### `CreateListingPage`
**Location:** `frontend/app/marketplace/create/page.tsx`
- **Purpose**: Create new marketplace listing
- **Features**:
  - Form validation
  - Image upload
  - Price and currency selection
  - Content moderation
  - Category selection

### Cart & Checkout

#### `CartPage`
**Location:** `frontend/app/cart/page.tsx`
- **Purpose**: Shopping cart management
- **Features**:
  - Cart item display
  - Quantity adjustments
  - Item removal
  - Total calculation
  - Checkout initiation

### Messaging System

#### `MessagesPage`
**Location:** `frontend/app/messages/page.tsx`
- **Purpose**: User messaging inbox and conversations
- **Features**:
  - Conversation list
  - Message threads
  - Real-time updates
  - File attachments
  - Typing indicators

### User Management

#### `ProfilePage`
**Location:** `frontend/app/profile/page.tsx`
- **Purpose**: User profile management
- **Features**:
  - Profile information editing
  - Avatar upload
  - Password change
  - Account settings
  - Purchase history

#### `UserProfilePage`
**Location:** `frontend/app/profiles/[username]/page.tsx`
- **Purpose**: Public user profile viewing
- **Features**:
  - User information display
  - Rating and review history
  - Listed items
  - Contact options

### Escrow System

#### `EscrowDetailPage`
**Location:** `frontend/app/escrow/[id]/page.tsx`
- **Purpose**: Individual escrow transaction management
- **Features**:
  - Transaction status tracking
  - Payment processing
  - Dispute management
  - Communication with counterparties

### Admin Pages

#### `AdminDashboard`
**Location:** `frontend/app/admin/page.tsx`
- **Purpose**: Administrative overview and statistics
- **Features**:
  - System metrics
  - Recent transactions
  - User activity
  - Revenue tracking
  - Moderation queue

#### `AdminUsersPage`
**Location:** `frontend/app/admin/users/page.tsx`
- **Purpose**: User management for administrators
- **Features**:
  - User search and filtering
  - Account status management
  - User statistics
  - Ban/unban functionality

#### `AdminEscrowsPage`
**Location:** `frontend/app/admin/escrows/page.tsx`
- **Purpose**: Escrow transaction oversight
- **Features**:
  - Transaction monitoring
  - Dispute resolution
  - Payment status tracking
  - Intervention capabilities

#### `AdminReportsPage`
**Location:** `frontend/app/admin/reports/page.tsx`
- **Purpose**: Content moderation and reporting
- **Features**:
  - Report queue management
  - Content review
  - Moderation actions
  - Appeal handling

#### `AdminReferralsPage`
**Location:** `frontend/app/admin/referrals/page.tsx`
- **Purpose**: Referral system management
- **Features**:
  - Referral tracking
  - Commission management
  - Payout processing
  - Analytics dashboard

### Authentication Pages

#### `AuthPage`
**Location:** `frontend/app/auth/page.tsx`
- **Purpose**: User authentication (login/register)
- **Features**:
  - Email/password authentication
  - Registration form
  - Password reset
  - OAuth integration

#### `AuthCallbackPage`
**Location:** `frontend/app/auth/callback/page.tsx`
- **Purpose**: OAuth authentication callback handling
- **Features**:
  - OAuth token processing
  - User profile creation
  - Redirect management

### Utility Pages

#### `DashboardPage`
**Location:** `frontend/app/dashboard/page.tsx`
- **Purpose**: User dashboard with overview
- **Features**:
  - Recent activity
  - Active escrows
  - Account balance
  - Quick actions

#### `OnboardingUsernamePage`
**Location:** `frontend/app/onboarding/username/page.tsx`
- **Purpose**: Username selection during onboarding
- **Features**:
  - Username validation
  - Availability checking
  - Profile completion

---

## 🔧 Backend API Functions (Complete Reference)

### Core Application Functions

#### Flask Application Setup
**Location:** `backend/app.py`
- **`create_app()`**: Initializes Flask application with all configurations
- **`setup_cors()`**: Configures CORS policies for cross-origin requests
- **`setup_rate_limiting()`**: Initializes Flask-Limiter for API protection
- **`init_supabase()`**: Creates Supabase client instance

#### Authentication Decorators
**Location:** `backend/app.py`

- **`@require_auth`**: Validates JWT tokens
  - Extracts Bearer token from Authorization header
  - Decodes and validates JWT
  - Sets `request.user_id` from token payload
  - Returns 401 for invalid/expired tokens

- **`@require_admin`**: Restricts to admin users
  - Calls `require_auth` first
  - Queries user role from database
  - Returns 403 for non-admin users

- **`@require_service_key`**: Validates service key
  - Checks X-Service-Key header
  - Compares against configured service key
  - Used for internal/admin operations

### Database Helper Functions
**Location:** `backend/app.py`

#### User Operations
- **`get_user_profile(user_id)`**: Fetches complete user profile
- **`update_user_profile(user_id, data)`**: Updates user information
- **`create_user_profile(user_id, username, email)`**: Creates new profile
- **`search_users(query, limit=20)`**: Searches users by username/email

#### Listing Operations
- **`get_marketplace_listings(filters, page=1, limit=24)`**: Retrieves filtered listings
- **`get_listing_details(listing_id)`**: Gets full listing with images/metadata
- **`create_listing(seller_id, data)`**: Creates new marketplace listing
- **`update_listing(listing_id, data)`**: Updates existing listing
- **`delete_listing(listing_id)`**: Removes listing (soft delete)
- **`pause_listing(listing_id)`**: Pauses listing visibility
- **`resume_listing(listing_id)`**: Resumes listing visibility

#### Cart Operations
- **`get_user_cart(user_id)`**: Retrieves user's cart items
- **`add_to_cart(user_id, listing_id, quantity=1)`**: Adds item to cart
- **`update_cart_quantity(cart_item_id, quantity)`**: Updates item quantity
- **`remove_from_cart(cart_item_id)`**: Removes item from cart
- **`clear_user_cart(user_id)`**: Empties entire cart

#### Escrow Operations
- **`create_escrow(buyer_id, seller_id, listing_id, amount)`**: Creates escrow transaction
- **`get_escrow_details(escrow_id)`**: Retrieves escrow information
- **`update_escrow_status(escrow_id, status)`**: Changes escrow status
- **`confirm_escrow_delivery(escrow_id, user_id)`**: Confirms delivery and releases funds
- **`process_escrow_refund(escrow_id, reason)`**: Initiates refund process

### Payment Processing Functions

#### PayPal Integration
**Location:** `backend/app.py`

- **`create_paypal_order(amount, currency='USD')`**: Creates PayPal payment order
  - Calls PayPal Orders API
  - Returns approval URL for frontend redirect
  - Stores order ID for later capture

- **`capture_paypal_payment(order_id)`**: Captures authorized payment
  - Calls PayPal Capture API
  - Funds held in PayPal escrow
  - Returns capture details

- **`process_paypal_payout(recipient_email, amount)`**: Releases funds to seller
  - Creates PayPal payout batch
  - Sends funds to seller's PayPal account
  - Updates escrow status

- **`process_paypal_refund(capture_id, amount)`**: Processes refunds
  - Calls PayPal Refund API
  - Returns funds to buyer's PayPal account
  - Updates transaction records

#### Crypto Integration (Tatum)
**Location:** `backend/app.py`

- **`generate_crypto_address(currency, escrow_id)`**: Creates escrow wallet
  - Calls Tatum API for new address generation
  - Links address to escrow transaction
  - Returns deposit address and memo

- **`monitor_crypto_transaction(tx_hash, expected_amount, currency)`**: Tracks payment
  - Polls Tatum API for transaction status
  - Validates payment amount and confirmations
  - Updates escrow status on confirmation

- **`send_crypto_payout(recipient_address, amount, currency, escrow_id)`**: Releases funds
  - Creates Tatum transfer transaction
  - Sends funds to seller's wallet
  - Records transaction hash

- **`process_crypto_refund(refund_address, amount, currency, escrow_id)`**: Returns funds
  - Creates Tatum transfer back to buyer
  - Updates escrow status
  - Logs refund transaction

### Content Moderation Functions
**Location:** `backend/app.py`

- **`moderate_text_content(text, threshold=0.8)`**: Analyzes text for prohibited content
  - Calls OpenAI Moderation API
  - Checks against configured thresholds
  - Returns moderation decision and scores

- **`moderate_image_content(image_url, threshold=0.6)`**: Analyzes images
  - Downloads and processes image
  - Calls OpenAI Vision API
  - Returns content safety assessment

- **`process_listing_moderation(listing_data)`**: Full listing moderation
  - Moderates title, description, and images
  - Applies business rules
  - Returns approval/rejection with reasons

### Real-time and Notification Functions
**Location:** `backend/app.py`

- **`send_realtime_notification(user_id, event_type, data)`**: Sends live notifications
  - Publishes to Supabase realtime channels
  - Includes user-specific data
  - Handles connection failures

- **`broadcast_escrow_update(escrow_id, update_type, data)`**: Notifies escrow participants
  - Sends updates to buyer and seller
  - Includes transaction details
  - Triggers UI updates

### Utility and Helper Functions
**Location:** `backend/app.py`

#### Error Handling
- **`format_api_error(error, context=None)`**: Standardizes error responses
- **`log_api_error(error, user_id, endpoint, request_data)`**: Logs errors with context
- **`send_error_alert(error, severity='error')`**: Sends error notifications

#### Security Functions
- **`validate_payment_amount(amount, currency)`**: Validates payment amounts
- **`sanitize_user_input(data)`**: Cleans and validates user input
- **`generate_secure_token(length=32)`**: Creates secure random tokens
- **`hash_sensitive_data(data)`**: Hashes sensitive information

#### Rate Limiting
- **`check_rate_limit(user_id, endpoint, limit_per_hour)`**: Enforces rate limits
- **`get_rate_limit_status(user_id, endpoint)`**: Returns current usage
- **`reset_rate_limit(user_id, endpoint)`**: Resets counters (admin only)

### Webhook Processing Functions
**Location:** `backend/app.py`

- **`process_paypal_webhook(payload, signature)`**: Handles PayPal webhooks
  - Verifies webhook signature
  - Updates payment status
  - Triggers appropriate actions

- **`process_crypto_webhook(payload, signature)`**: Handles Tatum webhooks
  - Verifies webhook authenticity
  - Updates transaction status
  - Processes confirmations

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Happy building with Medius! 🎉**





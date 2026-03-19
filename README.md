# BIASHARA360 🇰🇪
**Universal POS & Business Intelligence for every Kenyan trader**

> From mama mboga to supermarket — offline-first, M-Pesa native, AI-powered.

---

## 🚀 Quick Start (MVP Launch Checklist)

### Step 1 — Accounts (30 minutes total)
- [ ] **GitHub**: Create repo `biashara360` at github.com/molich023/biashara360
- [ ] **Netlify**: Sign up at netlify.com → connect GitHub repo
- [ ] **Safaricom Daraja**: Register at developers.safaricom.co.ke → create app → get sandbox keys
- [ ] **Oramobile** (Phase 2 SMS): Register at oramobile.com → top up via M-Pesa

### Step 2 — Database Setup (10 minutes)
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize database (creates Neon PostgreSQL)
netlify db init

# ⚠️ IMPORTANT: Go to Netlify Dashboard → Extensions → Neon → CLAIM DATABASE NOW
# If you don't claim it, it gets deleted after 7 days!
```

### Step 3 — Run Schema
1. Go to Netlify Dashboard → Extensions → Neon → Open SQL Editor
2. Paste the entire contents of `supabase/migrations/001_initial.sql`
3. Click Run

### Step 4 — Environment Variables
Go to Netlify Dashboard → Site → Environment Variables → Add:
```
APP_URL = https://your-site.netlify.app
MPESA_ENV = sandbox
MPESA_CONSUMER_KEY = (from Daraja dashboard)
MPESA_CONSUMER_SECRET = (from Daraja dashboard)
MPESA_SHORTCODE = 174379
MPESA_PASSKEY = bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
```

### Step 5 — Deploy
```bash
# Install dependencies
npm install

# Test locally
npm run dev

# Deploy to Netlify
netlify deploy --prod
```

### Step 6 — Test on Android
1. Open `https://your-site.netlify.app` on Android Chrome
2. Tap the "Add to Home Screen" prompt → installs like native app
3. Register your shop → create PIN → start selling!

---

## 📁 Project Structure
```
biashara360/
├── src/
│   ├── components/
│   │   ├── Layout/        # BottomNav, SyncBar
│   │   └── POS/           # QrScanner
│   ├── db/local.ts        # Dexie.js offline database
│   ├── lib/
│   │   ├── auth.tsx       # PIN auth context
│   │   ├── mpesa.ts       # M-Pesa helpers + WhatsApp receipts
│   │   ├── sync.ts        # Offline → online sync engine
│   │   └── toast.tsx      # Toast notifications
│   ├── pages/
│   │   ├── Setup.tsx      # Shop onboarding (4 steps)
│   │   ├── Login.tsx      # PIN login with lockout
│   │   ├── Sell.tsx       # POS checkout (main screen)
│   │   ├── Stock.tsx      # Inventory management
│   │   ├── Report.tsx     # Daily reports
│   │   └── Settings.tsx   # Shop settings
│   ├── types/index.ts     # All TypeScript types
│   └── App.tsx            # Router + auth guard
├── netlify/functions/     # Server-side: M-Pesa, sync, SMS
├── supabase/migrations/   # PostgreSQL schema SQL
├── netlify.toml           # Build config + security headers
└── .env.example           # Environment variables template
```

---

## 💳 Pricing
| Tier | Price | Who |
|---|---|---|
| Majaribio | FREE 7 days | Everyone |
| Biashara Ndogo | KSH 100/year | Kiosks, vendors, hawkers |
| Biashara Kati | KSH 500/year | Mini markets, saloons, shops |
| Biashara Kubwa | KSH 1,000/year | Supermarkets, hotels, multi-outlet |

---

## 🔒 Security
- AES-256 encrypted local storage
- PIN brute-force protection (5 attempts → 10 min lockout)
- OWASP Top 10 compliant
- M-Pesa keys never in frontend code
- Immutable financial records (no UPDATE on sales table)
- Full HTTPS with HSTS headers

---

## 📞 Contact
**Randy Voti** · molich023 · Ngong Hills, Kenya  
📧 molich60@gmail.com · Randy.voti@owasp.org  
📱 0704-658022  
📮 P.O. Box 237-00208, Ngong Hills, Kenya

---
*Built with ❤️ for Kenya's 3 million traders*

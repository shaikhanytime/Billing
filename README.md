# BizOps — Business Operations Platform

A complete Billing & Inventory Management system for Retailers, Wholesalers, and Manufacturers.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Firebase Cloud Functions (Express + TypeScript) |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| Storage | Firebase Storage |
| Frontend Deploy | Vercel |
| Backend Deploy | Firebase Cloud Functions |

## Features

- ✅ **GST Billing** — Sales & Purchase Invoices with auto CGST/SGST/IGST
- ✅ **Barcode System** — Auto-generate EAN-13, print labels, scan at billing
- ✅ **Party Ledger** — Customer & Supplier Dr/Cr accounts
- ✅ **Outstanding** — Aging reports (30/60/90 days)
- ✅ **Reports** — Daily/Weekly/Monthly, Party-wise, Product-wise (PDF + Excel)
- ✅ **Multi-Branch** — Multiple locations per organization
- ✅ **RBAC** — Role-based access (Super Admin → Admin → Manager → Staff)

## Project Structure

```
/
├── frontend/        ← React + Vite app (deploy to Vercel)
├── backend/         ← Firebase Functions (deploy to Firebase)
├── firebase.json    ← Firebase project config
├── firestore.rules  ← Security rules
└── firestore.indexes.json
```

## Quick Start

### Prerequisites
- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project (Blaze plan for Cloud Functions)

### 1. Clone and Setup

```bash
git clone https://github.com/shaikhanytime/Billing.git
cd Billing
```

### 2. Firebase Setup

```bash
firebase login
firebase use --add   # select your Firebase project
```

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Fill in your Firebase config values in .env
npm install
npm run dev
```

### 4. Backend Setup

```bash
cd backend
npm install
npm run build
```

### 5. Deploy

**Frontend → Vercel:**
```bash
# Connect GitHub repo to Vercel, set env vars, auto-deploy on push
```

**Backend → Firebase:**
```bash
firebase deploy --only functions,firestore:rules
```

## Environment Variables (Frontend)

Copy `frontend/.env.example` to `frontend/.env` and fill:

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |
| `VITE_API_BASE_URL` | Firebase Functions URL |

## First-Time Setup

1. Deploy the app
2. Register/Login with your email in Firebase Auth
3. Call `POST /api/auth/setup-org` with org details to create your organization
4. Your account becomes `SUPER_ADMIN`
5. Create other users via Admin → Users panel

## Development Phases

| Phase | Status | Description |
|---|---|---|
| 1 | ✅ **Complete** | Foundation: Auth, Users, Roles, Org, Branches, Warehouses, Dashboard |
| 2 | 🔄 Next | Inventory: Products, Barcode, Stock |
| 3 | ⏳ Planned | Parties: Customers, Suppliers, Ledger |
| 4 | ⏳ Planned | Billing: Sales, Purchases, Returns, Payments |
| 5 | ⏳ Planned | Reports: All reports, PDF/Excel export |

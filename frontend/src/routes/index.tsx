import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { ProtectedRoute, PublicRoute } from './ProtectedRoute'
import { Loader2 } from 'lucide-react'

// Auth
import { LoginPage } from '@/features/auth/pages/LoginPage'

// Dashboard
const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
)

// Admin
const UsersPage = lazy(() =>
  import('@/features/admin/users/pages/UsersPage').then((m) => ({ default: m.UsersPage }))
)

// Inventory
const ProductsPage = lazy(() =>
  import('@/features/inventory/pages/ProductsPage').then((m) => ({ default: m.ProductsPage }))
)

// Parties
const CustomersPage = lazy(() =>
  import('@/features/parties/pages/CustomersPage').then((m) => ({ default: m.CustomersPage }))
)
const SuppliersPage = lazy(() =>
  import('@/features/parties/pages/SuppliersPage').then((m) => ({ default: m.SuppliersPage }))
)

// Sales
const SalesInvoicesPage = lazy(() =>
  import('@/features/sales/pages/SalesInvoicesPage').then((m) => ({ default: m.SalesInvoicesPage }))
)
const CreateSaleInvoicePage = lazy(() =>
  import('@/features/sales/pages/CreateSaleInvoicePage').then((m) => ({ default: m.CreateSaleInvoicePage }))
)
const QuotationsPage = lazy(() =>
  import('@/features/sales/pages/QuotationsPage').then((m) => ({ default: m.QuotationsPage }))
)
const CreateQuotationPage = lazy(() =>
  import('@/features/sales/pages/CreateQuotationPage').then((m) => ({ default: m.CreateQuotationPage }))
)

// Purchases
const PurchaseInvoicesPage = lazy(() =>
  import('@/features/purchases/pages/PurchaseInvoicesPage').then((m) => ({ default: m.PurchaseInvoicesPage }))
)
const CreatePurchaseInvoicePage = lazy(() =>
  import('@/features/purchases/pages/CreatePurchaseInvoicePage').then((m) => ({ default: m.CreatePurchaseInvoicePage }))
)

// Payments
const PaymentsReceivedPage = lazy(() =>
  import('@/features/payments/pages/PaymentsReceivedPage').then((m) => ({ default: m.PaymentsReceivedPage }))
)
const CreatePaymentInPage = lazy(() =>
  import('@/features/payments/pages/CreatePaymentInPage').then((m) => ({ default: m.CreatePaymentInPage }))
)
const PaymentsMadePage = lazy(() =>
  import('@/features/payments/pages/PaymentsMadePage').then((m) => ({ default: m.PaymentsMadePage }))
)
const CreatePaymentOutPage = lazy(() =>
  import('@/features/payments/pages/CreatePaymentOutPage').then((m) => ({ default: m.CreatePaymentOutPage }))
)

// Placeholder component for pages not yet implemented
function ComingSoon({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4 ring-1 ring-blue-500/20">
        <Loader2 className="h-8 w-8 text-blue-400" />
      </div>
      <h2 className="text-lg font-semibold text-gray-300">{name}</h2>
      <p className="mt-2 text-sm text-gray-500">This module is coming in the next phase.</p>
    </div>
  )
}

const PageLoader = (
  <div className="flex min-h-[200px] items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
  </div>
)

const router = createBrowserRouter([
  // Public routes
  {
    element: <PublicRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [{ path: '/login', element: <LoginPage /> }],
      },
    ],
  },

  // Protected routes
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          {
            path: 'dashboard',
            element: <Suspense fallback={PageLoader}><DashboardPage /></Suspense>,
          },

          // ─── Inventory ───────────────────────────────────────────────────
          {
            path: 'inventory/products',
            element: <Suspense fallback={PageLoader}><ProductsPage /></Suspense>,
          },
          { path: 'inventory/products/new', element: <ComingSoon name="Add Product" /> },
          { path: 'inventory/categories', element: <ComingSoon name="Categories" /> },
          { path: 'inventory/units', element: <ComingSoon name="Units" /> },
          { path: 'inventory/stock', element: <ComingSoon name="Stock Levels" /> },
          { path: 'inventory/adjustments', element: <ComingSoon name="Stock Adjustments" /> },
          { path: 'inventory/adjustments/new', element: <ComingSoon name="New Adjustment" /> },

          // ─── Sales ────────────────────────────────────────────────────────
          {
            path: 'sales/invoices',
            element: <Suspense fallback={PageLoader}><SalesInvoicesPage /></Suspense>,
          },
          {
            path: 'sales/invoices/new',
            element: <Suspense fallback={PageLoader}><CreateSaleInvoicePage /></Suspense>,
          },
          {
            path: 'sales/quotations',
            element: <Suspense fallback={PageLoader}><QuotationsPage /></Suspense>,
          },
          {
            path: 'sales/quotations/new',
            element: <Suspense fallback={PageLoader}><CreateQuotationPage /></Suspense>,
          },
          { path: 'sales/returns', element: <ComingSoon name="Sales Returns" /> },

          // ─── Purchases ────────────────────────────────────────────────────
          {
            path: 'purchases/invoices',
            element: <Suspense fallback={PageLoader}><PurchaseInvoicesPage /></Suspense>,
          },
          {
            path: 'purchases/invoices/new',
            element: <Suspense fallback={PageLoader}><CreatePurchaseInvoicePage /></Suspense>,
          },
          { path: 'purchases/returns', element: <ComingSoon name="Purchase Returns" /> },

          // ─── Payments ─────────────────────────────────────────────────────
          {
            path: 'payments/received',
            element: <Suspense fallback={PageLoader}><PaymentsReceivedPage /></Suspense>,
          },
          {
            path: 'payments/received/new',
            element: <Suspense fallback={PageLoader}><CreatePaymentInPage /></Suspense>,
          },
          {
            path: 'payments/made',
            element: <Suspense fallback={PageLoader}><PaymentsMadePage /></Suspense>,
          },
          {
            path: 'payments/made/new',
            element: <Suspense fallback={PageLoader}><CreatePaymentOutPage /></Suspense>,
          },

          // ─── Parties ──────────────────────────────────────────────────────
          {
            path: 'parties/customers',
            element: <Suspense fallback={PageLoader}><CustomersPage /></Suspense>,
          },
          { path: 'parties/customers/new', element: <ComingSoon name="Add Customer" /> },
          {
            path: 'parties/suppliers',
            element: <Suspense fallback={PageLoader}><SuppliersPage /></Suspense>,
          },
          { path: 'parties/suppliers/new', element: <ComingSoon name="Add Supplier" /> },

          // ─── Ledger ───────────────────────────────────────────────────────
          { path: 'ledger/party', element: <ComingSoon name="Party Ledger" /> },
          { path: 'ledger/outstanding', element: <ComingSoon name="Outstanding Dues" /> },

          // ─── Reports ──────────────────────────────────────────────────────
          { path: 'reports/sales', element: <ComingSoon name="Sales Report" /> },
          { path: 'reports/purchases', element: <ComingSoon name="Purchase Report" /> },
          { path: 'reports/stock', element: <ComingSoon name="Stock Report" /> },
          { path: 'reports/gst', element: <ComingSoon name="GST Summary" /> },

          // ─── Administration ───────────────────────────────────────────────
          {
            path: 'admin/users',
            element: <Suspense fallback={PageLoader}><UsersPage /></Suspense>,
          },
          { path: 'admin/organization', element: <ComingSoon name="Organization Settings" /> },
          { path: 'admin/branches', element: <ComingSoon name="Branches" /> },
          { path: 'admin/warehouses', element: <ComingSoon name="Warehouses" /> },
        ],
      },
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}

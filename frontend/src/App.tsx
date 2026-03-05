import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import { setupAxiosInterceptors, useAuthStore } from '@/lib/auth'
import { authAPI, api } from '@/lib/api'
import ProductManagement from '@/pages/ProductManagement'
import POSCheckout from '@/pages/POSCheckout'
import Dashboard from '@/pages/Dashboard'
import UserManagement from '@/pages/UserManagement'
import RoleManagement from '@/pages/RoleManagement'
import SettingsPage from '@/pages/Settings'
import ExpiryLots from '@/pages/ExpiryLots'
import RestaurantTables from '@/pages/RestaurantTables'
import KitchenBoard from '@/pages/KitchenBoard'
import PharmacyConsole from '@/pages/PharmacyConsole'
import ReceivingCenter from '@/pages/ReceivingCenter'
import ActivityLog from '@/components/ActivityLog'
import { Button } from '@/components/ui/Button'
import {
  LogOut,
  ShoppingCart,
  BarChart3,
  Package,
  Users,
  Lock,
  Eye,
  Settings,
  CalendarClock,
  UtensilsCrossed,
  ClipboardList,
  Pill,
  Truck,
} from 'lucide-react'
import './styles.css'

// Import offline components
import OfflineIndicator from '@/components/OfflineIndicator'
import SyncStatusModal from '@/components/SyncStatusModal'

// Import legacy components (temporary for backward compatibility)
import LoginComponent from './components/Login'
import RegisterComponent from './components/Register'

interface MenuItem {
  label: string
  icon: React.ReactNode
  path: string
  allowedRoles: string[]
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Checkout', icon: <ShoppingCart className="h-4 w-4" />, path: '/checkout', allowedRoles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Products', icon: <Package className="h-4 w-4" />, path: '/products', allowedRoles: ['ADMIN', 'MANAGER', 'STOCK_CLERK', 'CASHIER'] },
  { label: 'Dashboard', icon: <BarChart3 className="h-4 w-4" />, path: '/dashboard', allowedRoles: ['ADMIN', 'MANAGER', 'SUPERVISOR'] },
  { label: 'Users', icon: <Users className="h-4 w-4" />, path: '/users', allowedRoles: ['ADMIN', 'MANAGER'] },
  { label: 'Roles', icon: <Lock className="h-4 w-4" />, path: '/roles', allowedRoles: ['ADMIN'] },
  { label: 'Activity Log', icon: <Eye className="h-4 w-4" />, path: '/activity', allowedRoles: ['ADMIN', 'MANAGER'] },
  { label: 'Expiry/Lots', icon: <CalendarClock className="h-4 w-4" />, path: '/expiry-lots', allowedRoles: ['ADMIN', 'MANAGER', 'STOCK_CLERK'] },
  { label: 'Restaurant', icon: <UtensilsCrossed className="h-4 w-4" />, path: '/restaurant/tables', allowedRoles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Kitchen', icon: <ClipboardList className="h-4 w-4" />, path: '/kitchen', allowedRoles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Pharmacy', icon: <Pill className="h-4 w-4" />, path: '/pharmacy', allowedRoles: ['ADMIN', 'MANAGER', 'SUPERVISOR'] },
  { label: 'Receiving', icon: <Truck className="h-4 w-4" />, path: '/receiving', allowedRoles: ['ADMIN', 'MANAGER', 'STOCK_CLERK'] },
  { label: 'Settings', icon: <Settings className="h-4 w-4" />, path: '/settings', allowedRoles: ['ADMIN', 'MANAGER'] },
]

function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore()
  const [isLoading, setIsLoading] = React.useState(true)
  const [showSyncModal, setShowSyncModal] = useState(false)

  useEffect(() => {
    setupAxiosInterceptors(api)
    
    // Check if user is already logged in
    const token = useAuthStore.getState().accessToken
    if (token) {
      // FIX: Validate token before calling getMe to avoid unnecessary 401 errors
      // Check if token looks valid (jwt format: 3 parts separated by dots)
      const isValidJWTFormat = token.split('.').length === 3
      
      if (isValidJWTFormat) {
        authAPI
          .getMe()
          .then((res) => {
            useAuthStore.getState().setUser(res.data)
          })
          .catch((error) => {
            console.error('Failed to fetch user info:', error.response?.status)
            // Clear tokens on auth failure
            logout()
          })
          .finally(() => {
            setIsLoading(false)
          })
      } else {
        // Token format is invalid, clear it
        console.warn('Invalid token format detected, clearing authentication')
        logout()
        setIsLoading(false)
      }
    } else {
      setIsLoading(false)
    }
  }, [])

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!user) {
    return children
  }

  const visibleMenuItems = MENU_ITEMS.filter((item) => item.allowedRoles.includes(user.role))

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card p-4 flex flex-col">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary">Aether</h1>
          <p className="text-sm text-muted-foreground">POS System</p>
        </div>

        <nav className="space-y-2 flex-1">
          {visibleMenuItems.map((item) => (
            <Link key={item.path} to={item.path}>
              <Button variant="ghost" className="w-full justify-start gap-2">
                {item.icon}
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        <div className="space-y-2 border-t border-border pt-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-semibold">{user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs capitalize px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                {user.role}
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>

      {/* Offline Indicator */}
      <OfflineIndicator showSyncModal={setShowSyncModal} />

      {/* Sync Status Modal */}
      <SyncStatusModal isOpen={showSyncModal} onClose={() => setShowSyncModal(false)} />
    </div>
  )
}

function AppContent() {
  const { user } = useAuthStore()

  const hasPermission = (requiredRoles: string[]): boolean => {
    return user ? requiredRoles.includes(user.role) : false
  }

  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={<LoginComponent />} />
      <Route path="/register" element={<RegisterComponent />} />

      {/* Protected Routes */}
      {user ? (
        <>
          <Route path="/checkout" element={hasPermission(['ADMIN', 'MANAGER', 'CASHIER']) ? <POSCheckout /> : <Navigate to="/" replace />} />
          <Route path="/products" element={hasPermission(['ADMIN', 'MANAGER', 'STOCK_CLERK', 'CASHIER']) ? <ProductManagement /> : <Navigate to="/" replace />} />
          <Route path="/dashboard" element={hasPermission(['ADMIN', 'MANAGER', 'SUPERVISOR']) ? <Dashboard /> : <Navigate to="/" replace />} />
          <Route path="/users" element={hasPermission(['ADMIN', 'MANAGER']) ? <UserManagement /> : <Navigate to="/" replace />} />
          <Route path="/roles" element={hasPermission(['ADMIN']) ? <RoleManagement /> : <Navigate to="/" replace />} />
          <Route path="/activity" element={hasPermission(['ADMIN', 'MANAGER']) ? <ActivityLog /> : <Navigate to="/" replace />} />
          <Route path="/expiry-lots" element={hasPermission(['ADMIN', 'MANAGER', 'STOCK_CLERK']) ? <ExpiryLots /> : <Navigate to="/" replace />} />
          <Route path="/restaurant/tables" element={hasPermission(['ADMIN', 'MANAGER', 'CASHIER']) ? <RestaurantTables /> : <Navigate to="/" replace />} />
          <Route path="/kitchen" element={hasPermission(['ADMIN', 'MANAGER', 'CASHIER']) ? <KitchenBoard /> : <Navigate to="/" replace />} />
          <Route path="/pharmacy" element={hasPermission(['ADMIN', 'MANAGER', 'SUPERVISOR']) ? <PharmacyConsole /> : <Navigate to="/" replace />} />
          <Route path="/receiving" element={hasPermission(['ADMIN', 'MANAGER', 'STOCK_CLERK']) ? <ReceivingCenter /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={hasPermission(['ADMIN', 'MANAGER']) ? <SettingsPage /> : <Navigate to="/" replace />} />
          <Route path="/" element={<Navigate to="/checkout" replace />} />
        </>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  )
}

export default function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Layout>
        <AppContent />
      </Layout>
    </Router>
  )
}

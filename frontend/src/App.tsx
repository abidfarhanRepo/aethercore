import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { setupAxiosInterceptors, useAuthStore } from '@/lib/auth'
import { authAPI, api } from '@/lib/api'
import { settingsAPI } from '@/lib/settingsAPI'
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
  Menu,
  X,
} from 'lucide-react'
import './styles.css'

// Import offline components
import OfflineIndicator from '@/components/OfflineIndicator'
import SyncStatusModal from '@/components/SyncStatusModal'
import { ThemeToggle } from '@/components/ThemeToggle'

// Import legacy components (temporary for backward compatibility)
import LoginComponent from './components/Login'
import RegisterComponent from './components/Register'

interface MenuItem {
  label: string
  icon: React.ReactNode
  path: string
  allowedRoles: string[]
}

type FeatureKey =
  | 'feature_expiry_lots_enabled'
  | 'feature_restaurant_enabled'
  | 'feature_kitchen_enabled'
  | 'feature_pharmacy_enabled'
  | 'feature_receiving_enabled'

type FeatureFlags = Record<FeatureKey, boolean>

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  feature_expiry_lots_enabled: false,
  feature_restaurant_enabled: false,
  feature_kitchen_enabled: false,
  feature_pharmacy_enabled: false,
  feature_receiving_enabled: false,
}

const PATH_TO_FEATURE_KEY: Record<string, FeatureKey> = {
  '/expiry-lots': 'feature_expiry_lots_enabled',
  '/restaurant/tables': 'feature_restaurant_enabled',
  '/kitchen': 'feature_kitchen_enabled',
  '/pharmacy': 'feature_pharmacy_enabled',
  '/receiving': 'feature_receiving_enabled',
}

const isPathEnabled = (path: string, featureFlags: FeatureFlags): boolean => {
  const featureKey = PATH_TO_FEATURE_KEY[path]
  return featureKey ? featureFlags[featureKey] : true
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

function Layout({ children, featureFlags }: { children: React.ReactNode; featureFlags: FeatureFlags }) {
  const { user, logout } = useAuthStore()
  const [isLoading, setIsLoading] = React.useState(true)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const isCheckoutRoute = location.pathname === '/checkout'

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

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!user) {
    return children
  }

  const visibleMenuItems = MENU_ITEMS.filter((item) => {
    return item.allowedRoles.includes(user.role) && isPathEnabled(item.path, featureFlags)
  })

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="hidden md:flex w-64 border-r border-border bg-card p-4 flex-col">
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
          <ThemeToggle />
          <div className="text-sm text-muted-foreground">
            <p className="font-semibold">{user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs capitalize px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                {user.role}
              </p>
            </div>
            <div className="mt-2">
              <OfflineIndicator mode="compact" showSyncModal={setShowSyncModal} />
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
        <div className="md:hidden flex items-center justify-between border-b border-border bg-card px-3 py-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Open navigation menu"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="font-semibold">Aether POS</div>
          <ThemeToggle compact />
        </div>
        <div className="flex-1 overflow-auto">
          {isCheckoutRoute ? (
            children
          ) : (
            <div className="w-full px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
              {children}
            </div>
          )}
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close navigation menu"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative h-full w-[86%] max-w-sm bg-card border-r border-border p-4 flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-primary">Aether</h2>
                <p className="text-xs text-muted-foreground">POS System</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close navigation menu"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mb-3">
              <ThemeToggle className="w-full" />
            </div>

            <nav className="space-y-2 flex-1 overflow-auto">
              {visibleMenuItems.map((item) => (
                <Link key={item.path} to={item.path}>
                  <Button variant="ghost" className="w-full justify-start gap-2 h-12">
                    {item.icon}
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>

            <div className="space-y-2 border-t border-border pt-4">
              <div className="text-sm text-muted-foreground">
                <p className="font-semibold">{user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}</p>
                <div className="mt-2">
                  <OfflineIndicator mode="compact" showSyncModal={setShowSyncModal} />
                </div>
              </div>
              <Button
                variant="destructive"
                className="w-full gap-2 h-12"
                onClick={() => logout()}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Status Modal */}
      <SyncStatusModal isOpen={showSyncModal} onClose={() => setShowSyncModal(false)} />
    </div>
  )
}

function AppContent({ featureFlags, settingsLoading }: { featureFlags: FeatureFlags; settingsLoading: boolean }) {
  const { user } = useAuthStore()

  const hasPermission = (requiredRoles: string[], path: string): boolean => {
    return user ? requiredRoles.includes(user.role) && isPathEnabled(path, featureFlags) : false
  }

  if (user && settingsLoading) {
    return <div className="flex items-center justify-center h-screen">Loading settings...</div>
  }

  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={<LoginComponent />} />
      <Route path="/register" element={<RegisterComponent />} />

      {/* Protected Routes */}
      {user ? (
        <>
          <Route path="/checkout" element={hasPermission(['ADMIN', 'MANAGER', 'CASHIER'], '/checkout') ? <POSCheckout /> : <Navigate to="/" replace />} />
          <Route path="/products" element={hasPermission(['ADMIN', 'MANAGER', 'STOCK_CLERK', 'CASHIER'], '/products') ? <ProductManagement /> : <Navigate to="/" replace />} />
          <Route path="/dashboard" element={hasPermission(['ADMIN', 'MANAGER', 'SUPERVISOR'], '/dashboard') ? <Dashboard /> : <Navigate to="/" replace />} />
          <Route path="/users" element={hasPermission(['ADMIN', 'MANAGER'], '/users') ? <UserManagement /> : <Navigate to="/" replace />} />
          <Route path="/roles" element={hasPermission(['ADMIN'], '/roles') ? <RoleManagement /> : <Navigate to="/" replace />} />
          <Route path="/activity" element={hasPermission(['ADMIN', 'MANAGER'], '/activity') ? <ActivityLog /> : <Navigate to="/" replace />} />
          <Route path="/expiry-lots" element={hasPermission(['ADMIN', 'MANAGER', 'STOCK_CLERK'], '/expiry-lots') ? <ExpiryLots /> : <Navigate to="/" replace />} />
          <Route path="/restaurant/tables" element={hasPermission(['ADMIN', 'MANAGER', 'CASHIER'], '/restaurant/tables') ? <RestaurantTables /> : <Navigate to="/" replace />} />
          <Route path="/kitchen" element={hasPermission(['ADMIN', 'MANAGER', 'CASHIER'], '/kitchen') ? <KitchenBoard /> : <Navigate to="/" replace />} />
          <Route path="/pharmacy" element={hasPermission(['ADMIN', 'MANAGER', 'SUPERVISOR'], '/pharmacy') ? <PharmacyConsole /> : <Navigate to="/" replace />} />
          <Route path="/receiving" element={hasPermission(['ADMIN', 'MANAGER', 'STOCK_CLERK'], '/receiving') ? <ReceivingCenter /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={hasPermission(['ADMIN', 'MANAGER'], '/settings') ? <SettingsPage /> : <Navigate to="/" replace />} />
          <Route path="/" element={<Navigate to="/checkout" replace />} />
        </>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  )
}

export default function App() {
  const { user } = useAuthStore()
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS)
  const [settingsLoading, setSettingsLoading] = useState(false)

  useEffect(() => {
    const loadFeatureSettings = async () => {
      if (!user) {
        setFeatureFlags(DEFAULT_FEATURE_FLAGS)
        setSettingsLoading(false)
        return
      }

      try {
        setSettingsLoading(true)
        const response = await settingsAPI.getByCategory('system')
        const settings = response.data || []

        const nextFlags = { ...DEFAULT_FEATURE_FLAGS }
        settings.forEach((setting) => {
          if (setting.key in nextFlags) {
            nextFlags[setting.key as FeatureKey] = setting.value === 'true'
          }
        })

        setFeatureFlags(nextFlags)
      } catch (error) {
        console.error('Failed to load feature settings', error)
        setFeatureFlags(DEFAULT_FEATURE_FLAGS)
      } finally {
        setSettingsLoading(false)
      }
    }

    void loadFeatureSettings()
  }, [user?.id])

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Layout featureFlags={featureFlags}>
        <AppContent featureFlags={featureFlags} settingsLoading={settingsLoading} />
      </Layout>
    </Router>
  )
}

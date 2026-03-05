import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { offlineDB } from './lib/offline/db'
import { networkMonitor } from './lib/offline/network'
import { syncEngine } from './lib/offline/sync'
import { applyInitialTheme } from './lib/theme'

applyInitialTheme()

async function initializeOfflineMode() {
  try {
    // Initialize IndexedDB
    console.log('[Offline] Initializing IndexedDB...')
    await offlineDB.init()

    // Initialize network monitoring
    console.log('[Offline] Starting network monitoring...')
    networkMonitor.listen((status) => {
      console.log(`[Offline] Network status: ${status.isOnline ? 'online' : 'offline'}`)
    })

    // Setup auto-sync on network restoration
    console.log('[Offline] Sync engine ready')

    // Register service worker (skip in development)
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      try {
        console.log('[Service Worker] Registering service worker...')
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
        })
        console.log('[Service Worker] Registered successfully:', registration)

        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[Service Worker] Update available')
              }
            })
          }
        })
      } catch (error) {
        console.warn('[Service Worker] Registration failed:', error)
      }
    } else if (!import.meta.env.PROD && 'serviceWorker' in navigator) {
      console.log('[Service Worker] Skipped in development mode')
    }
  } catch (error) {
    console.error('[Offline] Initialization failed:', error)
  }
}

function mount() {
  try {
    createRoot(document.getElementById('root')!).render(<App />)
  } catch (e: any) {
    console.error('Render error', e)
    const el = document.getElementById('root')!
    el.innerHTML = '<pre style="color:crimson; padding:20px;">Render error: ' + (e && e.message ? e.message : String(e)) + '</pre>'
  }
}

window.addEventListener('error', (ev) => {
  const el = document.getElementById('root')!
  el.innerHTML = '<pre style="color:crimson; padding:20px;">Uncaught error: ' + (ev && (ev as any).message ? (ev as any).message : String(ev)) + '</pre>'
})

window.addEventListener('unhandledrejection', (ev:any) => {
  const el = document.getElementById('root')!
  el.innerHTML = '<pre style="color:crimson; padding:20px;">Unhandled rejection: ' + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason)) + '</pre>'
})

// Initialize offline mode first, then mount app
initializeOfflineMode().then(mount).catch((error) => {
  console.error('Failed to initialize offline mode:', error)
  mount() // Mount app anyway
})


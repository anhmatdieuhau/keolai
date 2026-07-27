'use client'

import { useState, useEffect, useCallback } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  onAuthStateChanged, signOut,
} from 'firebase/auth'
import './portal.css'

import DashboardTab from './components/DashboardTab'
import ArticlesTab from './components/ArticlesTab'
import SeoTab from './components/SeoTab'
import TopicsTab from './components/TopicsTab'
import CostsTab from './components/CostsTab'

// ─── Firebase init ────────────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: 'keolai-63ec1.firebaseapp.com',
  projectId: 'keolai-63ec1',
  storageBucket: 'keolai-63ec1.firebasestorage.app',
  messagingSenderId: '675411800433',
  appId: '1:675411800433:web:8b5f7e40ce80504a5f46d0',
  measurementId: 'G-HTM7BNXXJ7',
}

let app, auth
if (firebaseConfig.apiKey) {
  try {
    app = getApps().find(a => a.name === 'portal') || initializeApp(firebaseConfig, 'portal')
    auth = getAuth(app)
  } catch (e) {
    try {
      app = initializeApp(firebaseConfig)
      auth = getAuth(app)
    } catch { /* demo mode */ }
  }
}

const provider = new GoogleAuthProvider()
const PORTAL_API = 'https://us-central1-keolai-63ec1.cloudfunctions.net/portalData'
const SECRET_STORAGE_KEY = 'keolai_portal_secret'

// ─── Tab config ───────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Tổng Quan', icon: '📊', section: 'overview' },
  { id: 'articles',  label: 'Bài Viết',  icon: '📝', section: 'articles' },
  { id: 'seo',       label: 'SEO & GSC', icon: '🔍', section: 'seo' },
  { id: 'topics',    label: 'Topics',    icon: '💡', section: 'topics' },
  { id: 'costs',     label: 'Chi Phí',   icon: '💰', section: 'costs' },
]

// ─── API helper ───────────────────────────────────────────
async function fetchPortalData(section, secret) {
  const res = await fetch(`${PORTAL_API}?section=${section}`, {
    headers: { 'x-app-secret': secret },
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

// ─── Login Screen ─────────────────────────────────────────
function LoginScreen() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!auth) return setError('Firebase chưa được cấu hình')
    setLoading(true)
    setError('')
    try {
      await signInWithPopup(auth, provider)
    } catch (e) {
      setError('Đăng nhập thất bại: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="portal-login-wrap">
      <div className="portal-login-card">
        <div className="portal-login-logo">KL</div>
        <div className="portal-login-title">KeoLai Portal</div>
        <div className="portal-login-subtitle">
          Trung tâm điều hành nội dung & SEO<br />
          keolaigiamhom.vn
        </div>
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '10px 14px',
            color: '#fca5a5', fontSize: 13, marginBottom: 16, textAlign: 'left',
          }}>
            {error}
          </div>
        )}
        <button className="portal-google-btn" onClick={handleLogin} disabled={loading}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.99 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập bằng Google'}
        </button>
        <div className="portal-login-note">
          Chỉ dành cho quản trị viên keolaigiamhom.vn
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────
function Sidebar({ user, activeTab, onTabChange, topicCount, pendingCount }) {
  function handleSignOut() {
    sessionStorage.removeItem(SECRET_STORAGE_KEY)
    if (auth) signOut(auth)
  }

  return (
    <aside className="portal-sidebar">
      {/* Brand */}
      <div className="portal-sidebar-header">
        <div className="portal-sidebar-logo">KL</div>
        <div className="portal-sidebar-brand">
          <div className="portal-sidebar-brand-name">KeoLai Portal</div>
          <div className="portal-sidebar-brand-sub">Operations Dashboard</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="portal-sidebar-nav">
        <div className="portal-nav-group">
          <div className="portal-nav-group-label">Menu chính</div>
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`portal-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="portal-nav-icon">{tab.icon}</span>
              {tab.label}
              {tab.id === 'topics' && pendingCount <= 3 && pendingCount >= 0 && (
                <span className="portal-nav-badge">{pendingCount}</span>
              )}
              {tab.id === 'topics' && pendingCount > 3 && (
                <span className="portal-nav-badge green">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        <div className="portal-nav-group">
          <div className="portal-nav-group-label">Công cụ</div>
          <a
            href="/cms"
            className="portal-nav-item"
            target="_self"
          >
            <span className="portal-nav-icon">✍️</span>
            CMS (Viết bài)
          </a>
          <a
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noopener noreferrer"
            className="portal-nav-item"
          >
            <span className="portal-nav-icon">🔍</span>
            Google Search Console
          </a>
          <a
            href="https://console.firebase.google.com/project/keolai-63ec1"
            target="_blank"
            rel="noopener noreferrer"
            className="portal-nav-item"
          >
            <span className="portal-nav-icon">🔥</span>
            Firebase Console
          </a>
          <a
            href="https://analytics.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="portal-nav-item"
          >
            <span className="portal-nav-icon">📈</span>
            Google Analytics
          </a>
        </div>
      </nav>

      {/* User + Logout */}
      <div className="portal-sidebar-footer">
        <div className="portal-user-info">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="portal-user-avatar" />
          ) : (
            <div className="portal-user-avatar" style={{ display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#94a3b8' }}>
              {user?.displayName?.[0] || '?'}
            </div>
          )}
          <div className="portal-user-name">{user?.displayName || user?.email || 'Admin'}</div>
        </div>
        <button className="portal-logout-btn" onClick={handleSignOut}>
          <span>→</span> Đăng xuất
        </button>
      </div>
    </aside>
  )
}

// ─── Main Portal App ──────────────────────────────────────
function PortalApp({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [tabData, setTabData] = useState({})
  const [loading, setLoading] = useState({})
  const [errors, setErrors] = useState({})
  const [secret, setSecret] = useState('')
  const [secretInput, setSecretInput] = useState('')
  const [showSecretForm, setShowSecretForm] = useState(true)

  // Restore secret from this browser tab's session only (never bundled into public JS)
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem(SECRET_STORAGE_KEY) : null
    if (stored) {
      setSecret(stored)
      setShowSecretForm(false)
    }
  }, [])

  // Load data for a section
  const loadSection = useCallback(async (sectionId) => {
    const tab = TABS.find(t => t.id === sectionId)
    if (!tab) return
    if (!secret) { setShowSecretForm(true); return }

    setLoading(prev => ({ ...prev, [sectionId]: true }))
    setErrors(prev => ({ ...prev, [sectionId]: null }))

    try {
      const data = await fetchPortalData(tab.section, secret)
      setTabData(prev => ({ ...prev, [sectionId]: data }))
    } catch (err) {
      setErrors(prev => ({ ...prev, [sectionId]: err.message }))
    } finally {
      setLoading(prev => ({ ...prev, [sectionId]: false }))
    }
  }, [secret])

  // Load initial tab on mount
  useEffect(() => {
    if (secret) loadSection('dashboard')
  }, [secret])

  // Load tab when switching
  useEffect(() => {
    if (secret && !tabData[activeTab]) loadSection(activeTab)
  }, [activeTab, secret])

  function handleTabChange(tabId) {
    setActiveTab(tabId)
  }

  function handleRefresh() {
    loadSection(activeTab)
  }

  function handleAction(action) {
    if (action === 'cms') window.location.href = '/cms'
    if (action === 'tab-topics') handleTabChange('topics')
    if (!tabData[action]) loadSection(action)
    else handleTabChange(action)
  }

  function handleSecretSubmit(e) {
    e.preventDefault()
    const value = secretInput.trim()
    if (value) {
      sessionStorage.setItem(SECRET_STORAGE_KEY, value)
      setSecret(value)
      setShowSecretForm(false)
    }
  }

  const currentTabConfig = TABS.find(t => t.id === activeTab)
  const overviewData = tabData['dashboard']
  const pendingCount = overviewData?.topics?.pending ?? -1

  // Secret input screen
  if (showSecretForm) {
    return (
      <div className="portal-root" style={{ minHeight: '100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f0f4f8' }}>
        <div className="card" style={{ width: 400, padding: 0 }}>
          <div className="card-header">
            <span className="card-title">🔑 Cần App Secret</span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              Portal cần <strong>APP_CLIENT_SECRET</strong> để gọi API. Lấy secret trong Firebase Console → Functions → Secrets (giá trị của <code>APP_CLIENT_SECRET</code>).
            </p>
            <form onSubmit={handleSecretSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <input
                className="filter-input"
                type="password"
                placeholder="Nhập APP_CLIENT_SECRET..."
                value={secretInput}
                onChange={e => setSecretInput(e.target.value)}
                autoFocus
              />
              <button className="btn btn-primary btn-lg" type="submit">Xác nhận</button>
            </form>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12 }}>
              Secret chỉ lưu tạm trong phiên trình duyệt này (sessionStorage) — sẽ mất khi đóng tab hoặc đăng xuất.
              Không đặt secret vào biến <code>NEXT_PUBLIC_*</code> trong <code>.env.local</code>: mọi biến bắt đầu bằng <code>NEXT_PUBLIC_</code> bị nhúng thẳng vào file JS công khai, ai xem mã nguồn trang cũng lấy được.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="portal-root">
      <div className="portal-app">
        <Sidebar
          user={user}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          pendingCount={pendingCount}
        />

        <div className="portal-content">
          {/* Topbar */}
          <div className="portal-topbar">
            <div>
              <div className="portal-topbar-title">
                {currentTabConfig?.icon} {currentTabConfig?.label}
              </div>
              <div className="portal-topbar-subtitle">keolaigiamhom.vn</div>
            </div>
            <div className="portal-topbar-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleRefresh}
                disabled={loading[activeTab]}
                title="Làm mới dữ liệu"
              >
                {loading[activeTab] ? '⏳' : '🔄'} Refresh
              </button>
              <a href="/cms" className="btn btn-primary btn-sm">
                ✍️ CMS
              </a>
            </div>
          </div>

          {/* Tab Content */}
          <div className="portal-page">
            {errors[activeTab] && (
              <div className="alert alert-danger" style={{ marginBottom: 20 }}>
                <div className="alert-text">
                  <div className="alert-title">❌ Lỗi tải dữ liệu</div>
                  <div className="alert-body">{errors[activeTab]}</div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={handleRefresh}>Thử lại</button>
              </div>
            )}

            {loading[activeTab] && !tabData[activeTab] ? (
              <div className="portal-loading">
                <div className="portal-spinner" />
                <span>Đang tải {currentTabConfig?.label}...</span>
              </div>
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <DashboardTab data={tabData.dashboard} onAction={handleAction} />
                )}
                {activeTab === 'articles' && (
                  <ArticlesTab data={tabData.articles} />
                )}
                {activeTab === 'seo' && (
                  <SeoTab data={tabData.seo} />
                )}
                {activeTab === 'topics' && (
                  <TopicsTab
                    data={tabData.topics}
                    appSecret={secret}
                    onRefresh={() => {
                      loadSection('topics')
                      loadSection('dashboard')
                    }}
                  />
                )}
                {activeTab === 'costs' && (
                  <CostsTab data={tabData.costs} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Root Export ──────────────────────────────────────────
export default function PortalPage() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    if (!auth) { setAuthLoading(false); return }
    return onAuthStateChanged(auth, u => {
      setUser(u)
      setAuthLoading(false)
    })
  }, [])

  if (authLoading) {
    return (
      <div className="portal-root" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="portal-spinner" style={{ margin: '0 auto 12px', borderTopColor: '#10b981' }} />
          <div style={{ color: '#8b949e', fontSize: 14 }}>Đang xác thực...</div>
        </div>
      </div>
    )
  }

  if (!user) return <div className="portal-root"><LoginScreen /></div>

  return <PortalApp user={user} />
}

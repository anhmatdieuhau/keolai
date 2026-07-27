'use client'

import { useState, useEffect, useCallback } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  onAuthStateChanged, signOut,
} from 'firebase/auth'
import './portal.css'

import { IconOverview, IconArticles, IconSeo, IconTopics, IconCosts, IconRefresh, IconLogout, IconKey, IconClock, IconFire, IconTrend, IconGoogle } from './components/Icons'

import DashboardTab from './components/DashboardTab'
import ArticlesTab from './components/ArticlesTab'
import SeoTab from './components/SeoTab'
import TopicsTab from './components/TopicsTab'
import CostsTab from './components/CostsTab'

// ─── Firebase init ────────────────────────────────────────
// The Web API key is not a secret (Firebase scopes access via Authorized
// Domains + Firestore/Auth rules, not key secrecy — see
// https://firebase.google.com/docs/projects/api-keys), so it's safe and
// correct to hardcode alongside the rest of this config rather than depend
// on a build-time env var that CI doesn't set.
const firebaseConfig = {
  apiKey: 'AIzaSyBXm5VSqqr0yjVWdREhDEo8cOnH_JC029k',
  authDomain: 'keolai-63ec1.firebaseapp.com',
  projectId: 'keolai-63ec1',
  storageBucket: 'keolai-63ec1.firebasestorage.app',
  messagingSenderId: '675411800433',
  appId: '1:675411800433:web:8b5f7e40ce80504a5f46d0',
  measurementId: 'G-HTM7BNXXJ7',
}

let app, auth
try {
  app = getApps().find(a => a.name === 'portal') || initializeApp(firebaseConfig, 'portal')
  auth = getAuth(app)
} catch (e) {
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
  } catch { /* demo mode */ }
}

const provider = new GoogleAuthProvider()
const PORTAL_API = 'https://us-central1-keolai-63ec1.cloudfunctions.net/portalData'
const SECRET_STORAGE_KEY = 'keolai_portal_secret'

// ─── Tab config ───────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Tổng Quan', icon: IconOverview, section: 'overview' },
  { id: 'articles',  label: 'Bài Viết',  icon: IconArticles, section: 'articles' },
  { id: 'seo',       label: 'SEO & GSC', icon: IconSeo, section: 'seo' },
  { id: 'topics',    label: 'Topics',    icon: IconTopics, section: 'topics' },
  { id: 'costs',     label: 'Chi Phí',   icon: IconCosts, section: 'costs' },
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
          <div className="alert alert-danger" style={{ marginBottom: 16, textAlign: 'left' }}>
            <div className="alert-text"><div className="alert-title">Đăng nhập thất bại</div><div className="alert-body">{error}</div></div>
          </div>
        )}
        <button className="portal-google-btn" onClick={handleLogin} disabled={loading}>
          <IconGoogle />
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
              <span className="portal-nav-icon"><tab.icon size={18} /></span>
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
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noopener noreferrer"
            className="portal-nav-item"
          >
            <span className="portal-nav-icon"><IconSeo size={16} /></span>
            Google Search Console
          </a>
          <a
            href="https://console.firebase.google.com/project/keolai-63ec1"
            target="_blank"
            rel="noopener noreferrer"
            className="portal-nav-item"
          >
            <span className="portal-nav-icon"><IconFire size={16} /></span>
            Firebase Console
          </a>
          <a
            href="https://analytics.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="portal-nav-item"
          >
            <span className="portal-nav-icon"><IconTrend size={16} /></span>
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
            <div className="portal-user-avatar" style={{ display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#9E9C99' }}>
              {user?.displayName?.[0] || '?'}
            </div>
          )}
          <div className="portal-user-name">{user?.displayName || user?.email || 'Admin'}</div>
        </div>
        <button className="portal-logout-btn" onClick={handleSignOut}>
          <IconLogout size={16} /> Đăng xuất
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
            <span className="card-title"><IconKey size={16} /> Cần App Secret</span>
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
                {currentTabConfig?.icon && <currentTabConfig.icon size={18} />} {currentTabConfig?.label}
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
                {loading[activeTab] ? <IconClock size={16} /> : <IconRefresh size={16} />} Refresh
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="portal-page">
            {errors[activeTab] && (
              <div className="alert alert-danger" style={{ marginBottom: 20 }}>
                <div className="alert-text">
                  <div className="alert-title">Lỗi tải dữ liệu</div>
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
      <div className="portal-root" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--p-bg)' }}>
        <div className="skeleton" style={{ width: 320, height: 200, borderRadius: 'var(--p-radius)' }} />
      </div>
    )
  }

  if (!user) return <div className="portal-root"><LoginScreen /></div>

  return <PortalApp user={user} />
}

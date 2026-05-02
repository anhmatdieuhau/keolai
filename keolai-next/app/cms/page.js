'use client'

import { useState, useEffect } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth'

// Firebase config — reuse existing project
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-key',
  authDomain: 'keolai-63ec1.firebaseapp.com',
  projectId: 'keolai-63ec1',
  storageBucket: 'keolai-63ec1.firebasestorage.app',
  messagingSenderId: '0',
  appId: '1:0:web:0',
}

let app, auth
try {
  app = initializeApp(firebaseConfig, 'cms')
  auth = getAuth(app)
} catch (err) {
  try { app = initializeApp(firebaseConfig); auth = getAuth(app) } catch (e) { /* demo mode */ }
}

const provider = new GoogleAuthProvider()
const CMS_API = 'https://us-central1-keolai-63ec1.cloudfunctions.net'

function formatTime(d) {
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function slugify(t) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)
}

// ─── Login Screen ───
function LoginScreen() {
  const [loading, setLoading] = useState(false)
  const handleLogin = async () => {
    if (!auth) return alert('Firebase chưa được cấu hình')
    setLoading(true)
    try { await signInWithPopup(auth, provider) }
    catch (e) { alert('Đăng nhập thất bại: ' + e.message) }
    finally { setLoading(false) }
  }
  return (
    <div className="cms-login">
      <div className="cms-login-card">
        <div className="cms-login-icon">KL</div>
        <h1>KeoLai CMS</h1>
        <p>Quản lý nội dung bằng AI cho keolaigiamhom.vn</p>
        <button className="cms-google-btn" onClick={handleLogin} disabled={loading}>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.99 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập bằng Google'}
        </button>
        <span className="cms-login-footer">Dành cho quản trị viên keolaigiamhom.vn</span>
      </div>
    </div>
  )
}

// ─── Chat Screen ───
function ChatScreen({ user }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [images, setImages] = useState([])
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const chatRef = { current: null }
  const inputRef = { current: null }
  const fileRef = { current: null }

  // Auto-scroll
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, generating])

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files).slice(0, 5 - images.length)
    setImages(prev => [...prev, ...files.map(f => ({ file: f, url: URL.createObjectURL(f) }))].slice(0, 5))
    e.target.value = ''
  }

  const removeImage = (i) => {
    setImages(prev => { URL.revokeObjectURL(prev[i].url); return prev.filter((_, idx) => idx !== i) })
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text && !images.length) return
    if (generating) return

    const userMsg = { id: Date.now(), type: 'user', text, images: images.map(i => i.url), time: new Date() }
    setMessages(prev => [...prev, userMsg])

    // Read images as base64
    const imgData = []
    for (const img of images) {
      const b64 = await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(img.file) })
      imgData.push(b64)
    }

    setInput('')
    setImages([])
    setGenerating(true)

    try {
      const res = await fetch(`${CMS_API}/cmsGenerateArticle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text, images: imgData, userId: user.uid }),
      })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const data = await res.json()
      setMessages(prev => [...prev, {
        id: Date.now() + 1, type: 'ai', text: 'Đây là bài viết AI đã tạo:',
        article: { title: data.title || 'Bài viết mới', content: data.content || '', slug: data.slug || slugify(data.title || ''), description: data.description || '' },
        time: new Date(),
      }])
    } catch (err) {
      // Demo/offline mode
      const title = `Kỹ thuật ${text.slice(0, 50)}`
      const content = `<h2>Giới thiệu</h2><p>${text}</p><h2>Hướng dẫn chi tiết</h2><p>Cây keo lai AH1 là giống cây lâm nghiệp chủ lực tại Việt Nam, được trồng phổ biến ở các vùng Đông Nam Bộ, Tây Nguyên và Bắc Trung Bộ.</p><p>Với đặc tính sinh trưởng nhanh, thân thẳng và khả năng thích nghi tốt, keo lai AH1 là lựa chọn hàng đầu cho các dự án trồng rừng kinh tế.</p><h2>Kỹ thuật chăm sóc</h2><p>Trong giai đoạn 3 tháng đầu, cần chú ý tưới nước đều đặn, làm cỏ xung quanh gốc và bón phân NPK theo tỷ lệ 16-16-8.</p>`
      setMessages(prev => [...prev, {
        id: Date.now() + 1, type: 'ai', text: 'Đây là bài viết AI đã tạo (demo mode):',
        article: { title, content, slug: slugify(title), description: text.slice(0, 160) },
        time: new Date(),
      }])
    } finally { setGenerating(false) }
  }

  const handlePublish = async (article) => {
    setPublishing(true)
    setMessages(prev => [...prev, { id: Date.now(), type: 'system', text: 'Đang đăng bài viết...' }])
    try {
      const res = await fetch(`${CMS_API}/cmsPublishArticle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...article, userId: user.uid }),
      })
      const url = res.ok ? (await res.json()).url : `https://keolaigiamhom.vn/articles/${article.slug}/`
      setMessages(prev => [...prev, { id: Date.now() + 1, type: 'ai', published: { title: article.title, url }, time: new Date() }])
    } catch {
      const url = `https://keolaigiamhom.vn/articles/${article.slug}/`
      setMessages(prev => [...prev, { id: Date.now() + 1, type: 'ai', published: { title: article.title, url }, time: new Date() }])
    } finally { setPublishing(false) }
  }

  const handleCopy = (article) => {
    const plain = `${article.title}\n\n${article.content.replace(/<[^>]*>/g, '\n').replace(/\n{3,}/g, '\n\n').trim()}`
    navigator.clipboard.writeText(plain)
    setMessages(prev => [...prev, { id: Date.now(), type: 'system', text: 'Đã copy nội dung!' }])
  }

  const handleEdit = (article) => {
    setInput(`Chỉnh sửa bài "${article.title}": `)
    inputRef.current?.focus()
  }

  return (
    <>
      {/* Top Bar */}
      <div className="cms-topbar">
        <div className="cms-topbar-logo">
          <span>KL</span> KeoLai CMS
        </div>
        <button className="cms-icon-btn" onClick={() => auth && signOut(auth)} title="Đăng xuất">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>

      {/* Chat */}
      <div className="cms-chat" ref={el => chatRef.current = el}>
        {messages.length === 0 && (
          <div className="cms-welcome">
            <div className="cms-welcome-icon">KL</div>
            <h2>Xin chào, {user.displayName?.split(' ')[0] || 'bạn'}!</h2>
            <p>Upload ảnh vườn ươm và mô tả tình trạng — AI sẽ viết bài cho bạn.</p>
            <div className="cms-quick-actions">
              <button onClick={() => { setInput('Viết bài về kỹ thuật chăm sóc cây keo lai 3 tháng tuổi'); inputRef.current?.focus() }}>Viết bài kỹ thuật</button>
              <button onClick={() => { setInput('Chia sẻ kinh nghiệm ươm giống keo lai AH1 từ giâm đọt'); inputRef.current?.focus() }}>Ươm giống</button>
              <button onClick={() => fileRef.current?.click()}>Upload ảnh</button>
            </div>
          </div>
        )}

        {messages.map(msg => {
          if (msg.type === 'system') return <div key={msg.id} className="cms-system-msg">{msg.text}</div>
          if (msg.type === 'user') return (
            <div key={msg.id} className="cms-msg cms-msg-user">
              {msg.images?.length > 0 && <div className="cms-msg-images">{msg.images.map((s, i) => <img key={i} src={s} alt="" />)}</div>}
              <div className="cms-bubble">{msg.text}</div>
              <span className="cms-msg-time">{formatTime(msg.time)}</span>
            </div>
          )
          if (msg.type === 'ai') {
            if (msg.published) return (
              <div key={msg.id} className="cms-msg cms-msg-ai">
                <div className="cms-published">
                  <div className="cms-published-icon">✓</div>
                  <h3>Đã đăng thành công!</h3>
                  <p>Bài viết đã live trên keolaigiamhom.vn</p>
                  <a href={msg.published.url} target="_blank" rel="noopener noreferrer">{msg.published.url.replace('https://', '')}</a>
                </div>
                <span className="cms-msg-time">{formatTime(msg.time)}</span>
              </div>
            )
            if (msg.article) return (
              <div key={msg.id} className="cms-msg cms-msg-ai">
                <div className="cms-bubble">{msg.text}</div>
                <div className="cms-article-preview">
                  <div className="cms-article-header">Bài viết AI</div>
                  <div className="cms-article-body">
                    <div className="cms-article-title">{msg.article.title}</div>
                    <div className="cms-article-content" dangerouslySetInnerHTML={{ __html: msg.article.content }} />
                  </div>
                  <div className="cms-article-actions">
                    <button className="cms-action-btn" onClick={() => handleCopy(msg.article)}>Copy</button>
                    <button className="cms-action-btn" onClick={() => handleEdit(msg.article)}>Sửa</button>
                    <button className="cms-action-btn cms-action-primary" onClick={() => handlePublish(msg.article)} disabled={publishing}>
                      {publishing ? 'Đang đăng...' : 'Đăng ngay'}
                    </button>
                  </div>
                </div>
                <span className="cms-msg-time">{formatTime(msg.time)}</span>
              </div>
            )
            return <div key={msg.id} className="cms-msg cms-msg-ai"><div className="cms-bubble">{msg.text}</div><span className="cms-msg-time">{formatTime(msg.time)}</span></div>
          }
          return null
        })}

        {generating && <div className="cms-typing"><div className="cms-dot"/><div className="cms-dot"/><div className="cms-dot"/></div>}
      </div>

      {/* Input */}
      <div className="cms-input-area">
        {images.length > 0 && (
          <div className="cms-upload-strip">
            {images.map((img, i) => (
              <div key={i} className="cms-thumb-wrap">
                <img src={img.url} alt="" />
                <button onClick={() => removeImage(i)}>×</button>
              </div>
            ))}
          </div>
        )}
        <div className="cms-input-row">
          <button className="cms-media-btn" onClick={() => fileRef.current?.click()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>
          <input ref={el => fileRef.current = el} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: 'none' }} />
          <textarea
            ref={el => inputRef.current = el}
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Mô tả hoặc yêu cầu chỉnh sửa..."
            rows={1}
          />
          <button className="cms-send-btn" onClick={handleSend} disabled={(!input.trim() && !images.length) || generating}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main Page ───
export default function CMSPage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) { setLoading(false); return }
    return onAuthStateChanged(auth, u => { setUser(u); setLoading(false) })
  }, [])

  if (loading) return <div className="cms-app"><div className="cms-login"><div className="cms-spinner" /></div></div>

  return (
    <div className="cms-app">
      {user ? <ChatScreen user={user} /> : <LoginScreen />}
    </div>
  )
}

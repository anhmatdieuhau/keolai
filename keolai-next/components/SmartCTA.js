"use client";

import { useState, useRef } from "react";

export default function SmartCTA({ article }) {
  const [status, setStatus] = useState(null);
  const formRef = useRef(null);
  
  // Default values
  let ctaType = article.ctaType || "phone"; 
  let title = article.cta_text || "Đặt giống Keo Lai AH1 ngay hôm nay";
  let desc = article.cta_goal || "Cây giống giâm đọt 2-3 tháng, đạt chuẩn xuất vườn. Giấy chứng nhận nguồn gốc đầy đủ. Giao tận vườn toàn quốc.";
  
  // Auto-deduce based on content or keywords if not specified
  if (!article.ctaType) {
    const kw = (article.keywords || "").toLowerCase();
    if (kw.includes("kỹ thuật") || kw.includes("trồng") || kw.includes("bệnh")) {
      ctaType = "lead";
      title = "Nhận tài liệu kỹ thuật & Báo giá";
      desc = "Để lại số điện thoại, chúng tôi sẽ gửi cẩm nang kỹ thuật trồng và báo giá ưu đãi qua Zalo.";
    } else if (kw.includes("giá") || kw.includes("chi phí")) {
      ctaType = "lead";
      title = "Nhận báo giá sỉ mới nhất";
      desc = "Để lại thông tin để nhận bảng báo giá chiết khấu cho đơn hàng lớn ngay hôm nay.";
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    
    let utmData = {};
    try { utmData = JSON.parse(sessionStorage.getItem("utm_data") || "{}"); } catch { /* ignore */ }

    const fd = new FormData(e.target);
    const body = {
      name: "Khách đọc bài",
      phone: fd.get("phone"),
      source: `article_cta_${article.slug}`,
      utm: utmData,
    };

    try {
      const res = await fetch("https://us-central1-keolai-63ec1.cloudfunctions.net/submitLead", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-App-Secret": "KL-Secret-Secure-2024-v1" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setStatus("success");
        formRef.current?.reset();
        if (typeof window.gtag === "function") {
          window.gtag("event", "generate_lead", { event_category: "Lead Form", event_label: "Article CTA" });
        }
        if (typeof window.fbq === "function") {
          window.fbq("track", "Lead", { content_name: "Article CTA" });
        }
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  if (ctaType === "lead") {
    return (
      <section className="article-cta" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h3>{title}</h3>
        <p>{desc}</p>
        {status === "success" ? (
          <div className="form-message success" style={{ background: '#dcfce7', color: '#166534', padding: '12px', borderRadius: '8px' }}>
            Đăng ký thành công! Chúng tôi sẽ liên hệ sớm.
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', maxWidth: '400px', margin: '0 auto' }}>
            <input 
              type="tel" 
              name="phone" 
              placeholder="Nhập số điện thoại (Zalo)" 
              pattern="[0-9]{9,11}" 
              required 
              inputMode="numeric"
              style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }}
            />
            <button type="submit" className="btn" style={{ padding: '12px 24px' }} disabled={status === "loading"}>
              {status === "loading" ? "..." : "NHẬN NGAY"}
            </button>
          </form>
        )}
        {status === "error" && <div className="form-message error" style={{ color: 'red', marginTop: '8px' }}>Có lỗi xảy ra, thử lại sau.</div>}
      </section>
    );
  }

  if (ctaType === "zalo") {
    return (
      <section className="article-cta">
        <h3>{title}</h3>
        <p>{desc}</p>
        <a href="https://zalo.me/0907282960?text=Chào%20anh/chị,%20tôi%20quan%20tâm%20đến%20bài%20viết%20trên%20web" target="_blank" rel="noreferrer" className="btn" style={{ background: '#0068ff' }}>
          Nhắn Zalo Tư Vấn
        </a>
      </section>
    );
  }

  // Default: Phone
  return (
    <section className="article-cta">
      <h3>{title}</h3>
      <p>{desc}</p>
      <a href="tel:0907282960" className="cta-btn">Gọi 0907.282.960</a>
      <span className="cta-phone">Hoặc nhắn tin Zalo cùng số</span>
    </section>
  );
}

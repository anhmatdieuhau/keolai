"use client";
import { useState, useEffect, useRef } from "react";

export default function ExitPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const formRef = useRef(null);

  useEffect(() => {
    // Only show once per session
    if (sessionStorage.getItem("exit_popup_shown")) return;

    const handleMouseLeave = (e) => {
      // Check if mouse leaves through the top of the window (indicates going to close tab or URL bar)
      if (e.clientY <= 0) {
        setIsVisible(true);
        sessionStorage.setItem("exit_popup_shown", "true");
        document.removeEventListener("mouseleave", handleMouseLeave);
        
        if (typeof window.gtag === "function") {
          window.gtag("event", "exit_intent_popup_show", {
            event_category: "Engagement"
          });
        }
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, []);

  const closePopup = () => setIsVisible(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");

    let utmData = {};
    try { utmData = JSON.parse(sessionStorage.getItem("utm_data") || "{}"); } catch { /* ignore */ }

    const fd = new FormData(e.target);
    const body = {
      name: fd.get("name"),
      phone: fd.get("phone"),
      source: "exit_popup",
      utm: utmData,
    };

    try {
      const res = await fetch(
        "https://us-central1-keolai-63ec1.cloudfunctions.net/submitLead",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-App-Secret": "KL-Secret-Secure-2024-v1",
          },
          body: JSON.stringify(body),
        }
      );
      if (res.ok) {
        setStatus("success");
        formRef.current?.reset();
        if (typeof window.gtag === "function") {
          window.gtag("event", "generate_lead", {
            event_category: "Lead Form",
            event_label: "Exit Popup",
          });
        }
        if (typeof window.fbq === "function") {
          window.fbq("track", "Lead", { content_name: "Exit Popup" });
        }
        setTimeout(() => closePopup(), 3000);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.error("ExitPopup submit error:", err);
      setStatus("error");
    }
  };

  if (!isVisible) return null;

  return (
    <div className="exit-popup-overlay" onClick={closePopup}>
      <div className="exit-popup-content" onClick={(e) => e.stopPropagation()}>
        <button className="exit-popup-close" onClick={closePopup}>×</button>
        <div className="exit-popup-header">
          <h3>Đừng vội rời đi! 🌿</h3>
          <p>Nhận ngay báo giá ưu đãi và cẩm nang trồng rừng miễn phí.</p>
        </div>
        
        <form ref={formRef} onSubmit={handleSubmit} className="exit-popup-form">
          <input type="text" name="name" placeholder="Họ và tên" aria-label="Họ và tên" required />
          <input type="tel" name="phone" placeholder="Số điện thoại (Zalo)" aria-label="Số điện thoại (Zalo)" pattern="[0-9]{9,11}" required inputMode="numeric" />
          
          <button type="submit" className="btn btn-submit" disabled={status === "loading"}>
            {status === "loading" ? "Đang gửi..." : "NHẬN BÁO GIÁ NGAY"}
          </button>
          
          {status === "success" && <div className="form-message success">Đăng ký thành công! Chúng tôi sẽ liên hệ sớm.</div>}
          {status === "error" && <div className="form-message error">Có lỗi xảy ra. Xin vui lòng thử lại.</div>}
        </form>
      </div>
    </div>
  );
}

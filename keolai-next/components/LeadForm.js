"use client";
import { useState, useRef, useEffect } from "react";

/**
 * Enhanced Lead Form with:
 * - Social proof banner ("500+ khách hàng đã đặt mùa này")
 * - Micro-copy under each field to reduce anxiety
 * - Alternative Zalo CTA for users who prefer chat
 * - Progress indicator for multi-step feel
 * - GA4 tracking: lead_form_start, generate_lead, form_field_focus
 */
export default function LeadForm() {
  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [fieldsCompleted, setFieldsCompleted] = useState(0);
  const formRef = useRef(null);
  const formStarted = useRef(false);

  // Track completed fields for progress indicator
  const handleInputChange = () => {
    const form = formRef.current;
    if (!form) return;
    const inputs = form.querySelectorAll("input[name]:not([type=hidden])");
    let completed = 0;
    inputs.forEach((input) => {
      if (input.value.trim() && input.name !== "website") completed++;
    });
    setFieldsCompleted(completed);
  };

  const [variant, setVariant] = useState("A"); // "A" or "B"

  useEffect(() => {
    // A/B Testing assignment
    let assignedVariant = sessionStorage.getItem("lead_form_variant");
    if (!assignedVariant) {
      assignedVariant = Math.random() > 0.5 ? "B" : "A";
      sessionStorage.setItem("lead_form_variant", assignedVariant);
    }
    setVariant(assignedVariant);
    
    // Log variant exposure
    if (typeof window.gtag === "function") {
      window.gtag("event", "experiment_impression", {
        experiment_id: "lead_form_length",
        variant_id: assignedVariant
      });
    }

    const form = formRef.current;
    if (!form) return;
    const handleFocus = (e) => {
      if (!formStarted.current) {
        formStarted.current = true;
        if (typeof window.gtag === "function") {
          window.gtag("event", "lead_form_start", {
            event_category: "Lead Form",
            event_label: `Form Interaction Started - Variant ${assignedVariant}`,
          });
        }
      }
      // Track which field was focused
      if (typeof window.gtag === "function" && e.target.name) {
        window.gtag("event", "form_field_focus", {
          event_category: "Lead Form",
          event_label: e.target.name,
        });
      }
    };
    form.addEventListener("focusin", handleFocus);
    return () => form.removeEventListener("focusin", handleFocus);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");

    const fd = new FormData(e.target);
    // Honeypot
    if (fd.get("website")) {
      setStatus("success");
      formRef.current?.reset();
      return;
    }

    let utmData = {};
    try { utmData = JSON.parse(sessionStorage.getItem("utm_data") || "{}"); } catch { /* ignore */ }

    const body = {
      name: fd.get("name"),
      phone: fd.get("phone"),
      email: fd.get("email") || null,
      quantity: parseInt(fd.get("quantity")) || null,
      province: fd.get("province") || null,
      utm: utmData,
      variant: variant, // Send variant to backend if needed
      source: "main_lead_form"
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(
        "https://us-central1-keolai-63ec1.cloudfunctions.net/submitLead",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-App-Secret": "KL-Secret-Secure-2024-v1",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      if (res.ok) {
        setStatus("success");
        formRef.current?.reset();
        setFieldsCompleted(0);
        if (typeof window.gtag === "function") {
          window.gtag("event", "generate_lead", {
            event_category: "Lead Form",
            event_label: body.province || "Unknown",
            value: body.quantity || 0,
            variant: variant
          });
        }
        if (typeof window.fbq === "function") {
          window.fbq("track", "Lead", {
            value: body.quantity ? body.quantity * 1500 : 0,
            currency: "VND",
          });
        }
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.error("LeadForm submit error:", err);
      setStatus("error");
    }
  };

  // Progress: 5 fields total for A, 2 fields for B
  const totalFields = variant === "A" ? 5 : 2;
  const progressPct = Math.min(100, Math.round((fieldsCompleted / totalFields) * 100));

  return (
    <section className="section lead-section" id="lead-form">
      <div className="container">
        <div className="lead-grid">
          <div className="lead-info">
            <h2 className="lead-title">YÊU CẦU BÁO GIÁ</h2>
            <p className="lead-desc">
              Để lại thông tin, chúng tôi sẽ tư vấn chi tiết về số lượng, thời điểm xuất vườn và báo giá ưu đãi nhất.
            </p>
            <div className="lead-features">
              <div className="lead-feature"><span className="feature-line" /><span>HỖ TRỢ 24/7 QUA ZALO</span></div>
              <div className="lead-feature"><span className="feature-line" /><span>HỢP ĐỒNG PHÁP LÝ RÕ RÀNG</span></div>
              <div className="lead-feature"><span className="feature-line" /><span>GIAO CÂY TẬN VƯỜN TOÀN QUỐC</span></div>
            </div>

            {/* Social proof */}
            <div className="lead-social-proof">
              <div className="social-proof-badge">
                <span className="proof-number">500+</span>
                <span className="proof-text">khách hàng đã đặt mùa vụ 2025-2026</span>
              </div>
              <div className="proof-regions">
                Đồng Nai · Quảng Ngãi · Bình Định · Phú Yên · Gia Lai · Nghệ An
              </div>
            </div>
          </div>

          <div className="lead-form-wrap">
            {/* Progress bar */}
            <div className="form-progress">
              <div className="form-progress-bar" style={{ width: `${progressPct}%` }} />
              <span className="form-progress-text">
                {fieldsCompleted === 0
                  ? "Điền thông tin để nhận báo giá"
                  : fieldsCompleted >= totalFields
                    ? "Sẵn sàng gửi!"
                    : `${fieldsCompleted}/${totalFields} thông tin đã điền`}
              </span>
            </div>

            <form className="lead-form" ref={formRef} onSubmit={handleSubmit} autoComplete="on" onChange={handleInputChange}>
              <div className="form-group">
                <label htmlFor="leadName">HỌ TÊN</label>
                <input type="text" id="leadName" name="name" placeholder="Nguyễn Văn A" required autoComplete="name" />
                <span className="field-hint">Tên để chúng tôi liên hệ bạn</span>
              </div>
              <div className="form-group">
                <label htmlFor="leadPhone">SỐ ĐIỆN THOẠI (ZALO)</label>
                <input type="tel" id="leadPhone" name="phone" placeholder="0xxx xxx xxx" required autoComplete="tel" pattern="[0-9]{9,11}" />
                <span className="field-hint">Bảo mật — chỉ dùng để tư vấn</span>
              </div>
              
              {variant === "A" && (
                <>
                  <div className="form-group">
                    <label htmlFor="leadEmail">EMAIL <span className="field-optional">(không bắt buộc)</span></label>
                    <input type="email" id="leadEmail" name="email" placeholder="email@example.com" autoComplete="email" />
                    <span className="field-hint">Nhận tài liệu kỹ thuật miễn phí qua email</span>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="leadQty">SỐ LƯỢNG (VẠN)</label>
                      <input type="number" id="leadQty" name="quantity" placeholder="VD: 5" min="1" inputMode="numeric" />
                      <span className="field-hint">Ước tính để báo giá tốt hơn</span>
                    </div>
                    <div className="form-group">
                      <label htmlFor="leadProvince">TỈNH/THÀNH</label>
                      <input type="text" id="leadProvince" name="province" placeholder="Quang Nam" autoComplete="address-level1" list="provinceList" />
                      <span className="field-hint">Để tính cước vận chuyển</span>
                      <datalist id="provinceList">
                        <option value="Hồ Chí Minh" />
                        <option value="Hà Nội" />
                        <option value="Đà Nẵng" />
                        <option value="Đồng Nai" />
                        <option value="Bình Dương" />
                        <option value="Bình Phước" />
                        <option value="Tây Ninh" />
                        <option value="Bà Rịa - Vũng Tàu" />
                        <option value="Lâm Đồng" />
                        <option value="Đắk Lắk" />
                        <option value="Đắk Nông" />
                        <option value="Gia Lai" />
                        <option value="Kon Tum" />
                        <option value="Phú Yên" />
                        <option value="Bình Định" />
                        <option value="Quảng Ngãi" />
                        <option value="Quảng Nam" />
                      </datalist>
                    </div>
                  </div>
                </>
              )}
              {/* Honeypot */}
              <div style={{ position: "absolute", left: -9999, top: -9999 }} aria-hidden="true">
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <button type="submit" className="btn btn-submit" disabled={status === "loading"}>
                {status === "loading" ? "Đang gửi..." : "GỬI YÊU CẦU BÁO GIÁ →"}
              </button>
              <p className="form-note">Chúng tôi sẽ liên hệ trong vòng 2 giờ</p>

              {/* Zalo alternative CTA */}
              <div className="form-zalo-alt">
                <span className="form-divider-text">— hoặc liên hệ nhanh qua —</span>
                <a
                  href="https://zalo.me/0907282960?text=Ch%C3%A0o%20anh%2Fch%E1%BB%8B%2C%20em%20mu%E1%BB%91n%20%C4%91%E1%BA%B7t%20gi%E1%BB%91ng%20keo%20lai%20AH1%20%E1%BA%A1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-zalo"
                  onClick={() => {
                    if (typeof window.gtag === "function") {
                      window.gtag("event", "zalo_click", {
                        event_category: "Lead Form",
                        event_label: "form_zalo_alternative",
                        transport_type: "beacon",
                      });
                    }
                  }}
                >
                  Chat Zalo Ngay
                </a>
                <a
                  href="tel:0907282960"
                  className="btn btn-call"
                  onClick={() => {
                    if (typeof window.gtag === "function") {
                      window.gtag("event", "phone_click", {
                        event_category: "Lead Form",
                        event_label: "form_phone_alternative",
                        transport_type: "beacon",
                      });
                    }
                  }}
                >
                  Gọi 0907.282.960
                </a>
              </div>

              {status === "success" && (
                <div className="form-message success">
                  Gửi thành công! Chúng tôi sẽ liên hệ bạn trong vòng 2 giờ.
                </div>
              )}
              {status === "error" && (
                <div className="form-message error">
                  Có lỗi xảy ra. Vui lòng thử lại hoặc gọi <a href="tel:0907282960"><strong>0907.282.960</strong></a>.
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

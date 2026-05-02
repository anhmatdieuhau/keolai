"use client";
import Link from "next/link";
import Image from "next/image";

function trackFooterClick(action, label) {
  if (typeof window.gtag === "function") {
    window.gtag("event", action, {
      event_category: "Footer",
      event_label: label,
      transport_type: "beacon",
    });
  }
}

export default function Footer() {
  return (
    <footer className="footer" id="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="footer-logo">VƯỜN ƯƠM CÂY GIỐNG NGỌC SƠN</span>
            <p>Chuyên giâm đọt và ươm giống keo lai AH1. Hệ thống phun sương tự động, quy trình ươm 2–3 tháng đạt chuẩn xuất vườn.</p>
          </div>
          <div className="footer-contact">
            <div>Phone/Zalo: 0907 282 960</div>
            <div>Email: dtduy46@gmail.com</div>
            <div>Địa chỉ: 42, Ấp Quảng Phát, Xã Quảng Tiến, Trảng Bom, Đồng Nai</div>
            <div className="footer-social">
              <a
                href="https://zalo.me/0907282960"
                target="_blank"
                rel="noopener noreferrer"
                className="social-icon-link"
                aria-label="Zalo"
                onClick={() => trackFooterClick("zalo_click", "footer")}
              >
                <Image src="/icons/zalo.svg" alt="Zalo" width={32} height={32} />
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=100063555342233"
                target="_blank"
                rel="noopener noreferrer"
                className="social-icon-link"
                aria-label="Facebook"
                onClick={() => trackFooterClick("facebook_click", "footer")}
              >
                <Image src="/icons/messenger.svg" alt="Messenger" width={32} height={32} />
              </a>
            </div>
          </div>
          <div className="footer-links">
            <span className="footer-links-title">LIÊN KẾT NHANH</span>
            <Link href="/#specs" onClick={() => trackFooterClick("footer_nav", "san_pham")}>Sản phẩm</Link>
            <Link href="/#pricing" onClick={() => trackFooterClick("footer_nav", "bang_gia")}>Bảng giá</Link>
            <Link href="/#knowledge" onClick={() => trackFooterClick("footer_nav", "kien_thuc")}>Kiến thức</Link>
            <Link href="/#lead-form" onClick={() => trackFooterClick("footer_nav", "bao_gia")}>Báo giá</Link>
          </div>
          <div className="footer-map">
            <span className="footer-links-title">BẢN ĐỒ</span>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d489.6652969382489!2d106.99668734499558!3d10.939002757183284!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3174e1e6a4fc4bef%3A0xa522ba7385dd2f9f!2zVsaw4budbiDGsMahbSBOZ-G7jWMgU8ahbg!5e0!3m2!1sen!2s!4v1774145843398!5m2!1sen!2s"
              width="100%"
              height="200"
              style={{ border: 0, borderRadius: '8px' }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Vị trí Vườn ươm Ngọc Sơn"
            />
          </div>
        </div>
        <div className="footer-privacy">
          Website sử dụng cookies và công cụ phân tích (GA4, Microsoft Clarity) để cải thiện trải nghiệm.{" "}
          <Link href="/privacy">Chính sách bảo mật</Link>{" · "}
          <Link href="/terms">Điều khoản sử dụng</Link>
        </div>
        <div className="footer-bottom">
          Vườn Ươm Cây Giống Ngọc Sơn — Giống cây lâm nghiệp chất lượng cao. &copy; {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
}

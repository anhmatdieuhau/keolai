"use client";
import Image from "next/image";
import { useState, useEffect } from "react";

/**
 * Smart Floating Social Buttons with:
 * - Contextual Zalo message based on current section
 * - Pulse animation for Zalo (primary CTA)
 * - Auto-hide on scroll up, show on scroll down
 * - GA4 event tracking: zalo_click, messenger_click
 * - Expandable quick-actions tooltip
 */
export default function SocialFloat() {
  const [showTooltip, setShowTooltip] = useState(false);
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Auto-show tooltip after 15s if user hasn't interacted
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTooltip(true);
      // Auto-hide tooltip after 6s
      setTimeout(() => setShowTooltip(false), 6000);
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  // Smart scroll visibility
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          // Always show near top or bottom
          const nearBottom = currentY + window.innerHeight >= document.body.scrollHeight - 200;
          if (currentY < 100 || nearBottom) {
            setVisible(true);
          } else {
            setVisible(currentY < lastScrollY); // show on scroll up
          }
          setLastScrollY(currentY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // Build contextual Zalo message based on visible section
  const getZaloUrl = () => {
    const baseUrl = "https://zalo.me/0907282960";
    if (typeof window === "undefined") return baseUrl;

    // Detect which section is most visible
    const sections = [
      { id: "pricing", msg: "Chào anh/chị, em muốn hỏi về bảng giá keo lai AH1 ạ" },
      { id: "lead-form", msg: "Chào anh/chị, em muốn đặt giống keo lai AH1 ạ" },
      { id: "specs", msg: "Chào anh/chị, em muốn hỏi thông số kỹ thuật cây giống keo lai ạ" },
      { id: "knowledge", msg: "Chào anh/chị, em cần tư vấn kỹ thuật trồng keo lai ạ" },
    ];

    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight / 2 && rect.bottom > 0) {
          return `${baseUrl}?text=${encodeURIComponent(s.msg)}`;
        }
      }
    }
    return `${baseUrl}?text=${encodeURIComponent("Chào anh/chị, em muốn tư vấn về cây giống keo lai ạ")}`;
  };

  const trackClick = (channel, extra = {}) => {
    if (typeof window.gtag === "function") {
      window.gtag("event", `${channel}_click`, {
        event_category: "Contact",
        event_label: channel,
        transport_type: "beacon",
        ...extra,
      });
    }
  };

  return (
    <div
      className={`social-float-group ${visible ? "" : "social-float-hidden"}`}
      aria-label="Liên hệ nhanh"
    >
      {/* Zalo tooltip */}
      {showTooltip && (
        <div className="zalo-tooltip" onClick={() => setShowTooltip(false)}>
          <span>Chat Zalo để được tư vấn ngay!</span>
          <button className="tooltip-close" aria-label="Đóng">×</button>
        </div>
      )}

      {/* Zalo — Primary CTA with pulse */}
      <a
        href={getZaloUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="social-float-icon zalo-pulse"
        aria-label="Liên hệ qua Zalo"
        onClick={() => trackClick("zalo", { context: "floating_button" })}
        onMouseEnter={() => setShowTooltip(false)}
      >
        <Image src="/icons/zalo.svg" alt="Zalo" width={52} height={52} />
      </a>

      {/* Messenger */}
      <a
        href="https://m.me/100063555342233"
        target="_blank"
        rel="noopener noreferrer"
        className="social-float-icon"
        aria-label="Liên hệ qua Messenger"
        onClick={() => trackClick("messenger", { context: "floating_button" })}
      >
        <Image src="/icons/messenger.svg" alt="Messenger" width={44} height={44} />
      </a>

      {/* Phone call */}
      <a
        href="tel:0907282960"
        className="social-float-icon social-float-phone"
        aria-label="Gọi điện ngay"
        onClick={() => trackClick("phone", { context: "floating_button" })}
      >
        <svg className="phone-icon" viewBox="0 0 24 24" width="28" height="28" fill="#fff"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
      </a>
    </div>
  );
}

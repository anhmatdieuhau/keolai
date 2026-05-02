"use client";
import { useState } from "react";
import Script from "next/script";

const faqData = [
  { q: "Đặt hàng tối thiểu bao nhiêu cây?", a: "Đơn hàng tối thiểu từ 100 cây. Tuy nhiên, để tối ưu chi phí vận chuyển, chúng tôi khuyến nghị mua từ 1.000 cây trở lên." },
  { q: "Vận chuyển như thế nào? Chi phí ra sao?", a: "Chúng tôi giao hàng bằng xe tải chuyên dụng đến tận rẫy/vườn. Cước vận chuyển tính theo km và số lượng cây. Miễn phí giao từ 5 vạn cây." },
  { q: "Có xuất hoá đơn VAT không?", a: "Có. Chúng tôi xuất hoá đơn GTGT (VAT) đầy đủ, kèm hợp đồng mua bán và giấy chứng nhận nguồn gốc giống. Hỗ trợ đấu thầu cho các dự án lâm nghiệp." },
  { q: "Khi nào là thời điểm tốt nhất để trồng keo?", a: "Thời điểm trồng tốt nhất là đầu mùa mưa (tháng 5-7 ở miền Trung và Tây Nguyên, tháng 2-4 ở miền Bắc). Nên đặt hàng trước 1-2 tháng để đảm bảo nguồn cung." },
  { q: "Giống AH1 có ưu điểm gì so với các dòng khác?", a: "Giống AH1 là dòng keo lai giâm hom có sinh trưởng nhanh, thân thẳng, ít cành nhánh, năng suất gỗ cao. Phù hợp nhiều loại thổ nhưỡng từ miền Trung đến Tây Nguyên." },
  { q: "Có chính sách bảo hành không?", a: "Chúng tôi cam kết giao cây đạt tiêu chuẩn xuất vườn (chiều cao 25cm trở lên, rễ khoẻ, lá xanh tốt). Nếu phát hiện cây không đạt chất lượng khi nhận hàng, sẽ đổi trả miễn phí." },
];

// FAQPage JSON-LD for rich results in Google Search
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqData.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

export default function FAQ() {
  const [active, setActive] = useState(null);

  return (
    <section className="section bg-light" id="faq">
      <Script
        id="faq-schema"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="container">
        <div className="section-center">
          <h2 className="section-title">Hỏi đáp nhanh</h2>
        </div>
        <div className="faq-list">
          {faqData.map((item, i) => (
            <div key={i} className={`faq-item${active === i ? " active" : ""}`}>
              <button
                className="faq-question"
                aria-expanded={active === i}
                onClick={() => setActive(active === i ? null : i)}
              >
                {item.q}
                <span className="faq-chevron">+</span>
              </button>
              <div className="faq-answer" style={{ maxHeight: active === i ? "200px" : "0" }}>
                <div className="faq-answer-inner">{item.a}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

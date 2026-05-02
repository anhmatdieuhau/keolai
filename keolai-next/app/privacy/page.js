import Link from "next/link";

export const metadata = {
  title: "Chính sách bảo mật",
  description: "Chính sách bảo mật và quyền riêng tư của Vườn Ươm Cây Giống Ngọc Sơn — keolaigiamhom.vn",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <section className="article-hero" style={{ minHeight: 280 }}>
        <div className="hero-content">
          <div className="hero-breadcrumb">
            <Link href="/">Trang chủ</Link>
            <span>/</span>
            Chính sách bảo mật
          </div>
          <h1 className="hero-title" style={{ fontSize: "2rem" }}>Chính sách bảo mật</h1>
          <div className="hero-meta">
            <span>Cập nhật: 25 tháng 3, 2026</span>
          </div>
        </div>
      </section>

      <main className="article-body">
        <p>
          Vườn Ươm Cây Giống Ngọc Sơn (&quot;chúng tôi&quot;) cam kết bảo vệ quyền riêng tư của bạn khi sử dụng website{" "}
          <strong>keolaigiamhom.vn</strong>. Chính sách này giải thích cách chúng tôi thu thập, sử dụng và bảo vệ thông tin của bạn.
        </p>

        <h2>1. Thông tin chúng tôi thu thập</h2>
        <h3>Thông tin bạn cung cấp</h3>
        <p>
          Khi bạn điền form yêu cầu báo giá, chúng tôi thu thập: họ tên, số điện thoại, tỉnh/thành phố, và số lượng cây giống mong muốn.
          Thông tin này được dùng duy nhất để liên hệ tư vấn và báo giá cho bạn.
        </p>

        <h3>Thông tin tự động thu thập</h3>
        <p>Chúng tôi sử dụng các công cụ phân tích sau để cải thiện trải nghiệm website:</p>
        <p>
          <strong>Google Analytics 4 (GA4)</strong> — thu thập dữ liệu ẩn danh về lượt truy cập, trang được xem, thời gian sử dụng,
          nguồn truy cập và thiết bị.
          Xem thêm tại{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
            Chính sách bảo mật Google
          </a>.
        </p>
        <p>
          <strong>Microsoft Clarity</strong> — thu thập dữ liệu hành vi người dùng thông qua heatmaps (bản đồ nhiệt) và session replay
          (ghi lại phiên truy cập) nhằm hiểu cách bạn tương tác với website. Clarity sử dụng cookies bên thứ nhất và bên thứ ba.
          Xem thêm tại{" "}
          <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noopener noreferrer">
            Chính sách bảo mật Microsoft
          </a>.
        </p>

        <h2>2. Mục đích sử dụng</h2>
        <p>Chúng tôi sử dụng thông tin thu thập để:</p>
        <p>
          • Liên hệ tư vấn và báo giá khi bạn yêu cầu<br />
          • Cải thiện nội dung và trải nghiệm website<br />
          • Phân tích xu hướng truy cập để tối ưu sản phẩm<br />
          • Đảm bảo an ninh và phòng chống gian lận
        </p>

        <h2>3. Chia sẻ dữ liệu</h2>
        <p>
          Chúng tôi <strong>không bán</strong> thông tin cá nhân của bạn cho bên thứ ba.
          Dữ liệu phân tích ẩn danh được chia sẻ với Google và Microsoft thông qua các công cụ nêu trên
          theo chính sách bảo mật riêng của họ.
        </p>

        <h2>4. Cookies</h2>
        <p>
          Website sử dụng cookies để vận hành các công cụ phân tích (GA4, Clarity).
          Bạn có thể tắt cookies trong cài đặt trình duyệt, tuy nhiên một số tính năng có thể bị ảnh hưởng.
        </p>

        <h2>5. Bảo mật</h2>
        <p>
          Chúng tôi áp dụng các biện pháp bảo mật hợp lý để bảo vệ thông tin của bạn, bao gồm mã hóa SSL/TLS
          cho toàn bộ kết nối và giới hạn quyền truy cập dữ liệu.
        </p>

        <h2>6. Liên hệ</h2>
        <p>
          Nếu có thắc mắc về chính sách bảo mật, vui lòng liên hệ:<br />
          <a href="tel:0907282960">0907.282.960</a> (Phone/Zalo)<br />
          dtduy46@gmail.com<br />
          42, Ấp Quảng Phát, Xã Quảng Tiến, Trảng Bom, Đồng Nai
        </p>
      </main>
    </>
  );
}

import Link from "next/link";

export const metadata = {
  title: "Điều khoản sử dụng",
  description: "Điều khoản sử dụng website Vườn Ươm Cây Giống Ngọc Sơn — keolaigiamhom.vn",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://keolaigiamhom.vn/terms" },
};

export default function TermsPage() {
  return (
    <>
      <section className="article-hero" style={{ minHeight: 280 }}>
        <div className="hero-content">
          <div className="hero-breadcrumb">
            <Link href="/">Trang chủ</Link>
            <span>/</span>
            Điều khoản sử dụng
          </div>
          <h1 className="hero-title" style={{ fontSize: "2rem" }}>Điều khoản sử dụng</h1>
          <div className="hero-meta">
            <span>Cập nhật: 25 tháng 3, 2026</span>
          </div>
        </div>
      </section>

      <main className="article-body">
        <p>
          Chào mừng bạn đến với website <strong>keolaigiamhom.vn</strong> của Vườn Ươm Cây Giống Ngọc Sơn.
          Khi truy cập và sử dụng website, bạn đồng ý tuân thủ các điều khoản dưới đây.
        </p>

        <h2>1. Giới thiệu</h2>
        <p>
          Website keolaigiamhom.vn là kênh thông tin giới thiệu sản phẩm cây giống keo lai AH1 của Vườn Ươm Cây Giống Ngọc Sơn.
          Website cung cấp thông tin tham khảo về sản phẩm, bảng giá, kiến thức kỹ thuật và form yêu cầu báo giá.
          Đây không phải website thương mại điện tử — mọi giao dịch mua bán được thực hiện trực tiếp qua điện thoại hoặc gặp mặt.
        </p>

        <h2>2. Thông tin sản phẩm</h2>
        <p>
          • Bảng giá trên website mang tính <strong>tham khảo</strong> và có thể thay đổi theo mùa vụ, số lượng đặt hàng và thời điểm.<br />
          • Giá chính thức được xác nhận khi nhân viên liên hệ trực tiếp với bạn sau khi nhận yêu cầu báo giá.<br />
          • Thông số kỹ thuật (chiều cao, đường kính, tỷ lệ sống) là giá trị trung bình trong điều kiện ươm chuẩn. Kết quả thực tế có thể thay đổi tùy điều kiện thổ nhưỡng và chăm sóc.
        </p>

        <h2>3. Quy trình đặt hàng</h2>
        <p>
          • Bạn gửi yêu cầu qua form báo giá hoặc liên hệ trực tiếp qua SĐT/Zalo: <a href="tel:0907282960">0907.282.960</a>.<br />
          • Nhân viên sẽ liên hệ xác nhận số lượng, thời gian giao hàng và báo giá chính thức trong vòng 2 giờ làm việc.<br />
          • Hợp đồng và phương thức thanh toán được thỏa thuận trực tiếp giữa hai bên.
        </p>

        <h2>4. Giao hàng & Vận chuyển</h2>
        <p>
          • Miễn phí giao hàng nội tỉnh Đồng Nai cho đơn từ 5 vạn cây trở lên.<br />
          • Giao hàng liên tỉnh: phí vận chuyển được thông báo cụ thể khi báo giá.<br />
          • Cây giống được đóng gói cẩn thận, vận chuyển bằng xe chuyên dụng để đảm bảo chất lượng.
        </p>

        <h2>5. Chính sách đổi trả</h2>
        <p>
          • Kiểm tra cây giống ngay khi nhận hàng. Nếu phát hiện cây hư hỏng do vận chuyển, vui lòng thông báo trong vòng <strong>24 giờ</strong> kèm hình ảnh.<br />
          • Chúng tôi sẽ bù đắp hoặc giao lại cây thay thế cho số lượng bị hư hỏng theo xác nhận của hai bên.<br />
          • Tỷ lệ hao hụt tự nhiên (dưới 5%) không thuộc diện đổi trả.
        </p>

        <h2>6. Quyền sở hữu nội dung</h2>
        <p>
          Toàn bộ nội dung trên website (bài viết, hình ảnh, thiết kế) thuộc quyền sở hữu của Vườn Ươm Cây Giống Ngọc Sơn.
          Bạn không được sao chép, phân phối hoặc sử dụng cho mục đích thương mại mà không có sự đồng ý bằng văn bản.
        </p>

        <h2>7. Giới hạn trách nhiệm</h2>
        <p>
          • Website cung cấp kiến thức kỹ thuật mang tính tham khảo. Kết quả trồng trọt phụ thuộc vào nhiều yếu tố như thổ nhưỡng, khí hậu và kỹ thuật chăm sóc.<br />
          • Chúng tôi không chịu trách nhiệm về thiệt hại gián tiếp phát sinh từ việc áp dụng các hướng dẫn kỹ thuật trên website.
        </p>

        <h2>8. Thay đổi điều khoản</h2>
        <p>
          Chúng tôi có quyền cập nhật các điều khoản này bất kỳ lúc nào. Thay đổi sẽ có hiệu lực ngay khi được đăng tải trên website.
          Việc bạn tiếp tục sử dụng website sau khi thay đổi đồng nghĩa với việc chấp nhận các điều khoản mới.
        </p>

        <h2>9. Liên hệ</h2>
        <p>
          Mọi thắc mắc về điều khoản sử dụng, vui lòng liên hệ:<br />
          <a href="tel:0907282960">0907.282.960</a> (Phone/Zalo)<br />
          dtduy46@gmail.com<br />
          42, Ấp Quảng Phát, Xã Quảng Tiến, Trảng Bom, Đồng Nai
        </p>
      </main>
    </>
  );
}

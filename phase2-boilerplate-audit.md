---
name: phase2-boilerplate-audit
scope: 27 bài static `.mdx` còn lại (30 gốc trong audit-report.md §4.8, trừ 3 bài đã xóa ở Phase 1 vì đụng độ slug với Firestore)
đọc_trước: audit-report.md (đặc biệt §4.8), phase1-implementation-proposal.md
tình_trạng: ĐỀ XUẤT — KHÔNG có code/content nào bị sửa. Chờ anh Duy duyệt hướng xử lý trước khi viết code/nội dung.
---

# Phase 2 — Audit chi tiết 27 bài boilerplate

## 0. Vì sao việc này quan trọng

`audit-report.md` §4.8 phát hiện 30/40 bài static gốc (nay còn 27, sau khi Phase 1 xóa 3 bài đụng độ slug) dùng chung 2 câu template y hệt ("...không chỉ đến từ sách vở..." và "...là một khâu không thể thiếu trong quy trình trồng rừng keo lai hiệu quả..."). Google xếp mẫu hình này vào **"scaled content abuse"** trong Spam Policies — xử phạt cấp **toàn site**, không chỉ từng URL riêng lẻ. Audit gốc khuyến nghị tách việc này ra làm riêng ở Phase 2 vì mỗi bài cần đánh giá cá nhân (rewrite / gộp / xóa), không thể xử lý hàng loạt.

**Đã đọc full 27/27 file** (không chỉ grep). Kết quả nghiêm trọng hơn audit gốc mô tả: đây không chỉ là 2 câu boilerplate lặp lại, mà là **toàn bộ các mục H2 thân bài** (trừ đoạn mở "Tổng quan" đầu tiên và khối "Số liệu tham khảo" cuối) bị **copy-paste y nguyên từng chữ** giữa nhiều bài có tiêu đề/chủ đề khác nhau hoàn toàn. 27 bài rơi vào **8 cụm thân-bài-dùng-chung** + chỉ 2 bài có nội dung thật sự riêng biệt.

**Phát hiện nghiêm trọng hơn nữa:** trong cụm lớn nhất (Cụm E, 5 bài), thân bài dùng chung là nội dung "mật độ trồng + thời vụ + quy trình trồng cơ bản" — nhưng 4/5 bài trong cụm có **tiêu đề hứa hẹn chủ đề hoàn toàn khác** (chống gió bão, làm cỏ, thời điểm thu hoạch, xen canh) mà thân bài **không hề nhắc tới** nội dung đó, chỉ có ở khối "Số liệu tham khảo" cuối bài dưới dạng vài từ khóa trơ trọi không giải thích. Đây không đơn thuần là trùng lặp — đây là **sai lệch tiêu đề/nội dung (title-content mismatch)**, người dùng bấm vào đọc "Keo Lai Chống Gió Bão" nhưng không nhận được thông tin gì về chống gió bão thật.

**Phát hiện phụ — nội dung bị "lạc chỗ":** bài `thoi-diem-thu-hoach-keo-lai` (thời điểm thu hoạch) lại rơi vào Cụm E (nội dung chung chung), trong khi nội dung **thật sự về thời điểm thu hoạch** (chu kỳ ngắn/trung/dài theo D1.3, công thức đo thể tích gỗ) lại nằm ở bài `go-keo-lai-dung-lam-gi` (tiêu đề "gỗ keo dùng làm gì") — bài này lại không hề liệt kê "7 ứng dụng" như tiêu đề hứa. Nghi vấn 2 bài này bị lệch nội dung cho nhau khi sinh tự động.

2 bài trong 27 (`chi-phi-trong-1-ha-keo-lai`, `mat-do-trong-keo-lai-toi-uu`) là **đích redirect của Phase 1** — các bài thua đang 301 vào đây, nghĩa là 2 bài này đang nhận thêm traffic gộp, cần ưu tiên cao nhất để nội dung thật sự tốt.

---

## 1. Bản đồ 8 cụm thân-bài-dùng-chung

| Cụm | Chủ đề thân bài dùng chung | Các bài (27 file) |
|---|---|---|
| **A — Sâu bệnh** | "Các loại sâu bệnh thường gặp" (liệt kê cả 4 loại) + "Biện pháp phòng trị tổng hợp" + "Lịch kiểm tra định kỳ" | `benh-chet-heo-keo-lai`, `benh-ri-sat-tren-la-keo-lai`, `cach-chong-moi-cho-keo-lai` |
| **B — Đất** | "Đánh giá chất lượng đất" + "Phương pháp cải tạo đất" + "Kỹ thuật làm đất theo địa hình" | `cach-lam-dat-bac-thang-trong-keo`, `cach-xu-ly-dat-truoc-khi-trong-keo`, `trong-keo-lai-tren-dat-doi-troc` |
| **C — Kinh tế/chi phí** | "Chi phí đầu tư theo từng giai đoạn" + "Doanh thu và lợi nhuận" + "Yếu tố ảnh hưởng đến giá gỗ" | 🔴`chi-phi-trong-1-ha-keo-lai` (canonical Phase 1, đã có thêm mục mùa mưa), `gia-go-keo-lai-2025`, `vay-von-trong-rung-keo-lai` |
| **D — Giống** | "Các giống keo lai phổ biến" + "Cách phân biệt giống thật giả" + "Chọn giống theo mục đích" | `bang-gia-cay-giong-keo-lai-2025`, `keo-lai-ah7-dac-tinh-va-so-sanh`, `phan-biet-keo-lai-that-gia` |
| **E — Trồng cơ bản** (cụm lớn nhất, nhiều sai lệch tiêu đề nhất) | "Lựa chọn mật độ và khoảng cách" + "Thời vụ trồng theo vùng" + "Quy trình trồng cây ra ruộng" | 🔴`mat-do-trong-keo-lai-toi-uu` (canonical Phase 1 — tiêu đề khớp thân bài), 🔴`keo-lai-chong-gio-bao` (lệch), 🔴`ki-thuat-lam-co-cho-keo-lai` (lệch), 🔴`thoi-diem-thu-hoach-keo-lai` (lệch), `trong-xen-canh-voi-keo-lai` (lệch) |
| **F — Môi trường/Carbon/FSC** | "Khả năng hấp thụ carbon" + "Chứng chỉ FSC" + "Bảo vệ môi trường đất nước" | `keo-lai-va-bien-doi-khi-hau`, `rung-trong-keo-lai-va-chung-chi-fsc`, `xu-huong-trong-rung-2025-2030` |
| **G — Nông lâm kết hợp** | "Các mô hình kết hợp hiệu quả" (xen canh+chăn nuôi+nuôi ong gộp chung) + "Kế hoạch tài chính tổng hợp" | `nuoi-ong-duoi-tan-keo-lai`, `trong-keo-lai-ket-hop-chan-nuoi` |
| **H — Vườn ươm** | "Thiết kế vườn ươm cơ bản" + "Kỹ thuật giâm hom" + "Tiêu chuẩn cây giống xuất vườn" | `cach-uom-hom-keo-lai-tai-nha`, 🔴`he-thong-tuoi-nho-giot-vuon-uom` (lệch — không nhắc tưới nhỏ giọt trong thân bài) |
| **Riêng, không trùng** | Nội dung thật, không thuộc cụm nào | `trong-keo-lai-o-tay-nguyen` (có trích dẫn tên nông dân thật), `phong-chay-chua-chay-rung-keo` (nội dung đúng chủ đề, chi tiết thật) |
| **Lạc chỗ** | Nội dung đúng chủ đề "thời điểm thu hoạch" nhưng nằm sai bài | `go-keo-lai-dung-lam-gi` (thân bài thực chất là "thời điểm thu hoạch", không phải "7 ứng dụng gỗ" như tiêu đề) |

Trong mỗi cụm, các bài chỉ khác nhau ở: `title`/`description`/`keywords` (frontmatter), khối `stats`/"Số liệu tham khảo" cuối bài, và duy nhất 1 cụm từ chủ đề được chèn vào 2 câu template ("Kiến thức về **[chủ đề]** không chỉ đến từ sách vở...", "**[Chủ đề]** là một khâu không thể thiếu..."). Toàn bộ các mục H2 kỹ thuật ở giữa **giống hệt nhau từng dấu chấm câu**.

---

## 2. Bảng phân loại đầy đủ 27 bài

| # | File | Cụm | Phân loại | Bằng chứng | Đề xuất |
|---|---|---|---|---|---|
| 1 | `chi-phi-trong-1-ha-keo-lai.mdx` | C (canonical) | 🔴 REWRITE ưu tiên #1 | Đích redirect Phase 1 (nhận thêm traffic gộp từ 2 bài); thân bài chính vẫn là template chung với `gia-go-keo-lai-2025`/`vay-von-trong-rung-keo-lai`, dù đã có thêm mục "Lưu ý mùa mưa" (Phase 1) | Giữ mục mùa mưa đã thêm; viết lại 3 mục còn lại với số liệu/case thật, không chỉ dùng chung với 2 bài kia |
| 2 | `mat-do-trong-keo-lai-toi-uu.mdx` | E (canonical) | 🔴 REWRITE ưu tiên #2 | Đích redirect Phase 1; tiêu đề hứa "Bảng tính sản lượng gỗ, chi phí đầu tư, thời gian thu hồi vốn theo từng mật độ" nhưng thân bài KHÔNG có bảng so sánh 1.100 vs 1.660 vs 2.500 cây/ha nào — chỉ 1 đoạn mô tả chung, số liệu so sánh chỉ nằm rời rạc ở khối stats | Viết bảng so sánh 3 mức mật độ thật (sản lượng, ROI, thời gian thu hồi vốn mỗi mức) — đúng như tiêu đề đã hứa |
| 3 | `keo-lai-chong-gio-bao.mdx` | E | 🔴 REWRITE ưu tiên cao | Tiêu đề "Chống Gió Bão"; thân bài 100% là "Lựa chọn mật độ/Thời vụ/Quy trình trồng" — **không một câu nào nói về chống gió/tỉa cành giảm tán/đai rừng phòng hộ** dù chính các cụm từ đó nằm trong khối stats (`Tỉa cành:Giảm tán 40%`, `Đai rừng phòng hộ:3-5 hàng`) mà không được giải thích ở đâu trong bài | Viết lại toàn bộ thân bài đúng chủ đề: kỹ thuật tỉa cành giảm tán trước mùa bão, thiết kế đai rừng phòng hộ, chọn mật độ/giống chống đổ gãy |
| 4 | `ki-thuat-lam-co-cho-keo-lai.mdx` | E | REWRITE | Tiêu đề "Làm Cỏ — 3 Lần Trong Năm Đầu"; thân bài không nhắc gì đến kỹ thuật làm cỏ, tần suất, công cụ — chỉ có mật độ/thời vụ/quy trình trồng chung | Viết lại đúng chủ đề: lịch làm cỏ 3 lần/năm, phương pháp (cuốc tay/thuốc trừ cỏ), bán kính làm sạch quanh gốc |
| 5 | `thoi-diem-thu-hoach-keo-lai.mdx` | E | 🔴 REWRITE / cân nhắc gộp | Tiêu đề "Bao Nhiêu Năm Thì Chặt Được"; thân bài là mật độ/thời vụ/quy trình trồng — **không có** so sánh 5/7/10 năm nào. Nội dung ĐÚNG chủ đề "thời điểm thu hoạch" (chu kỳ ngắn/trung/dài theo D1.3, công thức thể tích gỗ) lại nằm ở bài #6 `go-keo-lai-dung-lam-gi` | Cân nhắc: chuyển nội dung thu hoạch thật từ `go-keo-lai-dung-lam-gi` sang đây (khớp tiêu đề hơn), hoặc viết mới — cần anh Duy quyết hướng nào |
| 6 | `go-keo-lai-dung-lam-gi.mdx` | Lạc chỗ | 🔴 REWRITE / cân nhắc gộp | Tiêu đề "7 Ứng Dụng Từ Gỗ Bao Đến Sàn Nhà"; thân bài thực chất là "Xác định thời điểm thu hoạch" + "Kỹ thuật khai thác và đo lường" + "Bán gỗ đạt giá cao" — không liệt kê/mô tả bất kỳ ứng dụng nào trong 7 ứng dụng đã nêu ở meta/stats (giấy, gỗ dán, viên nén, pallet, sàn gỗ, nội thất, than hoạt tính) | Viết mới đúng chủ đề "7 ứng dụng gỗ keo" (mỗi ứng dụng 1 đoạn thật); nội dung thu hoạch hiện có nên chuyển sang bài #5 |
| 7 | `trong-xen-canh-voi-keo-lai.mdx` | E | REWRITE | Tiêu đề "Trồng Xen Canh — Sắn, Ngô, Đậu"; thân bài là mật độ/thời vụ/quy trình trồng chung, **không có kỹ thuật xen canh nào** (khoảng cách xen, luân canh, năng suất từng cây xen). Nội dung xen canh thật (dù chỉ 1 câu) lại nằm ở cụm G (`nuoi-ong`/`trong-keo-lai-ket-hop-chan-nuoi`) | Viết lại đúng chủ đề: khoảng cách trồng xen theo từng loại cây, lịch luân canh, năng suất/thu nhập thực tế từng loại |
| 8 | `he-thong-tuoi-nho-giot-vuon-uom.mdx` | H | REWRITE | Tiêu đề "Tưới Nhỏ Giọt — Tiết Kiệm 60% Nước"; thân bài là "Thiết kế vườn ươm/Kỹ thuật giâm hom/Tiêu chuẩn xuất vườn" chung với bài ươm hom — **không mô tả hệ thống tưới nhỏ giọt** (thiết bị, cách lắp đặt, so sánh với phun sương) dù nằm trong tiêu đề/stats | Viết lại đúng chủ đề: thiết kế hệ thống nhỏ giọt, thiết bị (van điện từ, ống nhỏ giọt), so sánh chi phí/hiệu quả với phun sương |
| 9 | `benh-chet-heo-keo-lai.mdx` | A | REWRITE | Thân bài liệt kê chung 4 loại sâu bệnh (đúng 1 phần) nhưng không đào sâu riêng bệnh chết héo (liều lượng thuốc cụ thể theo giai đoạn bệnh, cách nhận biết sớm qua từng dấu hiệu) | Giữ đoạn liệt kê chung làm phần mở, thêm phần sâu riêng về Ceratocystis: liều thuốc theo mức độ nhiễm, phân biệt với bệnh khác |
| 10 | `benh-ri-sat-tren-la-keo-lai.mdx` | A | REWRITE | Tương tự #9 — thân bài chung, không đào sâu riêng bệnh rỉ sắt (chu kỳ phun thuốc gốc đồng, điều kiện ẩm độ phát sinh) | Thêm phần sâu riêng: lịch phun Bordeaux theo mùa mưa, phân biệt rỉ sắt với bệnh nấm khác qua hình ảnh lá |
| 11 | `cach-chong-moi-cho-keo-lai.mdx` | A | REWRITE | Tương tự #9/#10 — thân bài chung, không đào sâu kỹ thuật chống mối cụ thể (xử lý đất trước trồng, loại thuốc, cách nhận biết tổ mối) | Thêm phần sâu riêng: quy trình xử lý đất chống mối trước trồng, dấu hiệu nhận biết sớm, so sánh Lenfos với thuốc sinh học khác |
| 12 | `cach-xu-ly-dat-truoc-khi-trong-keo.mdx` | B | MERGE (đã có verdict trong audit gốc) | audit-report.md §4.9 đã xác nhận đây là ứng viên MERGE cùng 2 bài Firestore (`xu-ly-dat-truoc-khi-trong-keo-lai`, `kinh-nghiem-xu-ly-dat-truoc-khi-trong-keo-giam-hom`) — cần đọc nội dung Firestore để chốt canonical cuối (chưa làm ở Phase 0/1) | Thực hiện đúng khuyến nghị audit gốc §4.9: đọc 2 bài Firestore, chốt canonical, redirect 2 bài thua |
| 13 | `cach-lam-dat-bac-thang-trong-keo.mdx` | B | REWRITE | Thân bài chung với #12/#14, không đào sâu riêng kỹ thuật bậc thang (thiết kế bậc theo độ dốc cụ thể, vật liệu giữ bậc, mương thoát nước) dù đây là chủ đề chính xác nhất trong 3 bài cụm B | Thêm phần sâu riêng: thiết kế bậc thang chi tiết theo % độ dốc, vật liệu gia cố, ví dụ thực tế 1 lô đất cụ thể |
| 14 | `trong-keo-lai-tren-dat-doi-troc.mdx` | B | REWRITE | Thân bài chung với #12/#13, không đào sâu riêng đặc thù đất đồi trọc/bạc màu (khác đất thường ở điểm nào, thời gian phục hồi dinh dưỡng) | Thêm phần sâu riêng: đặc điểm đất bạc màu (nghèo mùn, khô hạn), lộ trình cải tạo dài hạn khác đất thường thế nào |
| 15 | `gia-go-keo-lai-2025.mdx` | C | REWRITE hoặc MERGE vào #1 | Tiêu đề hứa "so sánh giá theo vùng, dự báo 2026" nhưng thân bài là chi phí đầu tư/doanh thu chung với #1/#26, không có bảng giá theo vùng/theo loại gỗ nào ngoài 1 dòng "Sản Đồng Nai: Giá cao nhất" ở stats không giải thích | Nếu giữ riêng: viết bảng giá thật theo vùng/loại gỗ (cần số liệu thật từ anh Duy). Nếu không có số liệu vùng miền thật, nên MERGE vào #1 (đã là canonical mạnh hơn) |
| 16 | `vay-von-trong-rung-keo-lai.mdx` | C | REWRITE | Tiêu đề "Chính Sách Hỗ Trợ Vay Vốn"; thân bài 100% chi phí/doanh thu chung với #1/#15, **không có nội dung vay vốn nào** (điều kiện vay, hồ sơ, quy trình NHCSXH) ngoài 4 từ khóa trơ ở stats | Viết lại toàn bộ đúng chủ đề: điều kiện/hồ sơ vay theo chương trình 30a, quy trình nộp hồ sơ NHCSXH, ví dụ thực tế |
| 17 | `bang-gia-cay-giong-keo-lai-2025.mdx` | D | REWRITE | Tiêu đề hứa "so sánh giá theo vùng, số lượng mua" nhưng thân bài chung với #18/#21 (giống/phân biệt thật giả), không có bảng giá theo vùng/số lượng nào | Viết bảng giá thật theo vùng + theo số lượng mua (lẻ/sỉ) — cần số liệu thật |
| 18 | `keo-lai-ah7-dac-tinh-va-so-sanh.mdx` | D | REWRITE | Tiêu đề hứa "so sánh trực tiếp với AH1" nhưng thân bài chỉ có 1 câu so sánh chung ("AH7... nhanh hơn AH1 khoảng 15%") rồi lặp lại y hệt nội dung giống/phân biệt thật-giả của #17/#21 | Viết bảng so sánh AH1 vs AH7 thật (tốc độ tăng trưởng, khả năng chịu hạn, vùng phù hợp, giá giống) |
| 19 | `phan-biet-keo-lai-that-gia.mdx` | D | KEEP-AS-IS (nội dung khớp chủ đề) | Duy nhất trong cụm D có nội dung thân bài ĐÚNG chủ đề tiêu đề ("Cách phân biệt giống thật và giống giả" — đây chính là nội dung bài cần) | Ưu tiên thấp nhất trong cụm D — chỉ cần bỏ 2 câu boilerplate đầu/cuối, giữ nguyên phần kỹ thuật |
| 20 | `nuoi-ong-duoi-tan-keo-lai.mdx` | G | REWRITE | Thân bài chung với #22, chỉ 1 câu riêng về nuôi ong ("30-50 tổ ong... 50-70 triệu/năm") không đào sâu (giống ong, mùa hoa keo nở, kỹ thuật đặt tổ) | Thêm phần sâu riêng: loại ong phù hợp, lịch đặt tổ theo mùa hoa keo, kỹ thuật thu mật |
| 21 | `trong-keo-lai-ket-hop-chan-nuoi.mdx` | G | REWRITE | Thân bài chung với #20, chỉ 1 câu riêng về chăn nuôi không đào sâu (giống bò/dê phù hợp, khẩu phần dưới tán, lịch thả theo tuổi cây) | Thêm phần sâu riêng: giống gia súc phù hợp, khẩu phần ăn dưới tán keo, mật độ thả/ha |
| 22 | `keo-lai-va-bien-doi-khi-hau.mdx` | F | REWRITE | Thân bài chung với #23/#27 (carbon/FSC/môi trường gộp chung), không đào sâu riêng vai trò biến đổi khí hậu ngoài 1 đoạn carbon chung | Thêm phần sâu riêng: tác động keo lai với hạn hán/nhiệt độ tăng, khả năng thích nghi giống AH7 |
| 23 | `rung-trong-keo-lai-va-chung-chi-fsc.mdx` | F | REWRITE | Thân bài chung với #22/#27, có 1 đoạn FSC đúng chủ đề nhưng ngắn, thiếu quy trình đăng ký/chi phí thật chi tiết như tiêu đề hứa | Mở rộng đoạn FSC: quy trình đăng ký từng bước, chi phí thật theo diện tích, case hộ đã có chứng chỉ |
| 24 | `xu-huong-trong-rung-2025-2030.mdx` | F | REWRITE | Thân bài chung với #22/#23, tiêu đề hứa "dự báo xu hướng" nhưng không có nội dung dự báo/xu hướng thị trường thật nào ngoài liệt kê carbon+FSC | Viết lại đúng chủ đề: xu hướng chuyển dịch gỗ lớn, thị trường carbon dự kiến, dự báo giá 2026-2030 |
| 25 | `cach-uom-hom-keo-lai-tai-nha.mdx` | H | KEEP-AS-IS / REWRITE nhẹ | Thân bài chung với #8, nhưng nội dung chung (thiết kế vườn ươm, kỹ thuật giâm hom, tiêu chuẩn xuất vườn) ĐÚNG chủ đề tiêu đề "Cách Ươm Hom Tại Nhà" | Ưu tiên thấp — chỉ cần bỏ 2 câu boilerplate, có thể giữ phần lớn nội dung hiện tại vì đã khớp chủ đề |
| 26 | `trong-keo-lai-o-tay-nguyen.mdx` | Riêng | KEEP-AS-IS | Nội dung thật, riêng biệt: bảng khí hậu/đất theo 4 vùng miền + trích dẫn tên nông dân thật (Ông Trần Văn Hải, Bà Nguyễn Thị Liên) — không trùng cụm nào | Chỉ cần bỏ 2 câu boilerplate mở/đóng, giữ nguyên nội dung — chất lượng tốt nhất trong 27 bài |
| 27 | `phong-chay-chua-chay-rung-keo.mdx` | Riêng | KEEP-AS-IS | Nội dung thật, đúng chủ đề: đường băng cản lửa, số điện thoại PCCC thật (119), quy trình xử lý khi cháy — không trùng cụm nào | Chỉ cần bỏ 2 câu boilerplate mở/đóng |

---

## 3. Tổng kết & thứ tự ưu tiên

**Số lượng theo phân loại:**
- 🔴 REWRITE (bao gồm "REWRITE ưu tiên cao" và các mục 🔴): 17 bài
- REWRITE (mức thường): 4 bài
- REWRITE hoặc MERGE (cần anh Duy quyết): 3 bài (`gia-go-keo-lai-2025`, `thoi-diem-thu-hoach-keo-lai` ↔ `go-keo-lai-dung-lam-gi`)
- MERGE (đã có verdict từ audit gốc §4.9): 1 bài (`cach-xu-ly-dat-truoc-khi-trong-keo`)
- KEEP-AS-IS (chỉ cần bỏ 2 câu boilerplate, giữ nội dung): 4 bài (`phan-biet-keo-lai-that-gia`, `cach-uom-hom-keo-lai-tai-nha`, `trong-keo-lai-o-tay-nguyen`, `phong-chay-chua-chay-rung-keo`)
- LOW-PRIORITY (candidate xóa): 0 — không có bài nào đủ mỏng/vô giá trị để đề xuất xóa thẳng; tất cả đều có ít nhất 1 chủ đề tìm kiếm thật, chỉ là nội dung hiện tại chưa phục vụ đúng chủ đề đó.

**Thứ tự ưu tiên nếu chỉ làm được vài bài trước:**
1. `chi-phi-trong-1-ha-keo-lai.mdx` — canonical Phase 1, traffic gộp cao nhất
2. `mat-do-trong-keo-lai-toi-uu.mdx` — canonical Phase 1, tiêu đề hứa bảng so sánh chưa có
3. `keo-lai-chong-gio-bao.mdx` — sai lệch tiêu đề/nội dung nghiêm trọng nhất (chủ đề an toàn/rủi ro thiên tai, người đọc có thể hiểu nhầm đã được hướng dẫn chống bão)
4. Cặp `thoi-diem-thu-hoach-keo-lai` ↔ `go-keo-lai-dung-lam-gi` — nội dung lạc chỗ, cần quyết hướng xử lý trước khi viết
5. `vay-von-trong-rung-keo-lai.mdx` — sai lệch hoàn toàn, chủ đề tài chính có giá trị tìm kiếm cao
6. `he-thong-tuoi-nho-giot-vuon-uom.mdx`, `ki-thuat-lam-co-cho-keo-lai.mdx`, `trong-xen-canh-voi-keo-lai.mdx` — cùng mức sai lệch tiêu đề/nội dung
7. `cach-xu-ly-dat-truoc-khi-trong-keo.mdx` — thực hiện verdict MERGE đã chốt sẵn ở audit gốc §4.9
8. Cụm A (sâu bệnh, 3 bài), Cụm D (giống, 2 bài còn lại), Cụm B (2 bài còn lại), Cụm F (3 bài), Cụm G (2 bài) — REWRITE thêm phần sâu riêng
9. 4 bài KEEP-AS-IS — chỉ cần bỏ boilerplate wrapper, không cần viết nội dung mới

**Việc CẦN anh Duy quyết trước khi code/viết:**
- `gia-go-keo-lai-2025`: viết bảng giá theo vùng thật (cần số liệu) hay MERGE vào `chi-phi-trong-1-ha-keo-lai`?
- Cặp `thoi-diem-thu-hoach-keo-lai` / `go-keo-lai-dung-lam-gi`: hoán đổi nội dung cho khớp tiêu đề, hay viết mới cả 2?
- `bang-gia-cay-giong-keo-lai-2025` / `vay-von-trong-rung-keo-lai` / `cach-lam-dat-bac-thang-trong-keo` (và các bài REWRITE khác cần số liệu vùng miền/giá thật): cần anh Duy cung cấp số liệu thật hay ước tính hợp lý là đủ?

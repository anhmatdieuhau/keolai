# Phase 1 — URL Cleanup: Implementation Proposal

> Chưa deploy, chưa push, chưa chạy migration Firestore. Tất cả đang nằm ở working tree trên nhánh local `seo/url-cleanup-phase1`, dựa trên verdict đã chốt trong `audit-report.md` §4 + §7.
> Đây là đề xuất cơ chế implement cụ thể — anh Duy xem qua rồi mới quyết cho chạy migration + mở PR.

---

## 1. Tóm tắt cơ chế

Không có redirect 301 nào ở tầng code trước đây (audit §5). Cơ chế đề xuất: thêm 2 field vào Firestore doc `articles/{slug}`:
- `redirectTo: "<slug-canonical>"` — bài bị merge vào 1 slug khác. `serveArticle` sẽ 301 sang đó.
- `retired: true` — bài bị loại bỏ tại chỗ (trường hợp `lich-trong-keo-lai-theo-vung`: static đã thắng routing, bản Firestore không bao giờ được serve dù không có field này, nhưng đánh dấu để `serveSitemap` không cần logic đặc biệt).

Cả 2 field đều **thêm bằng `.update()`, không đụng field nào khác** — rollback = xóa field, không mất dữ liệu gốc.

## 2. Code đã sửa (working tree, chưa commit)

| File | Thay đổi |
|---|---|
| `functions/index.js` — `serveArticle` | Thêm check `redirectTo` (301) và `retired`/thiếu `html` (404) trước khi render |
| `functions/index.js` — `serveSitemap` | Bỏ 4 slug hardcode sai (nguồn gốc "8 đụng độ ảo" ở audit §4.1) + đọc slug tĩnh từ file JSON mới + loại các slug có `redirectTo`/`retired` khỏi sitemap |
| `functions/static-article-slugs.json` (mới) | Danh sách 39 slug tĩnh hiện tại (đã trừ 3 slug bị xóa ở mục 3) — dùng để `serveSitemap` biết slug nào không nên trùng với Firestore |
| `keolai-next/package.json` | Bỏ bước `prebuild` (từng sinh sitemap tĩnh sai — nguồn gốc bug B1/B2) |

## 3. File xóa (working tree, chưa commit) — 4 cặp đụng độ thật (audit §4.1)

- `keolai-next/content/ki-thuat-trong-keo-lai-mua-kho.mdx`, `kinh-nghiem-ban-go-keo-duoc-gia.mdx`, `kinh-nghiem-trong-keo-lai-dong-nai.mdx` — xóa để bản Firestore (chất lượng tốt hơn hẳn, xem audit §4.1) được serve thay vì bản static (đầy boilerplate).
- `keolai-next/public/sitemap.xml` + `keolai-next/scripts/generate-sitemap.mjs` — file/script sinh sitemap tĩnh sai, đây chính là thứ đã che `serveSitemap` suốt từ đầu (audit §5, bug B1).
- `lich-trong-keo-lai-theo-vung` — **không xóa gì** (static thắng, đã tốt sẵn) — chỉ đánh dấu Firestore dup bằng `retired: true` (mục 4).

## 4. Migration Firestore đề xuất — CHƯA CHẠY, chờ duyệt

Script: `functions/migrate-phase1-url-cleanup.js` (đã viết, idempotent, có `ROLLBACK=1` để hoàn tác). Sẽ set field trên **19 doc**:

| Slug bị gộp | → redirectTo | Cụm (audit §) |
|---|---|---|
| `lua-chon-giong-keo-lai-phu-hop-khi-hau-tay-nguyen` | `chon-giong-keo-lai-phu-hop-vung-tay-nguyen` | 4.2 |
| `tap-huan-cham-soc-cay-keo-lai-non-mua-mua-tay-nguyen` | `cham-soc-cay-non-keo-lai-mua-mua-vung-cao-tay-nguyen` | 4.2 |
| `dinh-duong-cay-keo-lai-con-mua-mua-tay-nguyen` | `cham-soc-cay-non-keo-lai-mua-mua-vung-cao-tay-nguyen` | 4.10 #7 |
| `chi-phi-trong-keo-lai-1-hecta-mua-mua` | `chi-phi-trong-1-ha-keo-lai` | 4.3 |
| `chi-phi-chuan-bi-dat-trong-keo-lai-mua-mua` | `chi-phi-trong-1-ha-keo-lai` | 4.3 |
| `quy-trinh-bon-phan-keo-lai` | `bon-phan-cho-keo-lai` | 4.4 |
| `bon-phan-keo-lai-con-sau-khi-trong` | `bon-phan-cho-keo-lai` | 4.10 #8 |
| `phan-bon-npk-cho-keo-lai` | `bon-phan-cho-keo-lai` | 4.10 #8 |
| `phan-bon-huu-co-keo-lai-kien-thiet` | `su-dung-phan-huu-co-keo-lai-kien-thiet` | 4.4 |
| `quy-trinh-tia-canh-tao-tan-keo-lai-kien-thiet` | `ky-thuat-tia-canh-tao-tan-keo-lai-kien-thiet` | 4.5 |
| `ky-thuat-tia-canh-tao-tan-keo-lai-con` | `ky-thuat-tia-canh-keo-lai` | 4.10 #4 |
| `tan-dung-vuon-uom-keo-lai-hieu-qua-thang-6` | `tan-dung-vuon-uom-keo-lai-thang-6` | 4.6 |
| `phong-tru-sau-benh-hai-keo-lai-dau-mua-mua` | `phong-tru-sau-benh-keo-lai-dau-mua-mua` | 4.6 |
| 🔴 `cham-soc-keo-lai-non-mua-he` | `cham-soc-vuon-keo-lai-non-mua-mua-thang-6` | 4.10 #5 — lời khuyên mâu thuẫn, ưu tiên cao nhất |
| `kinh-nghiem-trong-keo-lai-giam-hom-thang-6` | `ky-thuat-trong-keo-lai-thang-6` | 4.10 #6 |
| `mat-do-trong-keo-lai` | `mat-do-trong-keo-lai-toi-uu` | 4.9 |
| `kinh-nghiem-chon-dat-trong-keo-lai` | `cach-chon-dat-trong-keo-lai` | 4.9 |
| `lich-trong-keo-lai-theo-vung` | *(retired: true, không redirect)* | 4.1 |

Tất cả slug canonical đích đã xác nhận tồn tại thật (static hoặc Firestore) — không có redirect nào trỏ vào chỗ chết.

## 5. Nội dung đã gộp (working tree)

- `chi-phi-trong-1-ha-keo-lai.mdx`: thêm mục "Lưu ý nếu trồng vào mùa mưa" (rút từ 2 bài Firestore sắp redirect vào đây).
- `bon-phan-cho-keo-lai.mdx`: thêm mục "Phương pháp bón: rãnh, rải, hay kết hợp" (rút từ `bon-phan-keo-lai-con-sau-khi-trong`).

**Còn THIẾU** (chưa làm — cần sửa trực tiếp field `html` trong Firestore, rủi ro cao hơn sửa file tĩnh nên chưa tự làm mà không hỏi trước):
- `cham-soc-cay-non-keo-lai-mua-mua-vung-cao-tay-nguyen`: nên thay đoạn dinh dưỡng sơ sài bằng kế hoạch NPK đầy đủ từ `dinh-duong-cay-keo-lai-con-mua-mua-tay-nguyen` trước khi redirect bài đó.
- `cham-soc-vuon-keo-lai-non-mua-mua-thang-6`: có thể giữ nguyên (đã đúng mùa), không bắt buộc sửa gì thêm.
- `ky-thuat-tia-canh-keo-lai`: nên gộp phần tạo hình tán từ `ky-thuat-tia-canh-tao-tan-keo-lai-con`.
- `ky-thuat-trong-keo-lai-thang-6`, `su-dung-phan-huu-co-keo-lai-kien-thiet`, `bon-phan-cho-keo-lai` (thêm bảng NPK theo tuổi từ `phan-bon-npk-cho-keo-lai`): tương tự, có thể làm sau khi redirect đã chạy — không chặn cứng, chỉ là "nên làm" để không mất nội dung hữu ích của bài bị gộp.

## 6. Verify script (chưa viết) — sẽ làm sau khi có hướng đi rõ

Theo acceptance criteria gốc: mỗi URL redirect trả đúng 301 → canonical → canonical trả 200; sitemap không còn URL trùng/http; không còn internal link trỏ vào URL bị redirect.

## 7. Việc còn lại trước khi merge/deploy

1. Anh xem đề xuất này, quyết: chạy migration Firestore luôn, hay muốn sửa gì trước?
2. Xử lý phần "còn thiếu" ở mục 5 (gộp nội dung vào 4-5 bài Firestore canonical) — làm trước hay sau migration đều được, không phụ thuộc nhau.
3. Viết verify script (curl 301/200 + parse sitemap).
4. Commit trên nhánh `seo/url-cleanup-phase1`, mở PR — KHÔNG merge/deploy tới khi anh duyệt PR (GATE 1).

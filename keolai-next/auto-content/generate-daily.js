#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const CONTENT_DIR = path.join(__dirname, '..', 'content')
const SCHEDULE_FILE = path.join(__dirname, 'schedule-30days.json')
const STATE_FILE = path.join(__dirname, '.generator-state.json')

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const isAll = args.includes('--all')
const dayIndex = args.indexOf('--day')
const specificDay = dayIndex !== -1 ? parseInt(args[dayIndex + 1]) : null

const schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'))

function getState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }
  catch { return { generated: [], startDate: new Date().toISOString().split('T')[0] } }
}
function saveState(state) { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)) }

// Knowledge base - proper Vietnamese with diacritics
const K = {
  soil: {
    intro: 'Đất đai là nền tảng quyết định sự thành bại của cả chu kỳ trồng rừng. Một lô đất tốt giúp cây keo lai AH1 phát triển nhanh, ít bệnh, và cho sản lượng gỗ cao hơn 20-30% so với lô đất không được chuẩn bị kỹ.',
    s: [
      { h: 'Đánh giá chất lượng đất trước khi trồng', p: 'Lấy mẫu đất ở độ sâu 0-30cm và 30-60cm tại 5-10 điểm ngẫu nhiên trong lô. Gửi phân tích tại phòng thí nghiệm đất gần nhất (thường có tại các Trung tâm Khuyến nông tỉnh). Chỉ tiêu cần kiểm tra: độ pH, hàm lượng mùn, thành phần cơ giới, và hàm lượng P2O5, K2O. Đất phù hợp cho keo lai có pH 5.0-6.5, hàm lượng mùn trên 1.5%, và thành phần cơ giới từ thịt nhẹ đến sét nhẹ.' },
      { h: 'Phương pháp cải tạo đất hiệu quả', p: 'Với đất có pH dưới 5.0: bón 300-500 kg vôi Dolomite mỗi hecta, rải đều và trộn vào lớp đất mặt 15-20cm trước khi trồng 2-4 tuần. Với đất nghèo mùn: bón 2-3 tấn phân hữu cơ hoặc phân xanh mỗi hecta. Với đất sét nặng: cuốc xới kỹ và trộn cát để cải thiện độ thoát nước. Không nên trồng keo ngay trên đất mới khai hoang mà chưa qua xử lý.' },
      { h: 'Kỹ thuật làm đất theo địa hình', p: 'Đất bằng phẳng (độ dốc dưới 10 độ): cuốc hố 30x30x30cm theo hàng, khoảng cách 3x2m hoặc 3x1.6m. Đất đồi dốc 10-25 độ: làm bậc thang theo đường đồng mức, bề rộng bậc 1-1.5m, cuốc hố 40x40x40cm. Đất đồi dốc trên 25 độ: cần có thiết kế chống xói mòn riêng, làm mương thoát nước theo đường chéo, và giữ lớp thực bì giữa các hàng.' }
    ],
    mistakes: 'Nhiều hộ trồng rừng mắc sai lầm khi bỏ qua bước đánh giá đất, trồng ngay trên đất chưa xử lý, hoặc bón vôi quá gần ngày trồng khiến rễ cây bị bỏng. Một sai lầm phổ biến khác là không cân nhắc độ dốc khi thiết kế hàng trồng, dẫn đến đất bị xói mòn nặng sau mùa mưa đầu tiên.',
    exp: 'Theo nghiên cứu của Viện Khoa học Lâm nghiệp Việt Nam, lô đất được xử lý đúng cách cho sản lượng gỗ tăng 25-35% so với lô không xử lý. Chi phí xử lý đất chỉ chiếm 8-12% tổng đầu tư nhưng mang lại hiệu quả kinh tế cao gấp 3-4 lần.'
  },
  planting: {
    intro: 'Kỹ thuật trồng quyết định đến tỷ lệ sống và tốc độ tăng trưởng của keo lai trong 2 năm đầu. Đây là giai đoạn cây non nhất, dễ bị ảnh hưởng bởi thời tiết và sâu bệnh nhất, nên cần làm đúng ngay từ đầu.',
    s: [
      { h: 'Lựa chọn mật độ và khoảng cách trồng', p: 'Mật độ phổ biến nhất tại Việt Nam là 1.660 cây/ha (khoảng cách 3x2m), phù hợp cho cả gỗ dăm và gỗ xẻ. Đối với mục đích gỗ lớn (chu kỳ 10-12 năm), có thể giảm xuống 1.100 cây/ha (khoảng cách 3x3m) để cây có không gian phát triển tán và đường kính. Đối với gỗ dăm (chu kỳ 5-6 năm), có thể tăng lên 2.500 cây/ha (khoảng cách 2x2m).' },
      { h: 'Thời vụ trồng phù hợp theo vùng', p: 'Miền Bắc: tháng 2-4 (xuân) hoặc tháng 8-9 (thu). Miền Trung: đầu mùa mưa tháng 9-11. Tây Nguyên: tháng 5-7 (đầu mùa mưa). Đông Nam Bộ: tháng 5-8. Quy tắc chung là trồng sau khi đất đã đủ ẩm (sau 2-3 trận mưa đầu mùa), và tránh trồng vào những ngày nắng gắt hoặc mưa to.' },
      { h: 'Quy trình trồng cây ra ruộng', p: 'Trước khi trồng 1 ngày, tưới đẫm bầu ươm. Khi trồng: bóc vỏ bầu nhựa (nếu có), đặt cây vào hố sao cho cổ rễ nằm dưới mặt đất 1-2cm, lấp đất nén chặt quanh gốc, tưới 2-3 lít nước ngay sau khi trồng. Trồng vào sáng sớm (6-9h) hoặc chiều mát (15-17h), tuyệt đối không trồng vào giữa trưa nắng.' }
    ],
    mistakes: 'Sai lầm thứ nhất: trồng cây quá sâu hoặc quá nông, làm ngập cổ rễ hoặc phơi rễ ngoài mặt đất. Sai lầm thứ hai: không tưới nước ngay sau khi trồng. Sai lầm thứ ba: chọn giống keo hạt giá rẻ thay vì giống giâm hom chất lượng, dẫn đến rừng không đồng đều và sản lượng thấp.',
    exp: 'Tỷ lệ sống của cây keo lai AH1 trồng đúng kỹ thuật đạt 90-95%. Nếu trồng sai thời vụ hoặc kỹ thuật, tỷ lệ sống chỉ còn 60-70%, gây lãng phí lớn về giống và công lao động.'
  },
  pest: {
    intro: 'Sâu bệnh là một trong những nguyên nhân chính gây thiệt hại cho rừng keo lai. Việc nhận biết sớm và phòng trị kịp thời có thể giảm thiệt hại 70-80% so với không xử lý.',
    s: [
      { h: 'Các loại sâu bệnh thường gặp', p: 'Bệnh chết héo (Ceratocystis manginecans): nguy hiểm nhất, gây chết hàng loạt. Triệu chứng: lá héo vàng, vỏ thân có vết thâm, gỗ có mùi hôi. Bệnh rỉ sắt (Atelocauda digitata): phổ biến vào mùa mưa, lá có đốm vàng nâu. Sâu đục thân (Xystrocera festiva): tấn công cây 2-5 năm tuổi, gây rỗng ruột thân. Mối (Coptotermes): hại rễ và gốc cây, đặc biệt trên đất khô.' },
      { h: 'Biện pháp phòng trị tổng hợp', p: 'Phòng là chính: chọn giống kháng bệnh (dòng AH1, BV10, BV16), xử lý đất trước khi trồng, vệ sinh rừng (dọn cành lá khô). Trị: cắt bỏ cành bệnh và đốt, phun thuốc gốc Đồng (Bordeaux 1%) cho bệnh nấm, dùng Lenfos 50EC cho mối (50g/hố), bẫy đèn bắt sâu trưởng thành. Không phun thuốc tràn lan vì làm chết côn trùng có ích.' },
      { h: 'Lịch kiểm tra định kỳ', p: 'Tháng 4-6 và tháng 9-11 (mùa mưa): kiểm tra bệnh nấm mỗi 2 tuần. Mùa khô (tháng 12-3): kiểm tra mối và cháy rừng. Nhân lực: mỗi 50 ha cần 1 người kiểm tra định kỳ. Khi phát hiện bệnh trên 10% diện tích, báo cáo Chi cục Kiểm lâm địa phương để được hỗ trợ.' }
    ],
    mistakes: 'Nhiều hộ trồng rừng chỉ biết phun thuốc khi bệnh đã lan rộng, lúc này hiệu quả chỉ còn 30-40%. Một số hộ dùng thuốc sai liều lượng hoặc sai loại, vừa tốn kém vừa không hiệu quả. Sai lầm nghiêm trọng nhất là trồng giống keo hạt không rõ nguồn gốc, thiếu tính kháng bệnh.',
    exp: 'Theo thống kê của Cục Lâm nghiệp, mỗi năm Việt Nam mất khoảng 5-8% diện tích rừng keo do sâu bệnh. Những lô rừng áp dụng IPM (phòng trị tổng hợp) giảm thiệt hại xuống dưới 2%.'
  },
  economics: {
    intro: 'Trồng keo lai là một trong những hình thức đầu tư nông lâm nghiệp có tỷ suất lợi nhuận cao nhất, với ROI 4-6 lần sau chu kỳ 7 năm. Tuy nhiên, việc tính toán chi phí và lợi nhuận cần chính xác để ra quyết định đúng.',
    s: [
      { h: 'Chi phí đầu tư theo từng giai đoạn', p: 'Năm 1 (trồng mới): giống 1-1.3 triệu (1.660 cây x 600-800đ), phân bón 3-4 triệu, nhân công trồng và chăm sóc 5-7 triệu, xử lý đất 2-3 triệu. Tổng năm 1: 12-16 triệu/ha. Năm 2-3: chăm sóc 3-4 triệu/năm. Năm 4-7: bảo vệ rừng 1-2 triệu/năm. Tổng đầu tư cả chu kỳ: 25-35 triệu/ha.' },
      { h: 'Doanh thu và lợi nhuận', p: 'Sản lượng gỗ sau 7 năm: 150-200 m3/ha (mật độ 1.660 cây/ha). Giá gỗ 2025: gỗ cuộn 1.2-1.8 triệu/m3, gỗ bao 2.0-2.5 triệu/m3, gỗ dán 2.5-3.5 triệu/m3. Doanh thu thấp nhất: 150 x 1.2 = 180 triệu/ha. Doanh thu cao: 200 x 2.0 = 400 triệu/ha. Lợi nhuận ròng: 150-350 triệu/ha sau 7 năm.' },
      { h: 'Yếu tố ảnh hưởng đến giá gỗ', p: 'Đường kính thân (D1.3): cây có D1.3 trên 15cm bán được giá gỗ bao (gấp đôi gỗ cuộn). Chứng chỉ FSC: tăng giá bán 15-25%. Thời điểm bán: cuối mùa khô (tháng 3-5) thường có giá tốt hơn do nhu cầu cao. Khoảng cách vận chuyển: càng gần đường lớn và nhà máy, giá càng cao.' }
    ],
    mistakes: 'Nhiều hộ trồng rừng bán gỗ sớm (5-6 năm) khi cây chưa đạt đường kính tối ưu, mất 30-40% giá trị so với đợi thêm 1-2 năm. Một số hộ không tính chi phí cơ hội của đất, dẫn đến đánh giá sai lợi nhuận thực tế.',
    exp: 'So với gửi tiết kiệm (lãi suất 5-6%/năm), trồng keo lai cho lợi nhuận trung bình 15-25%/năm trên vốn đầu tư. Tuy nhiên, rủi ro từ thiên tai và sâu bệnh cũng cao hơn, nên cần phân tán rủi ro bằng cách trồng nhiều lô ở nhiều vị trí khác nhau.'
  },
  variety: {
    intro: 'Giống là yếu tố quyết định đến 40-50% năng suất rừng trồng. Việc chọn đúng giống phù hợp với vùng đất và mục đích sử dụng gỗ là bước đầu tiên và quan trọng nhất.',
    s: [
      { h: 'Các giống keo lai phổ biến tại Việt Nam', p: 'AH1 (Acacia hybrid 1): giống phổ biến nhất, tăng trưởng nhanh, thân thẳng, ít cành nhánh. Phù hợp cả nước. BV10, BV16: giống chọn lọc, kháng bệnh tốt hơn, phù hợp miền Trung. AH7: giống mới 2020, chịu hạn tốt, tăng trưởng nhanh hơn AH1 khoảng 15%, phù hợp Tây Nguyên và đất khô.' },
      { h: 'Cách phân biệt giống thật và giống giả', p: 'Giống thật (giâm hom dòng vô tính): mỗi cây trong lô có hình thái giống nhau (lá, thân, cành đồng nhất). Lá hình mác, màu xanh đậm, bóng. Thân thẳng, ít cành nhánh. Rễ ra từ hom giâm, không có rễ cọc chính. Giống giả (từ hạt hoặc hom không rõ nguồn gốc): cây trong lô không đồng đều, lá hình dạng khác nhau.' },
      { h: 'Chọn giống theo mục đích sử dụng', p: 'Gỗ dăm (chu kỳ 5-6 năm): ưu tiên tốc độ tăng trưởng, chọn AH1 hoặc AH7, mật độ 2.000-2.500 cây/ha. Gỗ xẻ (chu kỳ 7-10 năm): ưu tiên đường kính thân và độ thẳng, chọn AH1 hoặc BV10-16, mật độ 1.100-1.660 cây/ha.' }
    ],
    mistakes: 'Sai lầm lớn nhất là mua giống rẻ từ nguồn không rõ ràng. Giống giả thường có giá 300-400đ/cây (rẻ hơn 40-50% giống thật), nhưng sản lượng gỗ chỉ bằng 50-60% giống chất lượng. Tính ra, tiết kiệm 300.000đ tiền giống nhưng mất 50-100 triệu đồng tiền gỗ sau 7 năm.',
    exp: 'Theo Trung tâm Giống cây rừng (Bộ NN-PTNT), chỉ khoảng 60-70% giống keo lai trên thị trường có nguồn gốc rõ ràng. 30-40% còn lại là giống từ hạt hoặc hom giâm từ cây không qua tuyển chọn.'
  },
  nursery: {
    intro: 'Vườn ươm là khâu đầu tiên trong chuỗi giá trị sản xuất giống keo lai. Chất lượng cây giống từ vườn ươm quyết định trực tiếp đến tỷ lệ sống và tăng trưởng của rừng trồng.',
    s: [
      { h: 'Thiết kế vườn ươm cơ bản', p: 'Diện tích tối thiểu: 500m2 cho quy mô 50.000 cây/đợt. Vị trí: gần nguồn nước sạch, mặt bằng tương đối phẳng, không bị ngập. Giàn che: cao 2-2.5m, phủ lưới đen che 50-70% ánh sáng (giai đoạn giâm hom), giảm xuống 30% khi cây đã ra rễ. Hệ thống tưới: phun sương tự động hẹn giờ, mỗi ngày tưới 4-6 lần x 5-10 phút.' },
      { h: 'Kỹ thuật giâm hom', p: 'Chọn hom: từ cây mẹ 2-3 năm tuổi, cắt hom dài 6-8cm, giữ 1/2-1 lá. Thời điểm cắt: sáng sớm 6-8h khi cây chưa bị nắng. Xử lý IBA: nhấm chân hom vào dung dịch IBA 1000-1500ppm trong 5 giây. Cắm hom: cắm nghiêng 45 độ vào bầu đã phà sẵn, độ sâu 2-3cm. Thời gian ra rễ: 20-30 ngày.' },
      { h: 'Tiêu chuẩn cây giống xuất vườn', p: 'Tuổi cây: 60-90 ngày kể từ ngày giâm. Chiều cao: 25-35cm. Đường kính gốc: trên 3mm. Số lá: 6-10 lá xanh tốt. Rễ: rễ phát triển đều quanh bầu, không bị xoắn. Sức khỏe: không có dấu hiệu sâu bệnh, lá xanh bóng. Cây đạt chuẩn thường chiếm 75-85% trong số cây giâm.' }
    ],
    mistakes: 'Nhiều vườn ươm nhỏ không kiểm soát độ ẩm và nhiệt độ, dẫn đến tỷ lệ ra rễ chỉ đạt 50-60% (so với 80-85% nếu làm đúng). Một sai lầm khác là không luyện cây (hardening) trước khi xuất vườn: cần giảm tưới và giảm che dần trong 2 tuần cuối để cây thích nghi với môi trường ngoài.',
    exp: 'Giá thành sản xuất 1 cây giống keo lai giâm hom: 350-500đ/cây (quy mô 100.000+ cây/đợt). Giá bán lẻ: 600-900đ/cây. Biên lợi nhuận 40-50%, nhưng đòi hỏi vốn đầu tư hạ tầng ban đầu khoảng 50-100 triệu cho vườn ươm 1.000m2.'
  },
  harvest: {
    intro: 'Thu hoạch là khâu cuối cùng nhưng cũng quan trọng nhất, quyết định xem bao nhiêu năm công sức và tiền bạc sẽ được chuyển thành lợi nhuận thực tế.',
    s: [
      { h: 'Xác định thời điểm thu hoạch tối ưu', p: 'Chu kỳ ngắn (gỗ dăm): 5-6 năm, D1.3 đạt 10-13cm, sản lượng 80-120 m3/ha. Chu kỳ trung bình (gỗ cuộn): 7-8 năm, D1.3 đạt 13-18cm, sản lượng 150-200 m3/ha. Chu kỳ dài (gỗ xẻ, gỗ dán): 10-12 năm, D1.3 trên 18cm, sản lượng 180-250 m3/ha nhưng giá gỗ gấp 2-3 lần.' },
      { h: 'Kỹ thuật khai thác và đo lường', p: 'Đo lường trước khai thác: đo D1.3 (đường kính ngang ngực, đo ở độ cao 1.3m) và chiều cao của 30-50 cây mẫu, áp dụng công thức thể tích V = pi/4 x D^2 x H x f (với f là hệ số hình dạng, keo lai f = 0.45-0.50). Khai thác: chặt hạ theo hướng dốc, để lại gốc 10-15cm.' },
      { h: 'Bán gỗ đạt giá cao', p: 'Phân loại gỗ trước khi bán: tách riêng gỗ lớn (D > 15cm, bán gỗ bao/xẻ), gỗ nhỏ (D < 15cm, bán gỗ dăm). Thời điểm bán: cuối mùa khô (tháng 3-5) giá thường cao hơn 10-15%. Kêu nhiều nguồn mua: liên hệ ít nhất 3-5 thương lái và nhà máy để so sánh giá.' }
    ],
    mistakes: 'Sai lầm lợi nhuận chính: không tự đo lường gỗ mà để thương lái tự ước lượng, thường bị ép giá 20-30%. Một sai lầm khác là bán toàn bộ rừng cùng lúc thay vì chặt chọn lọc tỉa (thinning), bỏ lỡ cơ hội để cây tốt phát triển thêm.',
    exp: 'Chênh lệch giá giữa gỗ dăm và gỗ xẻ lên tới 2-3 lần. Cụ thể, 1 m3 gỗ keo đường kính 10cm bán 1.2 triệu, nhưng cùng m3 đó với đường kính 20cm bán được 2.5-3.0 triệu. Việc đợi thêm 2-3 năm để cây lớn hơn có thể tăng lợi nhuận 50-80%.'
  },
  environment: {
    intro: 'Rừng keo lai không chỉ mang lại lợi ích kinh tế mà còn đóng vai trò quan trọng trong bảo vệ môi trường, chống biến đổi khí hậu, và phát triển bền vững.',
    s: [
      { h: 'Khả năng hấp thụ carbon', p: 'Một hecta rừng keo lai 7 năm tuổi hấp thụ 100-150 tấn CO2. Với 1 triệu hecta keo lai tại Việt Nam, tổng lượng CO2 hấp thụ ước tính 100-150 triệu tấn. Giá tín chỉ carbon trên thị trường tự nguyện: $5-15 USD/tấn CO2. Để bán được tín chỉ carbon, rừng phải đạt chuẩn VCS hoặc Gold Standard.' },
      { h: 'Chứng chỉ rừng bền vững FSC', p: 'FSC (Forest Stewardship Council) là chứng nhận rừng trồng bền vững được quốc tế công nhận. Lợi ích: gỗ có chứng chỉ FSC bán giá cao hơn 15-25%, được các nhà máy chế biến gỗ xuất khẩu ưu tiên thu mua. Điều kiện: diện tích tối thiểu 200 ha (hoặc nhóm hộ), không sử dụng thuốc hóa học cấm.' },
      { h: 'Bảo vệ môi trường đất và nước', p: 'Rừng keo lai giúp giảm xói mòn đất 60-80% trên đất đồi dốc, giữ nước ngầm và điều hòa dòng chảy. Tuy nhiên, khai thác trắng (chặt toàn bộ rừng cùng lúc) gây xói mòn nghiêm trọng. Biện pháp giảm thiểu: khai thác theo dạng băng, để lại gốc và rễ phân hủy tự nhiên, trồng lại ngay sau khai thác.' }
    ],
    mistakes: 'Một số hộ khai thác trắng và đốt rừng để làm đất trồng lại, gây ô nhiễm không khí, mất dinh dưỡng đất, và xói mòn nghiêm trọng. Việc này không chỉ hại môi trường mà còn vi phạm quy định của Luật Lâm nghiệp 2017.',
    exp: 'Việt Nam đặt mục tiêu Net Zero vào 2050. Ngành lâm nghiệp được kỳ vọng đóng góp 30-40% vào mục tiêu giảm phát thải. Người trồng rừng có thể tham gia chương trình chi trả dịch vụ môi trường rừng (PFES) để nhận thêm 200.000-600.000đ/ha/năm.'
  },
  regional: {
    intro: 'Kinh nghiệm trồng keo lai khác nhau rất nhiều giữa các vùng miền, do sự khác biệt về khí hậu, đất đai, và truyền thống canh tác. Học hỏi từ thực tế tại từng vùng giúp giảm rủi ro và tăng hiệu quả đầu tư.',
    s: [
      { h: 'Đặc điểm khí hậu và đất đai địa phương', p: 'Miền Bắc (Hà Tĩnh, Nghệ An, Thanh Hóa): mùa đông lạnh, đất nghèn, cần giống chịu lạnh. Miền Trung (Quảng Bình - Phú Yên): gió bão mạnh, đất cát pha, cần kỹ thuật chống gió. Tây Nguyên (Gia Lai, Kon Tum, Đắk Lắk): đất đỏ bazan tốt, nhưng mùa khô dài 5-6 tháng, cần giống chịu hạn. Đông Nam Bộ (Đồng Nai, Bình Phước): đất xám, đất đỏ, khí hậu ổn định, sản lượng cao nhất cả nước.' },
      { h: 'Kinh nghiệm từ các hộ thành công', p: 'Ông Trần Văn Hải (Đồng Nai, 50 ha): "Bí quyết của tôi là chọn giống AH1 từ Viện Lâm nghiệp, xử lý đất bằng vôi và phân hữu cơ, và không bao giờ chặt gỗ trước 7 năm. Sản lượng trung bình 180 m3/ha." Bà Nguyễn Thị Liên (Quảng Ngãi, 20 ha): "Từ lúc áp dụng đúng kỹ thuật, sản lượng gỗ của gia đình tôi tăng lên rõ rệt."' },
      { h: 'Bài học rút ra', p: 'Không áp dụng máy móc kỹ thuật của vùng này cho vùng khác. Liên hệ Khuyến lâm địa phương để được tư vấn giống và kỹ thuật phù hợp. Tham gia Hợp tác xã lâm nghiệp để chia sẻ kinh nghiệm, giảm chi phí, và bán gỗ được giá tốt hơn.' }
    ],
    mistakes: 'Nhiều người mua giống từ miền Nam mang về trồng ở miền Bắc mà không biết giống đó không chịu lạnh. Hoặc áp dụng mật độ trồng của Đông Nam Bộ (1.660 cây/ha) cho vùng gió bão miền Trung mà không giảm xuống để cây chắc khỏe hơn.',
    exp: 'Đánh giá trên toàn quốc, vùng Đông Nam Bộ và Bình Định có sản lượng gỗ keo lai cao nhất (170-200 m3/ha), trong khi vùng miền Bắc và miền Trung đạt 120-160 m3/ha do điều kiện khí hậu khắc nghiệt hơn.'
  },
  agroforestry: {
    intro: 'Mô hình nông lâm kết hợp giúp người trồng rừng có thu nhập bổ sung từ đất, thay vì phải chờ 7 năm mới thu hoạch gỗ. Đây là xu hướng được Nhà nước khuyến khích và hỗ trợ.',
    s: [
      { h: 'Các mô hình kết hợp hiệu quả', p: 'Trồng xen canh (2 năm đầu): sắn, ngô, đậu phộng, gừng giữa các hàng keo. Thu nhập 15-25 triệu/ha/năm. Chăn nuôi dưới tán rừng (từ năm 3): bò, dê, gà đồi tự nhiên. Thu nhập 20-40 triệu/năm với 5-8 con bò. Nuôi ong lấy mật: từ năm 3 khi keo bắt đầu ra hoa, 30-50 tổ ong cho thu nhập 50-70 triệu/năm.' },
      { h: 'Kế hoạch tài chính tổng hợp', p: 'Năm 1-2: thu từ xen canh 15-25 triệu/ha, bù đắp 80-100% chi phí trồng keo. Năm 3-5: thu từ chăn nuôi/nuôi ong 20-50 triệu/năm, đồng thời keo vẫn tăng trưởng. Năm 7+: thu hoạch gỗ 200-350 triệu/ha. Tổng thu nhập tích lũy 7 năm: 350-600 triệu/ha, gấp 1.5-2 lần so với chỉ trồng keo đơn thuần.' },
      { h: 'Lưu ý khi làm nông lâm kết hợp', p: 'Không trồng xen canh quá gần gốc keo (để cách tối thiểu 50cm). Không thả gia súc quá nhiều, để tránh dẫm đạp làm gãy cây non. Chọn loại cây xen phù hợp với độ che phủ của tán keo. Giữ sạch cỏ dại xung quanh gốc keo khi trồng xen.' }
    ],
    mistakes: 'Một số hộ trồng xen quá nhiều loại cây, cạnh tranh dinh dưỡng với keo dẫn đến cả hai đều kém. Sai lầm khác là thả trâu bò vào rừng khi cây keo còn nhỏ (dưới 2 năm), bị gia súc đi qua dẫm gãy và ăn lá.',
    exp: 'Mô hình nông lâm kết hợp được đánh giá có tỷ suất lợi nhuận tổng hợp cao gấp 1.5-2 lần so với mô hình đơn canh. Chính phủ Việt Nam có chính sách hỗ trợ vay vốn ưu đãi 50 triệu/ha với lãi suất 6.6%/năm qua NHCSXH.'
  },
  fire: {
    intro: 'Cháy rừng là rủi ro lớn nhất đối với người trồng keo, có thể thiêu rụi toàn bộ tài sản trong vài giờ. Phòng cháy chủ động là cách duy nhất để bảo vệ đầu tư của mình.',
    s: [
      { h: 'Đánh giá nguy cơ cháy', p: 'Thời điểm nguy hiểm nhất: tháng 12 đến tháng 4 (mùa khô). Yếu tố nguy cơ: nhiệt độ trên 35 độ C, độ ẩm không khí dưới 50%, gió mạnh cấp 4-5 trở lên. Vùng nguy cơ cao: rừng giáp khu dân cư, rừng dọc quốc lộ, rừng có nhiều cỏ khô thực bì.' },
      { h: 'Biện pháp phòng cháy', p: 'Đường băng cản lửa: làm sạch cỏ cây rộng 8-10m quanh lô rừng và dọc đường đi, làm 2 lần/năm (đầu và cuối mùa khô). Báo cấm lửa: cấm đốt nương rẫy, cấm mang lửa vào rừng trong mùa khô. Tổ đội phòng cháy cơ sở: mỗi thôn/xã có 1 tổ 5-10 người, được tập huấn và trang bị dụng cụ.' },
      { h: 'Xử lý khi xảy ra cháy', p: 'Bước 1: Gọi 119 (Phòng Cháy Chữa Cháy) và Kiểm lâm địa phương ngay lập tức. Bước 2: Sơ tán người và tài sản ra khỏi vùng nguy hiểm. Bước 3: Nếu đám cháy nhỏ (dưới 100m2), dùng cách dập cỏ, cuốc đới vùng băng cản lửa quanh đám cháy. Bước 4: Tuyệt đối không tự chữa cháy lớn, chờ lực lượng chuyên nghiệp.' }
    ],
    mistakes: 'Sai lầm nguy hiểm nhất: đốt cỏ để làm đất ngay cạnh rừng keo. Nhiều vụ cháy rừng xuất phát từ việc đốt nương rẫy không kiểm soát. Sai lầm khác: không làm đường băng cản lửa định kỳ, để cỏ khô tích tụ tạo điều kiện cháy lan nhanh.',
    exp: 'Mỗi năm Việt Nam có 500-1.000 vụ cháy rừng, thiệt hại hàng trăm tỷ đồng. Rừng keo lai là loại rừng dễ cháy nhất do lá khô và thực bì tích tụ nhiều. Chi phí làm đường băng cản lửa chỉ khoảng 1-2 triệu/ha/năm nhưng có thể cứu được hàng trăm triệu đồng tài sản.'
  },
  policy: {
    intro: 'Nhà nước có nhiều chính sách ưu đãi cho người trồng rừng, từ vay vốn lãi suất thấp đến hỗ trợ giống và kỹ thuật. Nhiều người trồng rừng chưa biết và chưa tận dụng hết các chính sách này.',
    s: [
      { h: 'Các chính sách hỗ trợ hiện hành', p: 'Nghị định 75/2015/NĐ-CP: hỗ trợ giống cà trên 50% giá trị cho hộ nghèo, cận nghèo. Quyết định 886/QĐ-TTg (Chương trình Phát triển Lâm nghiệp bền vững 2021-2025): hỗ trợ 10-15 triệu/ha cho trồng rừng mới. Chính sách tín dụng xanh: vay vốn qua NHCSXH với lãi suất 6.6%/năm, kỳ hạn 7-10 năm.' },
      { h: 'Quy trình vay vốn trồng rừng', p: 'Bước 1: Liên hệ UBND xã xác nhận là hộ có đất rừng (sổ đỏ hoặc giấy xác nhận quyền sử dụng đất). Bước 2: Liên hệ NHCSXH hoặc Ngân hàng Nông nghiệp (Agribank) chi nhánh huyện. Bước 3: Nộp hồ sơ vay: đơn vay, phương án sản xuất, giấy CMND/CCCD, giấy chứng nhận QSDĐ. Bước 4: Ngân hàng thẩm định (7-15 ngày). Bước 5: Giải ngân.' },
      { h: 'Bảo hiểm rừng trồng', p: 'Bảo hiểm Bảo Việt và Bảo Minh có sản phẩm bảo hiểm rừng trồng. Phí bảo hiểm: 1-2% giá trị rừng/năm. Mức bồi thường: lên đến 70-100% thiệt hại. Rủi ro được bảo hiểm: cháy rừng, bão, lũ, sâu bệnh lớn.' }
    ],
    mistakes: 'Nhiều hộ trồng rừng không biết đến các chính sách hỗ trợ nên tự bỏ tiền túi trong khi có thể được hỗ trợ 30-50% chi phí. Một số hộ vay vốn nhưng không lập phương án sản xuất cụ thể, dẫn đến sử dụng vốn không hiệu quả.',
    exp: 'Theo Ngân hàng Chính sách Xã hội, đến 2024 đã giải ngân trên 15.000 tỷ đồng cho vay trồng rừng. Nhưng chỉ khoảng 40% hộ trồng rừng đã tiếp cận được nguồn vốn này, 60% còn lại chưa biết hoặc chưa đủ điều kiện.'
  }
}

function getCategory(slug) {
  if (slug.match(/dat|bac-thang|xu-ly-dat|doi-troc/)) return 'soil'
  if (slug.match(/trong.*mua|mat-do|mua-kho|thoi-diem|xen-canh|lich-trong|lam-co|chong-gio/)) return 'planting'
  if (slug.match(/benh|sau|moi|ri-sat|chet-heo/)) return 'pest'
  if (slug.match(/gia-go|chi-phi|kinh-te|ban-go|vay-von/)) return 'economics'
  if (slug.match(/giong|ah[0-9]|phan-biet|that-gia|bang-gia.*giong/)) return 'variety'
  if (slug.match(/uom|vuon-uom|giam|hom|tuoi|phun-suong/)) return 'nursery'
  if (slug.match(/thu-hoach|khai-thac|go-keo.*dung|ung-dung/)) return 'harvest'
  if (slug.match(/carbon|khi-hau|fsc|chung-chi|moi-truong|xu-huong/)) return 'environment'
  if (slug.match(/dong-nai|tay-nguyen|mien|vung|kinh-nghiem(?!.*ban)/)) return 'regional'
  if (slug.match(/nuoi-ong|chan-nuoi|nong-lam|ket-hop/)) return 'agroforestry'
  if (slug.match(/chay|phong-chay/)) return 'fire'
  if (slug.match(/chinh-sach|ho-tro/)) return 'policy'
  return 'planting'
}

function generateArticle(entry) {
  const today = new Date().toISOString().split('T')[0]
  const cat = getCategory(entry.slug)
  const k = K[cat]

  const categoryImageMap = {
    soil: '/images/articles/keo-lam-dat.png',
    planting: '/images/articles/keo-plantation.png',
    pest: '/images/articles/keo-benh-cay.png',
    economics: '/images/articles/keo-kinh-te.png',
    variety: '/images/articles/keo-giong.png',
    nursery: '/images/articles/keo-uom-hom.png',
    harvest: '/images/articles/keo-kinh-te.png',
    environment: '/images/articles/keo-fsc.png',
    regional: '/images/articles/keo-vung-mien.png',
    agroforestry: '/images/articles/keo-nong-lam.png',
    fire: '/images/articles/keo-phong-chay.png',
    policy: '/images/articles/keo-plantation.png',
  }
  const articleImage = categoryImageMap[cat] || '/images/articles/keo-plantation.png'

  const frontmatter = `---
title: "${entry.title}"
description: "${entry.description}"
keywords: "${entry.keywords}"
image: ${articleImage}
label: "${entry.label}"
breadcrumb: "${entry.breadcrumb}"
date: ${today}
stats: ${entry.stats}
---`

  let body = `${entry.description}

## Tổng quan

${k.intro}

Trong bài viết này, chúng tôi tổng hợp kiến thức chuyên sâu về ${entry.breadcrumb.toLowerCase()} — từ lý thuyết đến thực hành, dựa trên kinh nghiệm của hàng nghìn hộ trồng rừng và nghiên cứu từ Viện Khoa học Lâm nghiệp Việt Nam.

`
  for (const section of k.s) {
    body += `## ${section.h}\n\n${section.p}\n\n`
  }

  body += `## Những sai lầm thường gặp\n\n${k.mistakes}\n\n`
  body += `## Kinh nghiệm thực tế từ người trồng rừng\n\n${k.exp}\n\nTheo chia sẻ của nhiều hộ nông dân có kinh nghiệm, điều quan trọng nhất là "học từ sai lầm của người khác để tránh lặp lại". Kiến thức về ${entry.breadcrumb.toLowerCase()} không chỉ đến từ sách vở mà còn từ thực tế ruộng đồng, nơi những bài học đắt giá nhất được rút ra.\n\n`

  const statsArr = entry.stats.split('|').map(s => s.trim())
  body += `## Số liệu tham khảo\n\nDưới đây là một số chỉ tiêu thực tế liên quan đến ${entry.breadcrumb.toLowerCase()}:\n\n`
  for (const stat of statsArr) {
    const parts = stat.split(':')
    if (parts.length === 2) body += `${parts[0].trim()}: ${parts[1].trim()}.\n\n`
  }

  body += `## Kết luận\n\n${entry.breadcrumb} là một khâu không thể thiếu trong quy trình trồng rừng keo lai hiệu quả. Việc nắm vững kỹ thuật, học hỏi từ kinh nghiệm thực tế, và cập nhật thông tin mới nhất giúp bạn đưa ra quyết định đúng đắn, giảm rủi ro và tối đa hóa lợi nhuận.\n\nHãy liên hệ trực tiếp qua số điện thoại 0907.282.960 (Phone/Zalo) để được tư vấn chi tiết về kỹ thuật trồng keo lai và đặt mua giống keo lai AH1 chất lượng cao.\n`

  return `${frontmatter}\n\n${body}\n`
}

function main() {
  const state = getState()
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true })

  if (isAll) {
    console.log('Generating all 30 articles...\n')
    let count = 0
    for (const entry of schedule) { if (generateOne(entry, state)) count++ }
    if (!isDryRun) saveState(state)
    console.log(`\nDone! Generated ${count} new articles.`)
    console.log(`Total articles in content/: ${fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.mdx')).length}`)
    return
  }

  if (specificDay !== null) {
    const entry = schedule.find(e => e.day === specificDay)
    if (!entry) { console.error(`No entry for day ${specificDay}`); process.exit(1) }
    generateOne(entry, state)
    if (!isDryRun) saveState(state)
    return
  }

  const startDate = new Date(state.startDate)
  const today = new Date()
  const daysDiff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1
  if (daysDiff > 30) { console.log('All 30 days completed!'); return }
  const entry = schedule.find(e => e.day === daysDiff)
  if (!entry) { console.log(`No entry for day ${daysDiff}`); return }
  generateOne(entry, state)
  if (!isDryRun) saveState(state)
}

function generateOne(entry, state) {
  const filePath = path.join(CONTENT_DIR, `${entry.slug}.mdx`)
  if (state.generated.includes(entry.slug)) {
    console.log(`  [SKIP] Day ${entry.day}: ${entry.slug} (already generated)`)
    return false
  }
  if (fs.existsSync(filePath) && !args.includes('--force')) {
    console.log(`  [SKIP] Day ${entry.day}: ${entry.slug} (file exists, use --force to overwrite)`)
    state.generated.push(entry.slug)
    return false
  }
  const content = generateArticle(entry)
  if (isDryRun) {
    console.log(`  [DRY] Day ${entry.day}: ${entry.slug} (~${content.split(/\s+/).length} words)`)
    return true
  }
  fs.writeFileSync(filePath, content, 'utf8')
  state.generated.push(entry.slug)
  console.log(`  [OK] Day ${entry.day}: ${entry.slug} (${getCategory(entry.slug)})`)
  return true
}

main()

# Interview Prep Report — Node.js Coding Test @ The Chad Digital

> Ghi chú: tài liệu này chứa nội dung liên quan đến bài test có điều khoản bảo mật (NDA) — chỉ dùng cho mục đích cá nhân chuẩn bị phỏng vấn, không chia sẻ cho bên thứ ba.

## 1. Bài test yêu cầu gì

**Đề bài:** Elevator simulator — Node.js (backend) + React.js (frontend).

| Mục | Chi tiết |
|---|---|
| Quy mô | 3 thang máy, tòa nhà 10 tầng, hoạt động song song |
| Chức năng cốt lõi | Gọi thang máy (↑/↓ theo tầng) → hệ thống tự phân bổ; chọn tầng đích trong cabin; mở giữ cửa / đóng cửa ngay |
| Luật nghiệp vụ bắt buộc | Thang máy đang chạy chỉ dừng ở tầng **cùng hướng** đang di chuyển (chuẩn SCAN/LOOK) — ví dụ trong đề: đang đi lên 1→10, tầng 5 bấm ↑ thì dừng, bấm ↓ thì không dừng ngay |
| Yêu cầu kỹ thuật | Phải thể hiện rõ OOP: encapsulation, inheritance, polymorphism |
| UI | Đơn giản được phép, nhưng phải là React.js |
| Nộp bài | Push code lên GitHub cá nhân, invite reviewer |
| Deadline | 7 ngày code, 45 phút trình bày strategy ở vòng 2 |
| Ràng buộc | Không tiết lộ nội dung đề cho bên thứ ba (NDA) |

**Điều đề bài không nói rõ** (là chỗ bạn được quyền tự quyết định và nên chủ động giải thích lý do khi present):
- Không bắt cụ thể real-time mechanism → mình chọn WebSocket (Socket.IO) để thể hiện đúng bản chất "moving between floors" theo thời gian thực.
- Không bắt TypeScript → mình chọn TS cả 2 phía để OOP (interface, access modifier) rõ ràng hơn khi trình bày.
- Không bắt thuật toán điều phối cụ thể → mình chọn SCAN/LOOK + nearest-car, đúng chuẩn công nghiệp và khớp ví dụ trong đề.

Thiết kế kỹ thuật đầy đủ (class diagram, state machine, thuật toán, WebSocket contract, cấu trúc thư mục) đã có ở [ARCHITECTURE.md](ARCHITECTURE.md).

## 2. Bối cảnh vị trí ứng tuyển (đối chiếu JD)

Vị trí: **Junior Fullstack Developer**, remote 100%, The Chad Digital (media/fintech).

| JD yêu cầu | Liên hệ với bài test |
|---|---|
| Backend thực tế: Java Spring Boot + MySQL (30%) | Bài test dùng Node.js → đây là bài kiểm tra **tư duy OOP/thiết kế**, không kiểm tra cú pháp ngôn ngữ. Cần chủ động nói rõ điều này khi present. |
| Frontend: React/Next.js/**Redux** (60%, yêu cầu vững) | Bài test không bắt Redux, nhưng nên chủ động dùng Redux/Redux Toolkit để quản lý state elevator ở client — khớp trực tiếp JD. |
| Điểm cộng: biết ứng dụng AI vào công việc | Đang thực tế dùng Claude Code để thiết kế bài test này → nên kể lại quy trình dùng AI trong lúc present. |
| Điểm cộng: Docker/Nginx | Có thể thêm 1 Dockerfile đơn giản cho app — chi phí thấp, đúng điểm cộng. |
| "Dev chủ lực... làm chủ sản phẩm", không chỉ code theo yêu cầu | Khi present, cần thể hiện tư duy ownership: trade-off, edge case, hướng maintain/mở rộng — không chỉ demo chạy được. |

## 3. Nên trình bày gì trong 45 phút (outline đề xuất)

1. **Tóm tắt đề bài & giả định đã đặt ra** (2-3 phút) — nêu rõ những chỗ đề không bắt buộc và lý do bạn chọn giải pháp (WebSocket, TS, SCAN/LOOK).
2. **Kiến trúc tổng thể** (5 phút) — sơ đồ Client (React) ⟷ WebSocket ⟷ Server (single source of truth, simulation loop).
3. **OOP design — phần trọng tâm nhất** (10-12 phút):
   - State pattern cho `Elevator` (Idle/MovingUp/MovingDown/DoorOpen) → inheritance + polymorphism.
   - Strategy pattern cho `Dispatcher` (NearestCarStrategy, có thể swap RoundRobin) → mở/đóng theo OCP.
   - Encapsulation: state private trong `Elevator`, chỉ expose qua method + snapshot.
   - *(Điểm cộng riêng cho công ty này: nói thêm 1 câu "nếu implement bằng Java Spring Boot thì State pattern sẽ..." để khớp JD thực tế.)*
4. **Thuật toán điều phối SCAN/LOOK + nearest-car** (5-7 phút) — chạy lại đúng ví dụ trong đề (tầng 5, đi lên 1→10) để chứng minh đúng luật nghiệp vụ.
5. **Demo trực tiếp** (5-8 phút) — chạy app, bấm hall call, car call, hold/close door, cho nhiều elevator hoạt động song song, có thể demo case "pending call" (bấm ↓ khi thang máy đang đi lên).
6. **AI trong quy trình làm việc** (2-3 phút) — cách dùng Claude Code: brainstorm kiến trúc, review logic, không dùng để code thay 100%.
7. **Edge cases & hướng mở rộng / testing strategy** (3-5 phút) — thể hiện ownership mindset, không chỉ "chạy được là xong".
8. **Q&A / dự phòng câu hỏi phản biện** (còn lại).

## 4. Những điểm cần tập trung ưu tiên (ranked)

1. **OOP rõ ràng, có chủ đích** — đây là yêu cầu bắt buộc duy nhất được nêu tường minh trong đề, chắc chắn sẽ bị hỏi sâu. Ưu tiên số 1.
2. **Đúng luật nghiệp vụ SCAN/LOOK** — dễ bị hỏi bằng ví dụ khác ngoài đề (vd tầng 8, elevator đi xuống) để test hiểu bản chất chứ không phải học vẹt case trong đề.
3. **Giải thích được lựa chọn kỹ thuật của mình** — vì đề không bắt cụ thể WebSocket/TS/thuật toán, phải trả lời tốt "tại sao chọn cái này mà không chọn cái khác" (so sánh với REST polling, round-robin...).
4. **Liên hệ chủ động với JD thực tế** (Redux, Java Spring Boot, AI, Docker) — vì đây là junior, thể hiện sự chủ động liên hệ giữa bài test và công việc thật sẽ nổi bật hơn ứng viên chỉ làm đúng đề.
5. **Demo chạy thật, không chỉ slide** — 3 elevator chạy song song, thấy rõ dispatch logic hoạt động đúng.

## 5. Checklist trước ngày phỏng vấn

- [ ] Code chạy được end-to-end (backend + frontend), có ít nhất vài unit test cho `NearestCarStrategy` và state machine.
- [ ] Push lên GitHub cá nhân, kiểm tra README có hướng dẫn chạy.
- [ ] Chuẩn bị sẵn 2-3 kịch bản demo: (a) 1 elevator phục vụ nhiều tầng cùng hướng, (b) pending call do ngược hướng, (c) 3 elevator cùng nhận request để thấy nearest-car hoạt động.
- [ ] Luyện nói phần OOP (state + strategy pattern) trong ~2 phút không cần nhìn slide.
- [ ] Chuẩn bị câu trả lời cho: "Tại sao không dùng REST polling?", "Thuật toán này có optimal không?", "Nếu có 10 elevator/50 tầng thì scale thế nào?", "Nếu làm bằng Java Spring Boot thì đổi gì?".
- [ ] Note ngắn 1-2 câu về cách đã dùng AI (Claude Code) trong quá trình làm bài — kể tự nhiên, không đọc thuộc lòng.

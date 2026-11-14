# ĐỀ XUẤT DỰ ÁN VÀ NGUYÊN MẪU KHUNG GIAO DIỆN TƯƠNG TÁC

**Khóa học:** Phát triển ứng dụng di động đa nền tảng  
**Tên dự án:** Study Room Booking  
**Tên nhóm:** DragonFly • **Học kỳ:** Học kỳ 1 (2026–2027) • **Hạn chót:** Tuần 4

---

## 1. ĐỘNG CƠ THỰC HIỆN DỰ ÁN VÀ VẤN ĐỀ CẦN GIẢI QUYẾT

### 1.1. Bối cảnh và không gian vấn đề thực tiễn

Sinh viên thường cần tìm phòng học phù hợp để tự học hoặc học nhóm. Việc hỏi trực tiếp, tìm phòng trống tại chỗ hoặc theo dõi lịch đặt thủ công có thể tốn thời gian, khó biết phòng còn chỗ hay không và dễ xảy ra đặt trùng. Khi sinh viên đã có booking, việc xác nhận sử dụng phòng và theo dõi thời gian cũng cần một quy trình rõ ràng.

Dự án xây dựng ứng dụng di động hỗ trợ sinh viên tra cứu phòng theo ngày và khung giờ, xem thông tin phòng, đặt chỗ và quản lý booking. Mã QR hỗ trợ check-in; nhắc lịch giúp người dùng lưu ý thời gian sử dụng. Dữ liệu booking được lưu cục bộ để ứng dụng có thể giữ booking đang chờ đồng bộ khi thiết bị tạm thời mất kết nối.

### 1.2. Chân dung người dùng mục tiêu

- **Chân dung người dùng chính:** Sinh viên đại học, khoảng 18–25 tuổi, thường học cá nhân hoặc theo nhóm trong khuôn viên trường. Người dùng cần tìm phòng còn chỗ nhanh, đặt khung giờ phù hợp và xem lại các booking của mình. Khó khăn chính là không biết tình trạng phòng cập nhật, nguy cơ trùng lịch và kết nối mạng không ổn định tại một số khu vực.
- **Người dùng hỗ trợ:** Nhân sự hoặc người được cấp quyền quét mã để xác nhận check-in booking.
- **Câu chuyện người dùng điển hình:** Trước buổi học nhóm, sinh viên đăng nhập, chọn ngày và khung giờ, duyệt danh sách phòng còn chỗ rồi tạo booking. Ứng dụng lưu booking trên thiết bị và đồng bộ lên Firebase khi có mạng. Khi đến phòng, sinh viên mở mã QR booking để check-in. Nếu đang sử dụng phòng và khung tiếp theo còn trống, người dùng có thể yêu cầu gia hạn; ứng dụng cũng có thể nhắc trước giờ bắt đầu hoặc trước khi hết giờ.

---

## 2. PHẠM VI HỆ THỐNG VÀ THÔNG SỐ KỸ THUẬT CHỨC NĂNG

| # | Danh mục tính năng | Tính năng cụ thể | Độ ưu tiên | Logic nghiệp vụ và phạm vi |
|:---:|---|---|:---:|---|
| 1 | Xác thực và hồ sơ | Đăng ký/đăng nhập bằng email, đặt lại mật khẩu, xem và cập nhật hồ sơ | Yêu cầu bắt buộc | Firebase Authentication quản lý tài khoản. Hồ sơ có thông tin liên hệ và thông tin sinh viên; người dùng có thể chọn ảnh giấy tờ để nhận diện thông tin bằng OCR rồi kiểm tra, chỉnh sửa trước khi lưu. **OAuth Google/Apple chưa được triển khai trong phiên bản hiện tại.** |
| 2 | Nghiệp vụ cốt lõi | Tra cứu phòng theo ngày/khung giờ, tạo và xem booking, hủy booking, gia hạn thời gian | Tính năng thiết yếu | Danh sách phòng và booking lưu trên Firestore. Trước khi đồng bộ booking, kiểm tra khung giờ hợp lệ, phòng tồn tại, sức chứa và booking bị trùng; chỉ booking đang sử dụng mới có thể yêu cầu gia hạn, và thời gian gia hạn phải không xung đột với lượt khác. |
| 3 | Check-in và nhắc lịch | Tạo mã QR cho booking, quét QR để check-in, nhắc trước thời gian sử dụng | Ưu tiên cao | Booking được biểu diễn bằng mã QR; thao tác check-in kiểm tra booking, chủ sở hữu/quyền quét và thời hạn check-in. Expo Notifications lên lịch nhắc giờ bắt đầu và giờ kết thúc trên bản native được hỗ trợ và khi người dùng cấp quyền. |
| 4 | Trí tuệ nhân tạo (AI) | Nhận diện ký tự trên giấy tờ / thẻ sinh viên | Cần thiết | Google ML Kit Text Recognition xử lý ảnh trên thiết bị trong bản native cài đặt. Kết quả được điền vào biểu mẫu hồ sơ để người dùng rà soát; OCR không tự động xác nhận tính chính xác của thông tin. |
| 5 | Khả năng phục hồi ngoại tuyến | Lưu booking cục bộ và đồng bộ khi có mạng | Tính năng cần thiết | SQLite lưu booking mới với trạng thái `pending`. NetInfo phát hiện thiết bị có kết nối để thử đồng bộ lên Firestore; dữ liệu booking từ xa cũng được cập nhật vào SQLite. Booking ngoại tuyến có thể bị từ chối khi đồng bộ nếu xung đột sức chứa hoặc lịch đã thay đổi. |
| 6 | Giao diện và tùy chỉnh | Điều hướng các màn hình, giao diện sáng/tối/theo hệ thống | Ưu tiên cao | React Native/Expo và React Navigation bottom tabs. Tùy chọn giao diện được lưu bằng AsyncStorage. Bố cục sử dụng Safe Area; cần kiểm thử trên các kích thước và thiết bị mục tiêu. |

### Phạm vi nguyên mẫu giao diện

Nguyên mẫu tương tác nên thể hiện các luồng chính sau:

1. **Đăng nhập / đăng ký:** nhập email và mật khẩu, chuyển sang tạo tài khoản hoặc khôi phục mật khẩu.
2. **Duyệt phòng:** chọn ngày và khung giờ, tìm kiếm/lọc phòng và xem tình trạng chỗ.
3. **Booking:** xác nhận đặt phòng, xem danh sách booking, mở QR, hủy hoặc yêu cầu gia hạn khi đủ điều kiện.
4. **Check-in:** mở camera, quét QR và hiển thị kết quả thành công hoặc lý do không hợp lệ.
5. **Hồ sơ:** cập nhật thông tin, chọn giao diện và quét giấy tờ để hỗ trợ điền thông tin.

---

## 3. CÔNG NGHỆ SỬ DỤNG VÀ KIẾN TRÚC BAN ĐẦU

- **Khung phát triển:** React Native với Expo, TypeScript.
- **Quản lý trạng thái:** React Context (`AppStateContext`) kết hợp React Hooks (`useState`, `useEffect`, `useMemo`); không sử dụng Zustand.
- **Điều hướng:** React Navigation Bottom Tabs.
- **Hệ thống phụ trợ:** Firebase Authentication và Cloud Firestore.
- **Lưu trữ cục bộ:** SQLite qua `expo-sqlite` cho booking; AsyncStorage cho chế độ giao diện và dữ liệu thông báo cục bộ.
- **Kết nối mạng:** `@react-native-community/netinfo` theo dõi kết nối để kích hoạt đồng bộ booking đang chờ.
- **Công cụ AI:** Google ML Kit Text Recognition qua `@react-native-ml-kit/text-recognition`, dùng để nhận diện văn bản trên ảnh giấy tờ.
- **Thông báo và camera:** `expo-notifications`, `expo-camera`, `expo-image-picker`.
- **Kiến trúc mã nguồn:** phân chia theo `domain` (entity, repository interface, use case), `data` (DTO, mapper, repository), `services`, `screens`, `components`, `context` và `navigation`.
- **URL mẫu Figma:** (https://www.figma.com/design/b66Lfwc4Vlca3rtvq0cyRD/Untitled?node-id=0-1&t=HVrUCVCrVjcOlou9-1)

---

## 4. GIỚI HẠN VÀ GIẢ ĐỊNH BAN ĐẦU

- Phiên bản hiện tại xác thực bằng email/mật khẩu; đăng nhập OAuth Google/Apple không nằm trong phạm vi đã triển khai.
- Booking tạo khi ngoại tuyến được lưu cục bộ trước; việc kiểm tra xung đột cuối cùng diễn ra khi có thể đồng bộ với Firestore.
- OCR chỉ hỗ trợ trích xuất văn bản để người dùng rà soát, không thay thế bước xác minh danh tính.
- Check-in QR, OCR trên thiết bị và thông báo native cần được kiểm thử trên bản cài đặt native có quyền camera/thông báo phù hợp; không nên giả định mọi chức năng native hoạt động trong Expo Go hoặc trình duyệt.


# ĐỒ ÁN MÔN HỌC: LẬP TRÌNH GIS
## Đề tài: XÂY DỰNG HỆ THỐNG BẢN ĐỒ DU LỊCH THÔNG MINH (SMART TRAVEL MAP)

### THÔNG TIN CHUNG
* **Đơn vị:** Khoa Công nghệ thông tin - Trường Đại học Tài nguyên và Môi trường TP.HCM (HCMUNRE)
* **Giảng viên hướng dẫn:** 
   1. Ths. Nguyễn Duy Tuấn 
   2. CN. Nguyễn Phan Chí Thành 
* **Thực hiện:** Nhóm 1
   1. Ngô Quốc Thiên Bảo_1250080015
   2. Nguyễn Minh Chiến_1250080024
   3. Nguyễn Văn Danh_1250080027

---

### Giới thiệu dự án
**“Xây dựng hệ thống bản đồ du lịch thông minh”** không chỉ là một ứng dụng tra cứu thông thường, mà là một giải pháp chuyển đổi số trong lĩnh vực du lịch tại TP.HCM. Dự án ra đời nhằm tối ưu hóa trải nghiệm khám phá đô thị, giúp người dùng dễ dàng tiếp cận hệ sinh thái dịch vụ đa dạng từ ẩm thực, lưu trú đến các di tích lịch sử và tiện ích công cộng.

Hệ thống được xây dựng trên nền tảng Django Framework, kết hợp cùng khả năng xử lý dữ liệu không gian mạnh mẽ của PostgreSQL/PostGIS. Với giao diện trực quan từ thư viện Leaflet.js, ứng dụng cung cấp cái nhìn toàn cảnh về 22 quận, huyện của thành phố. Điểm nhấn của dự án nằm ở khả năng tích hợp đa nền tảng dữ liệu (Thời tiết, Chỉ đường thông minh) và hệ thống hình ảnh sinh động, mang lại trải nghiệm tương tác thực tế và hiệu quả cho du khách.---

### Tính năng nổi bật

| Tính năng | Mô tả | Thư mục/Tệp liên quan |
|-----------|-------|------------------------|
| **Bản đồ tương tác** | Tích hợp Leaflet.js để hiển thị bản đồ mượt mà | `AppGIS/templates/`, `AppGIS/static/js/` |
| **Phân loại địa điểm** | Marker riêng cho Nhà hàng, Khách sạn, ATM, Giải trí, Di tích | `AppGIS/views.py`, `AppGIS/models.py`, `AppGIS/templates/` |
| **Dữ liệu JSON** | Hiển thị nhiều ảnh cho mỗi địa điểm (menu_imgs, img) | `AppGIS/models.py`, `AppGIS/serializers.py` |
| **Công cụ tiện ích** | Tìm vị trí hiện tại, lưu địa điểm yêu thích | `AppGIS/static/js/` (LocalStorage, script xử lý) |
| **Chỉ đường thông minh** | Tích hợp OpenRouteService API | `AppGIS/static/js/`, `AppGIS/templates/` |
| **Thông tin thời tiết** | Lấy dữ liệu từ OpenWeatherMap API | `AppGIS/static/js/`, `AppGIS/templates/` |

---

### Công nghệ sử dụng

| Thành phần | Công nghệ | Thư mục/Tệp liên quan |
|------------|-----------|------------------------|
| **Backend** | Python + Django Framework | `manage.py`, `AppGIS/` |
| **Database** | PostgreSQL + PostGIS (lưu trữ tọa độ địa lý) | `AppGIS/models.py`, `AppGIS/migrations/` |
| **Frontend** | HTML5, CSS3 (Bootstrap), JavaScript | `AppGIS/templates/`, `AppGIS/static/css/`, `AppGIS/static/js/` |
| **Map Library** | Leaflet.js + OpenStreetMap | `AppGIS/templates/`, `AppGIS/static/js/` |
| **API tích hợp** | OpenRouteService, OpenWeatherMap | `AppGIS/static/js/` |
| **Static Assets** | Hình ảnh phân loại (restaurants, hotels, parks, monuments, atm, pharmacy, tour) | `AppGIS/static/images/` |

### Cấu trúc thư mục dự án

| Thư mục/Tệp | Vai trò |
|-------------|---------|
| **.vscode/** | Cấu hình cho VSCode |
| └── **settings.json** | Thiết lập môi trường làm việc |
| **Django/** | Thư mục chính của project Django |
| ├── **AppGIS/** | Ứng dụng chính (app) |
| │   ├── **migrations/** | Các file migration cho database |
| │   ├── **static/** | Tài nguyên tĩnh (CSS, JS, Images) |
| │   │   ├── **css/** | File giao diện (Bootstrap, style.css, …) |
| │   │   ├── **js/** | Script JavaScript |
| │   │   └── **images/** | Hình ảnh phân loại |
| │   │       ├── **restaurants/** | Ảnh nhà hàng |
| │   │       ├── **hotels/** | Ảnh khách sạn |
| │   │       ├── **parks/** | Ảnh công viên, khu vui chơi |
| │   │       ├── **monuments/** | Ảnh di tích, chùa, nhà thờ |
| │   │       ├── **atm/** | Ảnh ATM |
| │   │       ├── **pharmacy/** | Ảnh nhà thuốc |
| │   │       ├── **tour/** | Ảnh tour du lịch |
| │   │       ├── **ThanhVien/** | Ảnh thành viên nhóm |
| │   │       └── **ThuVien/** | Tài liệu tham khảo |
| │   ├── **templates/** | Giao diện HTML |
| │   ├── **admin.py** | Cấu hình trang admin |
| │   ├── **apps.py** | Khai báo app |
| │   ├── **forms.py** | Form nhập liệu |
| │   ├── **models.py** | Định nghĩa bảng dữ liệu |
| │   ├── **serializers.py** | API serializer |
| │   ├── **urls.py** | Định tuyến URL |
| │   ├── **views.py** | Xử lý logic hiển thị |
| │   └── **tests.py** | Unit test |
| ├── **media/** | File upload |
| ├── **static/** | Static chung |
| ├── **manage.py** | File quản lý Django project |
| ├── **db.sqlite3** | Database mặc định (có thể thay bằng PostgreSQL) |
| └── **.gitignore** | Loại trừ file/thư mục khi commit |
| **README.md** | Tài liệu hướng dẫn dự án |
| **tree_dep.txt** | File xuất cấu trúc thư mục |

### Hướng dẫn cài đặt
1. **Clone dự án:**
   ```bash
   git clone https://github.com/thienbaongo200-creator/SmartTravel.git
   cd SmartTravel
2. **Cấu hình Database PostgreSQL:**
- Mở psql:
   ```bash
   psql -U postgres
- Tạo database:
   ```bash
   CREATE DATABASE webgisuser;
- (Lưu ý: Thoát psql bằng lệnh \q trước khi nạp dữ liệu)
3. **Nạp dữ liệu từ file backup (.sql):**
- Ví dụ file webgisuser.sql nằm trong thư mục C:\Users\Bao Bao\Documents\LAPTRINHGIS_Nhóm 1:
   ```bash
   pg_restore -U postgres -d webgisuser "C:\Users\Bao Bao\Documents\LAPTRINHGIS_Nhóm 1\webgisuser.sql"
4. **Chạy migrations để đồng bộ Django với database:**
   ```bash
   python manage.py makemigrations AppGIS
   python manage.py migrate
- (Lưu ý: Nhớ cd Django trước khi chạy migrations)
5. **Chạy server:**
   ```bash
   python manage.py runserver
6. **Truy cập ứng dụng:**
   ```bash
   Mở trình duyệt tại: http://127.0.0.1:8000
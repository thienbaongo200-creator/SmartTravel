# SmartTravel# 🗺️ SMART TRAVEL MAP - HO CHI MINH CITY

Hệ thống thông tin địa lý (WebGIS) hỗ trợ tìm kiếm địa điểm du lịch, nhà hàng và tiện ích thông minh tại TP. Hồ Chí Minh.

---

## Giới thiệu dự án
Dự án được xây dựng trên nền tảng **Django** và **Leaflet.js**, giúp người dùng tương tác trực tiếp với bản đồ để tìm kiếm các địa điểm ăn uống, vui chơi và tiện ích công cộng.
* **Độ phủ:** 22 quận huyện TP.HCM (từ Củ Chi đến Cần Giờ).
* **Tính năng chính:** Hiển thị Marker theo Category, Popup thông tin chi tiết, Slider ảnh địa điểm.

## ✨ Tính năng nổi bật
- [x] **Bản đồ tương tác:** Tích hợp Leaflet.js mượt mà.
- [x] **Phân loại địa điểm:** Marker riêng biệt cho Nhà hàng, Khách sạn, ATM, Giải trí.
- [x] **Dữ liệu JSON:** Hiển thị nhiều ảnh cho mỗi địa điểm (Menu/Không gian).
- [x] **Công cụ tiện ích:** Tìm vị trí hiện tại, lưu địa điểm yêu thích.

## 🛠️ Công nghệ sử dụng
* **Backend:** `Python` + `Django Framework`
* **Database:** `PostgreSQL` + `PostGIS` (Lưu trữ tọa độ địa lý)
* **Frontend:** `HTML5`, `CSS3 (Bootstrap)`, `JavaScript`
* **Map Library:** `Leaflet.js` + `OpenStreetMap`

## 📂 Cấu trúc Cơ sở dữ liệu (PostgreSQL)
Bảng chính `AppGIS_tourismpoint` bao gồm:
| Cột | Mô tả |
| :--- | :--- |
| `name` | Tên địa điểm |
| `latitude` / `longitude` | Tọa độ chuẩn WGS84 |
| `menu_imgs` | Mảng JSON chứa danh sách ảnh chi tiết |
| `category_id` | Khóa ngoại phân loại địa điểm |

## 🛠️ Hướng dẫn cài đặt
1. **Clone dự án:**
   ```bash
   git clone [https://github.com/yourusername/smart-travel-map.git](https://github.com/yourusername/smart-travel-map.git)

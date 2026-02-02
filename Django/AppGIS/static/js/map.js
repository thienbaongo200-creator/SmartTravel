// Khởi tạo bản đồ
var map = L.map('map').setView([10.762622, 106.660172], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

var searchMarker = null;

// Hàm hiển thị thông tin lên Panel bên trái
function displayInfo(p) {
    const panel = document.getElementById("info-panel");
    const content = document.getElementById("info-content");

    panel.style.display = "block";
    content.innerHTML = `
        <div class="info-header">
            <img src="${p.img || 'https://via.placeholder.com/300x180?text=No+Image'}" alt="${p.name}">
        </div>
        <div class="info-body">
            <h2>${p.name}</h2>
            <p><strong>⭐ Đánh giá:</strong> ${p.rating || 'Chưa có'}</p>
            <p><strong>📍 Địa chỉ:</strong> ${p.address || 'Đang cập nhật'}</p>
            <p><strong>⏰ Giờ mở cửa:</strong> ${p.open_hours || '8:00 - 21:00'}</p>
            <p><strong>ℹ️ Mô tả:</strong> ${p.description || 'Không có mô tả chi tiết.'}</p>
            <hr>
            <button onclick="map.setView([${p.latitude}, ${p.longitude}], 18)" style="width:100%; padding:8px; cursor:pointer;">Phóng to vị trí</button>
        </div>
    `;
}

// Hàm tìm kiếm
function searchPlace() {
    let query = document.getElementById("searchBox").value;
    if (!query) return;

    fetch(`/search/?q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => {
          if (data.length > 0) {
              let p = data[0];

              // Xóa marker cũ nếu có
              if (searchMarker) map.removeLayer(searchMarker);

              // Nhảy tới vị trí
              map.setView([p.latitude, p.longitude], 16);

              // Thêm marker mới
              searchMarker = L.marker([p.latitude, p.longitude]).addTo(map)
                              .bindPopup(`<b>${p.name}</b>`).openPopup();

              // HIỆN THÔNG TIN CHI TIẾT
              displayInfo(p);
          } else {
              alert("Không tìm thấy địa điểm này trong hệ thống!");
          }
      });
}

// Lắng nghe phím Enter
document.getElementById("searchBox").addEventListener("keypress", function(e) {
    if (e.key === "Enter") searchPlace();
});

// Định vị người dùng
function locateUser() {
    document.getElementById("loading").style.display = "block";
    navigator.geolocation.getCurrentPosition(function(pos) {
        let lat = pos.coords.latitude;
        let lng = pos.coords.longitude;
        map.setView([lat, lng], 15);
        L.marker([lat, lng]).addTo(map).bindPopup("Vị trí của bạn").openPopup();
        document.getElementById("loading").style.display = "none";
    }, function() {
        alert("Lỗi định vị!");
        document.getElementById("loading").style.display = "none";
    });
}
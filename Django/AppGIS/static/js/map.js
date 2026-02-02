// ==============================
// 1. Khởi tạo bản đồ
// ==============================
var map = L.map('map').setView([10.762622, 106.660172], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

var searchMarker = null;
var userMarker = null;
var routeLine = null;

// ==============================
// 2. Chức năng Hiển thị & Tuyến đường
// ==============================

// Hàm hiển thị thông tin lên Panel bên trái (Google Maps Style)
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
            <p><strong>ℹ️ Mô tả:</strong> ${p.description || p.desc || 'Không có mô tả chi tiết.'}</p>
            <hr>
            <div style="display: flex; gap: 5px;">
                <button onclick="showRoute(${p.latitude}, ${p.longitude})" style="flex:1; padding:10px; cursor:pointer; background:#1a73e8; color:white; border:none; border-radius:4px;">🚗 Chỉ đường</button>
                <button onclick="map.setView([${p.latitude}, ${p.longitude}], 18)" style="flex:1; padding:10px; cursor:pointer;">🔍 Phóng to</button>
            </div>
        </div>
    `;
}

// Hàm vẽ tuyến đường từ người dùng đến điểm đến
function showRoute(destLat, destLng) {
    if (!userMarker) {
        alert("Vui lòng nhấn 'Vị trí của tôi' để bật định vị trước khi xem chỉ đường!");
        return;
    }

    let userLatLng = userMarker.getLatLng();

    // Xóa tuyến đường cũ nếu có
    if (routeLine) {
        map.removeLayer(routeLine);
    }

    // Vẽ đường thẳng (Polyline) nối 2 điểm
    routeLine = L.polyline([
        [userLatLng.lat, userLatLng.lng],
        [destLat, destLng]
    ], { color: '#1a73e8', weight: 5, opacity: 0.7, dashArray: '10, 10' }).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
}

// ==============================
// 3. Chức năng Tìm kiếm & Lọc
// ==============================

function searchPlace() {
    let query = document.getElementById("searchBox").value;
    if (!query) return;

    fetch(`/search/?q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => {
          if (data.length > 0) {
              let p = data[0];

              if (searchMarker) map.removeLayer(searchMarker);

              map.setView([p.latitude, p.longitude], 16);

              searchMarker = L.marker([p.latitude, p.longitude]).addTo(map)
                              .bindPopup(`<b>${p.name}</b>`).openPopup();

              displayInfo(p);
          } else {
              alert("Không tìm thấy địa điểm này!");
          }
      });
}

// Lắng nghe phím Enter cho ô tìm kiếm
document.getElementById("searchBox").addEventListener("keypress", function(e) {
    if (e.key === "Enter") searchPlace();
});

// Hàm chọn phương tiện từ Sidebar
function selectTransport(type, el) {
    document.querySelectorAll("#sidebar li").forEach(li => li.classList.remove("active"));
    el.classList.add("active");
    alert("Hệ thống sẽ tính toán tuyến đường cho: " + type);
}

// ==============================
// 4. Định vị & Dữ liệu GeoJSON
// ==============================

function locateUser() {
    if (!navigator.geolocation) {
        alert("Trình duyệt của bạn không hỗ trợ định vị.");
        return;
    }

    document.getElementById("loading").style.display = "block";

    navigator.geolocation.watchPosition(
        function (position) {
            let lat = position.coords.latitude;
            let lng = position.coords.longitude;

            if (userMarker) {
                userMarker.setLatLng([lat, lng]);
            } else {
                userMarker = L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: 'user-location-icon',
                        html: '<div style="background-color:#1a73e8; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>'
                    })
                }).addTo(map).bindPopup("Vị trí của bạn").openPopup();
            }

            map.setView([lat, lng], 15);
            document.getElementById("loading").style.display = "none";
        },
        function (error) {
            alert("Không thể lấy vị trí: " + error.message);
            document.getElementById("loading").style.display = "none";
        },
        { enableHighAccuracy: true, timeout: 15000 }
    );
}

// Load dữ liệu GeoJSON tĩnh (nếu có)
fetch("/static/data/data.geojson")
  .then(res => res.json())
  .then(data => {
      L.geoJSON(data, {
          onEachFeature: function (feature, layer) {
              layer.on('click', function() {
                  let p = feature.properties;
                  // Map lại các trường từ GeoJSON sang định dạng Panel
                  displayInfo({
                      name: p.name,
                      img: p.img,
                      rating: p.rating,
                      address: p.address,
                      open_hours: p.open_hours,
                      description: p.desc,
                      latitude: feature.geometry.coordinates[1],
                      longitude: feature.geometry.coordinates[0]
                  });
              });
          }
      }).addTo(map);
  }).catch(err => console.log("Không tìm thấy file GeoJSON, sử dụng dữ liệu database."));
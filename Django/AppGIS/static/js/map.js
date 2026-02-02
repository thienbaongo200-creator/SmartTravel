// Khởi tạo bản đồ
var map = L.map('map').setView([10.762622, 106.660172], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

let userMarker = null;
let routeLine = null;

// Hàm vẽ tuyến đường đơn giản từ vị trí người dùng đến điểm đến
function showRoute(destLat, destLng) {
    if (!userMarker) {
        alert("Bạn cần bật định vị trước!");
        return;
    }

    let userLatLng = userMarker.getLatLng();

    // Xóa tuyến đường cũ nếu có
    if (routeLine) {
        map.removeLayer(routeLine);
    }

    // Vẽ polyline
    routeLine = L.polyline([
        [userLatLng.lat, userLatLng.lng],
        [destLat, destLng]
    ], { color: 'blue', weight: 4 }).addTo(map);

    map.fitBounds(routeLine.getBounds());
}

// Load dữ liệu GeoJSON và hiển thị popup
fetch("/static/data/data.geojson")
  .then(res => res.json())
  .then(data => {
      L.geoJSON(data, {
          onEachFeature: function (feature, layer) {
              let p = feature.properties;
              let lat = feature.geometry.coordinates[1];
              let lng = feature.geometry.coordinates[0];

              let popupContent = `
                <div style="text-align:center;">
                  <h3 style="color:#3498db;">${p.name}</h3>
                  <img src="${p.img}" width="220" style="border-radius:8px; margin:10px 0;">
                  <p><strong>Loại:</strong> ${p.type || "Địa điểm"}</p>
                  <p><strong>Đánh giá:</strong> ⭐ ${p.rating || "Chưa có"}</p>
                  <p><strong>Địa chỉ:</strong> ${p.address || "Đang cập nhật"}</p>
                  <p><strong>Giờ mở cửa:</strong> ${p.open_hours || "Không rõ"}</p>
                  <p>${p.desc}</p>
                  <button onclick="showRoute(${lat}, ${lng})"
                          style="margin-top:10px; padding:6px 12px; background:#3498db; color:white; border:none; border-radius:5px;">
                      🚗 Chỉ đường
                  </button>
                  <button onclick="showDistance(${p.id}, ${lat}, ${lng})"
                          style="margin-top:10px; padding:6px 12px; background:#2ecc71; color:white; border:none; border-radius:5px;">
                      📏 Tính khoảng cách
                  </button>
                </div>
              `;
              layer.bindPopup(popupContent);
          }
      }).addTo(map);
  });

// Hàm tìm kiếm địa điểm
function searchPlace() {
    let query = document.getElementById("searchBox").value;
    if (!query) return;

    fetch(`/search/?q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => {
          if (data.length > 0) {
              let p = data[0];
              map.setView([p.latitude, p.longitude], 16);
              L.marker([p.latitude, p.longitude])
                .addTo(map)
                .bindPopup(`<b>${p.name}</b><br>${p.description}`)
                .openPopup();
          } else {
              alert("Không tìm thấy địa điểm!");
          }
      });
}

// Quản lý chọn phương tiện
let selectedTransport = null;
function selectTransport(type, el) {
    selectedTransport = type;

    document.querySelectorAll("#sidebar li").forEach(li => {
        li.classList.remove("active");
    });

    el.classList.add("active");

    alert("Bạn đã chọn phương tiện: " + type);
}

// Định vị người dùng
function locateUser() {
    if (!navigator.geolocation) {
        alert("Trình duyệt không hỗ trợ định vị!");
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
                userMarker = L.marker([lat, lng])
                    .addTo(map)
                    .bindPopup("📍 Vị trí của bạn")
                    .openPopup();
            }

            map.setView([lat, lng], 15);
            document.getElementById("loading").style.display = "none";
        },
        function (error) {
            console.error("Geolocation error:", error);
            alert("Không thể lấy vị trí. Mã lỗi: " + error.code + " - " + error.message);
            document.getElementById("loading").style.display = "none";
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
}

// Hàm gọi API tính khoảng cách/thời gian
function showDistance(pointId, userLat, userLng) {
    if (!userMarker) {
        alert("Bạn cần bật định vị trước!");
        return;
    }

    let pos = userMarker.getLatLng();

    fetch(`/distance/${pointId}/?lat=${pos.lat}&lng=${pos.lng}`)
      .then(res => res.json())
      .then(data => {
          if (!data.error) {
              alert(`📍 Địa điểm: ${data.point}\n📏 Khoảng cách: ${data.distance_km} km\n⏱️ Thời gian dự kiến: ${data.time_minutes} phút`);
          } else {
              alert("Lỗi: " + data.error);
          }
      });
}
// Khởi tạo bản đồ
var map = L.map('map').setView([10.762622, 106.660172], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// Load dữ liệu GeoJSON
fetch("/static/data/data.geojson")
  .then(res => res.json())
  .then(data => {
      L.geoJSON(data, {
          onEachFeature: function (feature, layer) {
              let p = feature.properties;
              let popupContent = `
                <div style="text-align:center;">
                  <h3 style="color:#3498db;">${p.name}</h3>
                  <img src="${p.img}" width="220" style="border-radius:8px; margin:10px 0;">
                  <p><strong>Loại:</strong> ${p.type || "Địa điểm"}</p>
                  <p><strong>Đánh giá:</strong> ⭐ ${p.rating || "Chưa có"}</p>
                  <p><strong>Địa chỉ:</strong> ${p.address || "Đang cập nhật"}</p>
                  <p><strong>Giờ mở cửa:</strong> ${p.open_hours || "Không rõ"}</p>
                  <p>${p.desc}</p>
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

    // Xóa trạng thái active cũ
    document.querySelectorAll("#sidebar li").forEach(li => {
        li.classList.remove("active");
    });

    // Đánh dấu item vừa chọn
    el.classList.add("active");

    // Hiển thị thông báo
    alert("Bạn đã chọn phương tiện: " + type);
}
let userMarker = null; 

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
                    map.removeLayer(userMarker);
                }

                userMarker = L.marker([lat, lng]).addTo(map).bindPopup("Vị trí của bạn").openPopup();

                map.setView([lat, lng], 15);

                document.getElementById("loading").style.display = "none";
            },
            function (error) {
                alert("Không thể lấy vị trí: " + error.message);
                document.getElementById("loading").style.display = "none";
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    }

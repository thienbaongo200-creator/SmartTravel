// ==============================
// 1. Khởi tạo bản đồ
// ==============================
if (typeof map !== "undefined") {
    map.remove(); // xóa bản đồ cũ nếu đã tồn tại
}
var map = L.map('map').setView([10.762622, 106.660172], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

var searchMarker = null;
var userMarker = null;
var routeLine = null;
var geojsonLayer = null;
var watchId = null;
var selectedTransport = "driving";

// Hàm hiển thị thông tin địa điểm
function displayInfo(p) {
    const panel = document.getElementById("info-panel");
    const content = document.getElementById("info-content");

    let imgFile = p.img ? p.img.replace("images/", "") : "no-image.jpg";
    let imgPath = "/static/images/" + imgFile;

    panel.style.display = "block";
    content.innerHTML = `
        <div class="info-header">
            <img src="${imgPath}" alt="${p.name}">
        </div>
        <div class="info-body">
            <h2>${p.name}</h2>
            <p><strong>⭐ Đánh giá:</strong> ${p.rating || 'Chưa có'}</p>
            <p><strong>📍 Địa chỉ:</strong> ${p.address || 'Đang cập nhật'}</p>
            <p><strong>⏰ Giờ mở cửa:</strong> ${p.open_hours || '8:00 - 21:00'}</p>
            <p><strong>ℹ️ Mô tả:</strong> ${p.description || 'Không có mô tả.'}</p>
            <label for="transport">Phương tiện:</label>
            <select id="transport">
                <option value="DRIVING">🚗 Ô tô</option>
                <option value="WALKING">🚶 Đi bộ</option>
                <option value="BICYCLING">🚴 Xe đạp</option>
                <option value="TRANSIT">🚌 Xe buýt</option>
            </select>
            <button onclick="showRouteORS(${p.latitude}, ${p.longitude})" class="btn-direction">
                <i class="fa-solid fa-route"></i> Hướng đi
            </button>
        </div>
    `;
}
//API Key: eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjlkNWI2M2RiODZmNzQzODA5ODM0NDVjOTZkYTFmMGRkIiwiaCI6Im11cm11cjY0In0=
async function showRouteORS(destLat, destLng) {
    if (!userMarker) {
        alert("Vui lòng bật định vị trước khi xem chỉ đường!");
        return;
    }

    let userLatLng = userMarker.getLatLng();
    const transportSelect = document.getElementById("transport");
    let mode = transportSelect ? transportSelect.value : "DRIVING";

    let orsProfile = "driving-car";
    if (mode === "WALKING") orsProfile = "foot-walking";
    else if (mode === "BICYCLING") orsProfile = "cycling-regular";
    else if (mode === "TRANSIT") {
        alert("ORS chưa hỗ trợ phương tiện công cộng!");
        return;
    }

    try {
        let response = await fetch(
            `https://api.openrouteservice.org/v2/directions/${orsProfile}`,
            {
                method: "POST",
                headers: {
                    "Authorization": "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjlkNWI2M2RiODZmNzQzODA5ODM0NDVjOTZkYTFmMGRkIiwiaCI6Im11cm11cjY0In0=", 
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    coordinates: [
                        [userLatLng.lng, userLatLng.lat], 
                        [destLng, destLat]               
                    ]
                })
            }
        );

        let data = await response.json();
        console.log("ORS data:", data);

        if (!data.routes || data.routes.length === 0) {
            alert("Không tìm thấy tuyến đường!");
            return;
        }

        let route = data.routes[0];
        let distanceKm = (route.summary.distance / 1000).toFixed(2);
        let durationMin = (route.summary.duration / 60).toFixed(1);

        if (route.geometry) {
            let coords = polyline.decode(route.geometry).map(c => [c[0], c[1]]);
            if (routeLine) map.removeLayer(routeLine);
            routeLine = L.polyline(coords, { color: '#1a73e8', weight: 5 }).addTo(map);
            map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
        } else {
            console.error("Không có geometry:", route);
            alert("ORS không trả về dữ liệu hình học!");
            return;
        }

        // Hiển thị thông tin
        document.getElementById("info-panel").style.display = "block";
        document.getElementById("route-summary").innerText = `📏 ${distanceKm} km | ⏱ ${durationMin} phút`;
        document.getElementById("route-detail").innerHTML = `
            <h4>Thông tin di chuyển</h4>
            <p><strong>Phương tiện:</strong> ${mode}</p>
            <p><strong>Khoảng cách:</strong> ${distanceKm} km</p>
            <p><strong>Thời gian dự kiến:</strong> ${durationMin} phút</p>
        `;

        // Nút lưu
        const saveBtn = document.getElementById("save-route-btn");
        saveBtn.style.display = "block";
        saveBtn.onclick = function() {
            saveRoute({
                transport: mode,
                distance: distanceKm + " km",
                duration: durationMin + " phút",
                destination: { lat: destLat, lng: destLng }
            });
        };

    } catch (err) {
        console.error("ORS error:", err);
        alert("Có lỗi khi gọi OpenRouteService!");
    }
}

// Hàm lưu tuyến đường vào localStorage
function saveRoute(routeData) {
    let routes = JSON.parse(localStorage.getItem("savedRoutes")) || [];
    routes.push(routeData);
    localStorage.setItem("savedRoutes", JSON.stringify(routes));
    alert("✅ Tuyến đường đã được lưu!");
}

// Hàm xem lại tuyến đường đã lưu
function showSavedRoutes() {
    let routes = JSON.parse(localStorage.getItem("savedRoutes")) || [];
    if (routes.length === 0) {
        alert("Chưa có tuyến đường nào được lưu!");
        return;
    }
    let list = "<h4>Tuyến đường đã lưu:</h4><ul>";
    routes.forEach((r, i) => {
        list += `<li>${i+1}. ${r.transport} - ${r.distance} - ${r.duration}</li>`;
    });
    list += "</ul>";
    document.getElementById("route-detail").innerHTML = list;
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

              map.flyTo([p.latitude, p.longitude], 16);
              searchMarker = L.marker([p.latitude, p.longitude]).addTo(map)
                               .bindPopup(`<b>${p.name}</b>`).openPopup();
              
              displayInfo({
                  name: p.name,
                  img: p.img,
                  rating: p.rating,
                  address: p.address,
                  open_hours: p.open_hours,
                  description: p.description || p.desc,
                  latitude: p.latitude,
                  longitude: p.longitude
              });
          } else {
              alert("Không tìm thấy địa điểm này!");
          }
      });
}

document.getElementById("searchBox").addEventListener("keypress", function(e) {
    if (e.key === "Enter") searchPlace();
});

function selectTransport(type, el) {
    selectedTransport = type;

    document.querySelectorAll("#sidebar li").forEach(li => li.classList.remove("active"));
    el.classList.add("active");
    alert("Phương tiện đã chọn: " + type);
}

function filterCategory(category) {
    map.eachLayer(function (layer) {
        if (layer instanceof L.Marker && layer !== userMarker) map.removeLayer(layer);
    });

    fetch("/static/data/data.geojson")
      .then(res => res.json())
      .then(data => {
          geojsonLayer = L.geoJSON(data, {
              filter: function (f) { return f.properties.type === category; },
              onEachFeature: function (feature, layer) {
                  layer.on('click', function() {
                      let p = feature.properties;
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
      });
}

// ==============================
// 4. Định vị & Dữ liệu GeoJSON
// ==============================

function locateUser() {
    if (!navigator.geolocation) {
        alert("Trình duyệt không hỗ trợ định vị.");
        return;
    }

    document.getElementById("loading").style.display = "block";

    if (watchId !== null) navigator.geolocation.clearWatch(watchId);

    navigator.geolocation.getCurrentPosition(
        function (position) {
            let lat = position.coords.latitude;
            let lng = position.coords.longitude;

            if (userMarker) {
                userMarker.setLatLng([lat, lng]);
            } else {
                userMarker = L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: 'user-marker',
                        html: '<div style="background:#1a73e8; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>'
                    })
                }).addTo(map).bindPopup("Vị trí của bạn").openPopup();
            }

            map.setView([lat, lng], 15);
            document.getElementById("loading").style.display = "none";

            watchId = navigator.geolocation.watchPosition(function (pos) {
                userMarker.setLatLng([pos.coords.latitude, pos.coords.longitude]);
            }, null, { enableHighAccuracy: true });
        },
        function (error) {
            alert("Lỗi định vị: " + error.message);
            document.getElementById("loading").style.display = "none";
        },
        { enableHighAccuracy: true, timeout: 15000 }
    );
}
// ==============================
// 5. Tự động xử lý tìm kiếm từ URL (Kết nối với trang Hotels)
// ==============================
function checkURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search');

    if (searchQuery) {
        const searchBox = document.getElementById("searchBox");
        if (searchBox) {
            searchBox.value = decodeURIComponent(searchQuery);

            // Đợi bản đồ ổn định rồi tự động thực hiện tìm kiếm
            setTimeout(() => {
                searchPlace(); 
            }, 1000);
        }
    }
}

document.addEventListener("DOMContentLoaded", checkURLParameters);
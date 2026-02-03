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
var geojsonLayer = null;
var watchId = null;
var selectedTransport = "driving";

// ==============================
// 2. Chức năng Hiển thị & Tuyến đường
// ==============================

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
            <p><strong>ℹ️ Mô tả:</strong> ${p.description || p.desc || 'Không có mô tả.'}</p>
            <hr>
            <div style="display: flex; gap: 5px;">
                <button onclick="showRouteGoogle(${p.latitude}, ${p.longitude})" style="flex:1; padding:10px; cursor:pointer; background:#1a73e8; color:white; border:none; border-radius:4px;">🚗 Chỉ đường</button>
                <button onclick="map.setView([${p.latitude}, ${p.longitude}], 18)" style="flex:1; padding:10px; cursor:pointer;">🔍 Phóng to</button>
            </div>
        </div>
    `;
}

function showRouteGoogle(destLat, destLng) {
    if (!userMarker) {
        alert("Vui lòng bật định vị trước khi xem chỉ đường!");
        return;
    }

    let userLatLng = userMarker.getLatLng();

    let mode = "driving";
    switch (selectedTransport) {
        case "walking":   mode = "walking"; break;
        case "car":       mode = "driving"; break;
        case "motorbike": mode = "driving"; break; 
        case "bus":       mode = "transit"; break;
    }

    const directionsService = new google.maps.DirectionsService();

    directionsService.route({
        origin: { lat: userLatLng.lat, lng: userLatLng.lng },
        destination: { lat: destLat, lng: destLng },
        travelMode: mode.toUpperCase()
    }, (result, status) => {
        if (status === "OK") {
            let leg = result.routes[0].legs[0];
            let distanceKm = leg.distance.value / 1000;
            let distanceText = leg.distance.text;
            let durationText = leg.duration.text;

            if (selectedTransport === "motorbike") {
                let durationMin = ((distanceKm / 30) * 60).toFixed(1);
                durationText = durationMin + " phút (ước lượng xe máy)";
            }

            let path = google.maps.geometry.encoding.decodePath(result.routes[0].overview_polyline.points);
            let coords = path.map(p => [p.lat(), p.lng()]);

            if (routeLine) map.removeLayer(routeLine);
            routeLine = L.polyline(coords, { color: '#1a73e8', weight: 5 }).addTo(map);
            map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

            document.getElementById("route-summary").innerText = `📏 ${distanceText} | ⏱ ${durationText}`;
            document.getElementById("route-detail").innerHTML = `
                <h4>Thông tin di chuyển</h4>
                <p><strong>Phương tiện:</strong> ${selectedTransport}</p>
                <p><strong>Khoảng cách:</strong> ${distanceText}</p>
                <p><strong>Thời gian dự kiến:</strong> ${durationText}</p>
            `;
        } else {
            alert("Không tìm thấy tuyến đường!");
        }
    });
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
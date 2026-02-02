var map = L.map('map').setView([10.762622, 106.660172], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

let userMarker = null;
let routeLine = null;
let selectedTransport = "driving";
let geojsonLayer = null;
let watchId = null;

function showRoute(destLat, destLng) {
    if (!userMarker) {
        alert("Bạn cần bật định vị trước!");
        return;
    }

    let userLatLng = userMarker.getLatLng();

    if (routeLine) {
        map.removeLayer(routeLine);
    }

    let url = `https://router.project-osrm.org/route/v1/${selectedTransport}/${userLatLng.lng},${userLatLng.lat};${destLng},${destLat}?overview=full&geometries=geojson`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
          if (data.routes && data.routes.length > 0) {
              let route = data.routes[0];

              let coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
              routeLine = L.polyline(coords, { color: 'blue', weight: 4 }).addTo(map);

              map.fitBounds(routeLine.getBounds());

              let distanceKm = (route.distance / 1000).toFixed(2);
              let durationMin = (route.duration / 60).toFixed(1);
              alert(`Khoảng cách: ${distanceKm} km\n⏱Thời gian dự kiến: ${durationMin} phút`);
          } else {
              alert("Không tìm thấy tuyến đường!");
          }
      })
      .catch(err => {
          console.error(err);
          alert("Lỗi khi lấy dữ liệu tuyến đường!");
      });
}

fetch("/static/data/data.geojson")
  .then(res => res.json())
  .then(data => {
      geojsonLayer = L.geoJSON(data, {
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
                      Chỉ đường
                  </button>
                </div>
              `;
              layer.bindPopup(popupContent);
          }
      }).addTo(map);
  });

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

function selectTransport(type, el) {
    if (type === "walking") selectedTransport = "foot";
    else if (type === "car") selectedTransport = "driving";
    else if (type === "motorbike") selectedTransport = "driving";
    else if (type === "bus") selectedTransport = "driving"; 

    document.querySelectorAll("#sidebar li").forEach(li => {
        li.classList.remove("active");
    });
    el.classList.add("active");

    alert("Bạn đã chọn phương tiện: " + type);
}

function locateUser() {
    if (!navigator.geolocation) {
        alert("Trình duyệt không hỗ trợ định vị!");
        return;
    }

    document.getElementById("loading").style.display = "block";

    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    navigator.geolocation.getCurrentPosition(
        function (position) {
            let lat = position.coords.latitude;
            let lng = position.coords.longitude;

            if (userMarker) {
                userMarker.setLatLng([lat, lng]);
            } else {
                userMarker = L.marker([lat, lng])
                    .addTo(map)
                    .bindPopup("Vị trí của bạn")
                    .openPopup();
            }

            map.setView([lat, lng], 15);
            document.getElementById("loading").style.display = "none";

            watchId = navigator.geolocation.watchPosition(
                function (pos) {
                    let lat = pos.coords.latitude;
                    let lng = pos.coords.longitude;
                    userMarker.setLatLng([lat, lng]);
                },
                function (error) {
                    console.error("Geolocation error:", error);
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        },
        function (error) {
            console.error("Geolocation error:", error);
            alert("Không thể lấy vị trí. Mã lỗi: " + error.code + " - " + error.message);
            document.getElementById("loading").style.display = "none";
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

function filterCategory(category) {
    if (!geojsonLayer) return;

    map.eachLayer(function (layer) {
        if (layer instanceof L.Marker && layer !== userMarker) {
            map.removeLayer(layer);
        }
    });

    fetch("/static/data/data.geojson")
      .then(res => res.json())
      .then(data => {
          geojsonLayer = L.geoJSON(data, {
              filter: function (feature) {
                  return feature.properties.type === category;
              },
              onEachFeature: function (feature, layer) {
                  let p = feature.properties;
                  let lat = feature.geometry.coordinates[1];
                  let lng = feature.geometry.coordinates[0];

                  let popupContent = `
                    <div style="text-align:center;">
                      <h3 style="color:#3498db;">${p.name}</h3>
                      <p><strong>Loại:</strong> ${p.type}</p>
                      <button onclick="showRoute(${lat}, ${lng})"
                              style="margin-top:10px; padding:6px 12px; background:#3498db; color:white; border:none; border-radius:5px;">
                          Chỉ đường
                      </button>
                    </div>
                  `;
                  layer.bindPopup(popupContent);
              }
          }).addTo(map);
      });
}
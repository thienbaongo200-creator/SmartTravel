/**
 * ==========================================
 * 1. KHỞI TẠO BẢN ĐỒ & BIẾN TOÀN CỤC
 * ==========================================
 */
if (typeof map !== "undefined") {
    map.remove();
}

// Cấu hình các lớp bản đồ
var streetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 20
});

var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { 
    attribution: 'Tiles © Esri' 
});

var labelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}');

var satelliteWithLabels = L.layerGroup([satelliteLayer, labelsLayer]);

var map = L.map('map', {
    center: [10.762622, 106.660172],
    zoom: 13,
    layers: [streetLayer] 
});

// Điều khiển lớp nền
var baseMaps = {
    "Bản đồ đường phố": streetLayer,
    "Ảnh vệ tinh": satelliteWithLabels
};
L.control.layers(baseMaps, null, { 
    position: 'bottomleft' 
}).addTo(map);

// Khai báo biến (Sử dụng var để tránh lỗi redeclare khi reload script)
var userMarker = null;
var searchMarker = null;
var routeLine = null;
var bufferLayer = null;
var nearbyMarkers = [];
var currentMenuImgs = [];
var currentMenuIndex = 0;

/**
 * ==========================================
 * 2. ĐỊNH VỊ & TÌM KIẾM
 * ==========================================
 */
function locateUser() {
    if (!navigator.geolocation) return alert("Trình duyệt không hỗ trợ định vị.");

    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "block";

    navigator.geolocation.getCurrentPosition(
        function (pos) {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            if (userMarker) {
                userMarker.setLatLng([lat, lng]);
            } else {
                userMarker = L.marker([lat, lng], {
                    icon: L.divIcon({ 
                        className: 'user-marker', 
                        html: '<div style="background:#1a73e8; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>' 
                    })
                }).addTo(map).bindPopup("Bạn đang ở đây");
            }
            map.flyTo([lat, lng], 15);
            if (loading) loading.style.display = "none";
        },
        function (err) {
            alert("Lỗi: " + err.message);
            if (loading) loading.style.display = "none";
        },
        { enableHighAccuracy: true }
    );
}

function searchPlace() {
    let query = document.getElementById("searchBox").value;
    if (!query) return;

    addToHistory(query);
    
    fetch(`/search/?q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => {
          if (data && data.length > 0) {
              let p = data[0];
              if (searchMarker) map.removeLayer(searchMarker);

              map.flyTo([p.latitude, p.longitude], 16);
              searchMarker = L.marker([p.latitude, p.longitude]).addTo(map)
                               .bindPopup(`<b>${p.name}</b>`).openPopup();
              
              displayInfo(p);
          } else {
              alert("Không tìm thấy địa điểm!");
          }
      })
      .catch(err => console.error("Search error:", err));
}

function filterCategory(category) {
    nearbyMarkers.forEach(m => map.removeLayer(m));
    nearbyMarkers = [];
    if (routeLine) map.removeLayer(routeLine);

    fetch(`/search_category/?cat=${category}`)
      .then(res => res.json())
      .then(data => {
          if (!data || data.length === 0) {
              alert("Không có địa điểm nào trong mục này.");
              return;
          }

          data.forEach(p => {
              let m = L.marker([p.latitude, p.longitude])
                       .addTo(map)
                       .bindPopup(`<b>${p.name}</b><br>${p.address}`);
              m.on('click', () => displayInfo(p));
              nearbyMarkers.push(m);
          });

          const group = new L.featureGroup(nearbyMarkers);
          const bounds = group.getBounds();
          if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [30, 30] });
          }
      })
      .catch(err => console.error("Filter category error:", err));
}

function findNearby() {
    if (!userMarker) return alert("Vui lòng bật định vị trước!");

    nearbyMarkers.forEach(m => map.removeLayer(m));
    nearbyMarkers = [];
    if (bufferLayer) map.removeLayer(bufferLayer);

    let pos = userMarker.getLatLng();
    fetch(`/nearby_places?lat=${pos.lat}&lng=${pos.lng}&radius=2`)
      .then(res => res.json())
      .then(data => {
          if (data.buffer) {
              bufferLayer = L.geoJSON(data.buffer, {
                  style: { color: 'orange', fillColor: 'orange', fillOpacity: 0.2 }
              }).addTo(map);
          }

          if (data.nearby && data.nearby.length > 0) {
              data.nearby.forEach(p => {
                  let m = L.marker([p.latitude, p.longitude])
                    .addTo(map)
                    .bindPopup(`<b>${p.name}</b><br>${p.distance_km} km`);
                  nearbyMarkers.push(m);
              });
              
              const group = new L.featureGroup(nearbyMarkers);
              if (group.getBounds().isValid()) {
                  map.fitBounds(group.getBounds().pad(0.2));
              }
          } else {
              if (bufferLayer) map.fitBounds(bufferLayer.getBounds());
          }
      })
      .catch(err => console.error("Nearby error:", err));
}

/**
 * ==========================================
 * 3. CHỈ ĐƯỜNG (ORS & POLYLINE)
 * ==========================================
 */
async function showRouteORS(destLat, destLng, startLat = null, startLng = null, modeOverride = null) {
    if (!startLat || !startLng) {
        if (!userMarker) {
            alert("Vui lòng bật định vị hoặc nhập tọa độ xuất phát!");
            return null;
        }
        let userLatLng = userMarker.getLatLng();
        startLat = userLatLng.lat;
        startLng = userLatLng.lng;
    }

    const mode = modeOverride || (document.getElementById("transportMode") ? document.getElementById("transportMode").value : "DRIVING-CAR");
    
    // Bản đồ mapping profile cho ORS
    const profiles = { 
        "DRIVING-CAR": "driving-car", 
        "DRIVING-MOTO": "driving-car", // ORS free thường dùng chung car cho moto
        "WALKING": "foot-walking", 
        "BICYCLING": "cycling-regular" 
    };
    const orsProfile = profiles[mode] || "driving-car";

    try {
        const response = await fetch(`https://api.openrouteservice.org/v2/directions/${orsProfile}`, {
            method: "POST",
            headers: {
                "Authorization": "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjlkNWI2M2RiODZmNzQzODA5ODM0NDVjOTZkYTFmMGRkIiwiaCI6Im11cm11cjY0In0=", 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                coordinates: [[startLng, startLat], [destLng, destLat]]
            })
        });

        const data = await response.json();
        if (!data.routes || data.routes.length === 0) throw new Error("Không tìm thấy đường đi");

        const route = data.routes[0];

        // 1. Vẽ đường đi lên bản đồ
        if (route.geometry) {
            const decodedCoords = polyline.decode(route.geometry);
            if (routeLine) map.removeLayer(routeLine);
            routeLine = L.polyline(decodedCoords, { color: '#1a73e8', weight: 5, opacity: 0.8 }).addTo(map);
            map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
        }

        // 2. HIỂN THỊ KẾT QUẢ VÀO MODAL (Phần quan trọng nhất)
        const distanceKm = (route.summary.distance / 1000).toFixed(2);
        const durationMin = (route.summary.duration / 60).toFixed(0);
        
        // Cập nhật vào ID đúng trong HTML của bạn
        const summaryDiv = document.getElementById("route-modal-summary");
        const resultArea = document.getElementById("route-modal-result");

        if (summaryDiv) {
            summaryDiv.innerHTML = `
                <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; border-left: 5px solid #1a73e8; margin-top: 10px;">
                    <p style="margin: 0; color: #333;"><i class="fa-solid fa-road"></i> <b>Khoảng cách:</b> ${distanceKm} km</p>
                    <p style="margin: 5px 0 0 0; color: #333;"><i class="fa-solid fa-clock"></i> <b>Thời gian:</b> ${durationMin} phút</p>
                </div>
            `;
        }
        
        if (resultArea) {
            resultArea.style.display = "block"; // Hiện vùng kết quả và nút lưu
        }
        const panelSummary = document.getElementById("route-summary");
        if (panelSummary) {
            panelSummary.innerHTML = `
                <div style="margin-top:10px; padding:10px; border-top:1px solid #ddd; color:#1a73e8; font-weight:bold;">
                    ${distanceKm} km | ${durationMin} phút
                </div>
            `;
        }
        return { distance: distanceKm, duration: durationMin };

    } catch (err) {
        console.error("ORS error:", err);
        alert("Lỗi: " + err.message);
        return null;
    }
}

async function showRouteFromSearch(destLat = null, destLng = null) {
    const panel = document.getElementById("info-panel");
    const modal = document.getElementById("route-modal");
    const startInput = document.getElementById("startPoint");
    const endInput = document.getElementById("endPoint");
    const loading = document.getElementById("loading");

    if (panel) panel.style.display = "none";
    if (modal) modal.style.display = "block";

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
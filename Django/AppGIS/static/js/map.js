// ==============================
// 1. Khởi tạo bản đồ với nhiều lớp
// ==============================
if (typeof map !== "undefined") {
    map.remove();
}

var streetLayer = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '© OpenStreetMap contributors' }
);

var satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles © Esri' }
);

var map = L.map('map', {
    center: [10.762622, 106.660172],
    zoom: 13,
    layers: [streetLayer] 
});

var layerControl = L.control.layers({
    "Bản đồ đường phố": streetLayer,
    "Ảnh vệ tinh": satelliteLayer
}, null).addTo(map);

// Di chuyển phần tử vào div tùy chỉnh (Đảm bảo ID 'layer-switcher' tồn tại trong HTML)
var controlElement = document.querySelector('.leaflet-control-layers');
var switcherContainer = document.getElementById("layer-switcher");
if (controlElement && switcherContainer) {
    switcherContainer.appendChild(controlElement);
}

// Khai báo biến toàn cục (Sử dụng var để tránh lỗi redeclare)
var searchMarker = null;
var userMarker = null;
var routeLine = null;
var watchId = null;
var selectedTransport = "driving";
var currentMenuIndex = 0;
var currentMenuImgs = [];
var nearbyMarkers = [];

// ==============================
// 2. Xử lý UI & Info Panel
// ==============================
function prevMenu() {
    if (currentMenuImgs.length === 0) return;
    currentMenuIndex = (currentMenuIndex - 1 + currentMenuImgs.length) % currentMenuImgs.length;
    document.getElementById("menu-img").src = currentMenuImgs[currentMenuIndex];
}

function nextMenu() {
    if (currentMenuImgs.length === 0) return;
    currentMenuIndex = (currentMenuIndex + 1) % currentMenuImgs.length;
    document.getElementById("menu-img").src = currentMenuImgs[currentMenuIndex];
}

function openImageModal(src) {
    document.getElementById("modal-img").src = src;
    document.getElementById("image-modal").style.display = "block";
}

function closeImageModal() {
    document.getElementById("image-modal").style.display = "none";
}

function displayInfo(p) {
    const panel = document.getElementById("info-panel");
    const content = document.getElementById("info-content");
    if (!panel || !content) return;

    let imgFile = p.img ? p.img.replace("images/", "") : "no-image.jpg";
    let imgPath = "/static/images/" + imgFile;

    panel.style.display = "block";
    content.innerHTML = `
        <div class="info-header">
            <img src="${imgPath}" alt="${p.name}" onerror="this.src='/static/images/no-image.jpg'">
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
            </select>
            <button onclick="showRouteORS(${p.latitude}, ${p.longitude})" class="btn-direction">
                <i class="fa-solid fa-route"></i> Hướng đi
            </button>
            <div id="route-summary" style="margin-top:10px; font-weight:bold; color:#1a73e8;"></div>
            <div id="route-detail"></div>
            <button id="save-route-btn" style="display:none; margin-top:10px;">Lưu tuyến đường</button>
        </div>
    `;

    if (p.menu_imgs && p.menu_imgs.length > 0) {
        currentMenuImgs = p.menu_imgs;
        currentMenuIndex = 0;
        let menuHtml = `
        <div class="menu-section">
            <h4>📖 Thực đơn</h4>
            <div class="menu-carousel" style="display:flex; align-items:center; gap:10px;">
                <button class="menu-btn prev" onclick="prevMenu()">⟨</button>
                <img id="menu-img" src="${currentMenuImgs[0]}" style="max-width:100%; cursor:pointer;" onclick="openImageModal(this.src)">
                <button class="menu-btn next" onclick="nextMenu()">⟩</button>
            </div>
        </div>`;
        content.innerHTML += menuHtml;
    }
}

// ==============================
// 3. Chỉ đường OpenRouteService (Fix lỗi Polyline)
// ==============================
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

    try {
        let response = await fetch(`https://api.openrouteservice.org/v2/directions/${orsProfile}`, {
            method: "POST",
            headers: {
                "Authorization": "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjlkNWI2M2RiODZmNzQzODA5ODM0NDVjOTZkYTFmMGRkIiwiaCI6Im11cm11cjY0In0=", 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                coordinates: [[userLatLng.lng, userLatLng.lat], [destLng, destLat]]
            })
        });

        let data = await response.json();

        if (!data.routes || data.routes.length === 0) {
            alert("Không tìm thấy tuyến đường!");
            return;
        }

        let route = data.routes[0];
        let distanceKm = (route.summary.distance / 1000).toFixed(2);
        let durationMin = (route.summary.duration / 60).toFixed(1);

        if (route.geometry) {
            // FIX: Đảm bảo polyline decode đúng định dạng [lat, lng]
            let decodedCoords = polyline.decode(route.geometry);
            let coords = decodedCoords.map(c => [c[0], c[1]]);

            if (routeLine) map.removeLayer(routeLine);
            
            routeLine = L.polyline(coords, { color: '#1a73e8', weight: 5 }).addTo(map);
            
            // Đợi một chút để Leaflet nhận diện layer rồi mới fitBounds
            setTimeout(() => {
                map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
            }, 100);
        }

        document.getElementById("route-summary").innerText = `📏 ${distanceKm} km | ⏱ ${durationMin} phút`;
        document.getElementById("route-detail").innerHTML = `
            <p><strong>Phương tiện:</strong> ${mode}</p>
        `;

        const saveBtn = document.getElementById("save-route-btn");
        saveBtn.style.display = "block";
        saveBtn.onclick = () => saveRoute({ transport: mode, distance: distanceKm, duration: durationMin, destination: { lat: destLat, lng: destLng } });

    } catch (err) {
        console.error("ORS error:", err);
        alert("Lỗi khi tải chỉ đường. Vui lòng thử lại!");
    }
}

// ==============================
// 4. Tìm kiếm & Định vị
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
              
              displayInfo(p);
          } else {
              alert("Không tìm thấy địa điểm!");
          }
      });
}

function locateUser() {
    if (!navigator.geolocation) return alert("Trình duyệt không hỗ trợ định vị.");

    document.getElementById("loading").style.display = "block";

    navigator.geolocation.getCurrentPosition(
        function (pos) {
            let lat = pos.coords.latitude;
            let lng = pos.coords.longitude;

            if (userMarker) userMarker.setLatLng([lat, lng]);
            else {
                userMarker = L.marker([lat, lng], {
                    icon: L.divIcon({ className: 'user-marker', html: '<div style="background:#1a73e8; width:12px; height:12px; border-radius:50%; border:2px solid white;"></div>' })
                }).addTo(map).bindPopup("Bạn ở đây");
            }
            map.setView([lat, lng], 15);
            document.getElementById("loading").style.display = "none";
        },
        err => { alert("Lỗi: " + err.message); document.getElementById("loading").style.display = "none"; },
        { enableHighAccuracy: true }
    );
}

// ==============================
// 5. Tìm địa điểm gần đây (Fix lỗi JSON/500)
// ==============================
function findNearby() {
    if (!userMarker) return alert("Vui lòng bật định vị trước!");

    nearbyMarkers.forEach(m => map.removeLayer(m));
    nearbyMarkers = [];

    let pos = userMarker.getLatLng();
    fetch(`/nearby/?lat=${pos.lat}&lng=${pos.lng}&radius=2`)
      .then(res => {
          if (!res.ok) throw new Error("Lỗi Server 500");
          return res.json();
      })
      .then(data => {
          if (data.length === 0) return alert("Không tìm thấy địa điểm nào trong bán kính 2km.");
          
          data.forEach(p => {
              let m = L.marker([p.latitude, p.longitude])
                .addTo(map)
                .bindPopup(`<b>${p.name}</b><br>${p.distance_km} km`);
              nearbyMarkers.push(m);
          });
          let group = new L.featureGroup(nearbyMarkers);
          map.fitBounds(group.getBounds().pad(0.2));
      })
      .catch(err => alert("Không thể tải dữ liệu gần đây. Kiểm tra Backend!"));
}

function saveRoute(routeData) {
    let routes = JSON.parse(localStorage.getItem("savedRoutes")) || [];
    routes.push(routeData);
    localStorage.setItem("savedRoutes", JSON.stringify(routes));
    alert("✅ Đã lưu tuyến đường!");
}

// Khởi chạy khi trang load
document.addEventListener("DOMContentLoaded", function() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('search')) {
        document.getElementById("searchBox").value = decodeURIComponent(urlParams.get('search'));
        setTimeout(searchPlace, 1000);
    }
});
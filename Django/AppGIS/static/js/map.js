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

var labelsLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Labels © Esri' }
);

// Gom ảnh vệ tinh + nhãn thành một layer group
var satelliteWithLabels = L.layerGroup([satelliteLayer, labelsLayer]);

var map = L.map('map', {
    center: [10.762622, 106.660172],
    zoom: 13,
    layers: [streetLayer] 
});

var layerControl = L.control.layers({
    "Bản đồ đường phố": streetLayer,
    "Ảnh vệ tinh": satelliteWithLabels
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

function showSavedRoutes() {
    alert("Hiển thị danh sách tuyến đường đã lưu (sẽ lấy từ localStorage hoặc backend).");
    // TODO: render danh sách tuyến đường đã lưu
}

function showSearchHistory() {
    alert("Hiển thị lịch sử tìm kiếm (sẽ lấy từ localStorage hoặc backend).");
    // TODO: render danh sách lịch sử tìm kiếm
}

// ==============================
// Weather API
// ==============================
async function showWeather(lat, lng) {
    const apiKey = "0a34bc50ed55b44c50527935679b9f79";
    try {
        let res = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&lang=vi&appid=${apiKey}`
        );
        let data = await res.json();
        let weatherEl = document.getElementById("weather-info");

        if (data.cod !== 200) {
            weatherEl.innerText = `☀️ Thời tiết: Không thể tải dữ liệu (${data.message})`;
            return;
        }
        // Ghi đè trực tiếp, không append
        weatherEl.innerText = `☀️ Thời tiết: ${data.weather[0].description}, ${data.main.temp}°C`;
    } catch (err) {
        document.getElementById("weather-info").innerText = "☀️ Thời tiết: Lỗi khi tải dữ liệu";
    }
}

// ==============================
// Info Panel
// ==============================
function displayInfo(p) {
    const panel = document.getElementById("info-panel");
    const content = document.getElementById("info-content");
    if (!panel || !content) return;

    if (!p || !p.latitude || !p.longitude) {
        panel.style.display = "block";
        content.innerHTML = "<p><strong>ℹ️ Thông tin:</strong> Chưa chọn địa điểm.</p>";
        return;
    }

    let imgFile = p.img ? p.img.replace("images/", "") : "no-image.jpg";
    let imgPath = "/static/images/" + imgFile;

    panel.style.display = "block";
    content.innerHTML = `
        <div class="info-header">
            <img src="${imgPath}" alt="${p.name}" 
                 onerror="this.src='/static/images/no-image.jpg'">
        </div>
        <div class="info-body">
            <h2>${p.name}</h2>
            <p id="rating-weather">⭐ Đánh giá: ${p.rating || 'Chưa có'}</p>
            <p id="weather-info">☀️ Thời tiết: đang tải...</p>
            <p><strong>📍 Địa chỉ:</strong> ${p.address || 'Đang cập nhật'}</p>
            <p><strong>⏰ Giờ mở cửa:</strong> ${p.open_hours || '8:00 - 21:00'}</p>
            <p><strong>ℹ️ Mô tả:</strong> ${p.description || 'Không có mô tả.'}</p>
        </div>
        <div id="menu-section"></div>
        <div class="route-section">
            <button onclick="showRouteFromSearch(${p.latitude}, ${p.longitude})" class="btn-direction">
                <i class="fa-solid fa-route"></i> Hướng đi
            </button>
            <button id="save-route-btn" style="margin-top:10px;">
                <i class="fa-solid fa-bookmark"></i> Lưu tuyến đường
            </button>
        </div>
    `;

    // Gọi Weather API
    showWeather(p.latitude, p.longitude);

    // Nếu có menu ảnh thì render
    if (p.menu_imgs && p.menu_imgs.length > 0) {
        currentMenuImgs = p.menu_imgs;
        currentMenuIndex = 0;
        let menuHtml = `
        <div class="menu-section">
            <h4>📖 Thực đơn</h4>
            <div class="menu-carousel">
                <button class="menu-btn prev" onclick="prevMenu()">⟨</button>
                <img id="menu-img" src="${currentMenuImgs[0]}" onclick="openImageModal(this.src)">
                <button class="menu-btn next" onclick="nextMenu()">⟩</button>
            </div>
        </div>`;
        document.getElementById("menu-section").innerHTML = menuHtml;
    }
}

// ==============================
// Mở form chỉ đường
// ==============================
function showRouteFromSearch(destLat=null, destLng=null) {
    const modal = document.getElementById("route-modal");
    modal.style.display = "block";

    // Điền điểm đến
    if (destLat && destLng) {
        document.getElementById("endPoint").value = `${destLat},${destLng}`;
    } else if (window.searchMarker) {
        let latlng = window.searchMarker.getLatLng();
        document.getElementById("endPoint").value = `${latlng.lat},${latlng.lng}`;
    }

    // Điền vị trí xuất phát
    if (window.userMarker) {
        let pos = window.userMarker.getLatLng();
        document.getElementById("startPoint").value = `${pos.lat},${pos.lng}`;
    }
}

// ==============================
// Tính toán tuyến đường
// ==============================
async function calculateRoute() {
    let start = document.getElementById("startPoint").value;
    let end = document.getElementById("endPoint").value;
    let mode = document.getElementById("transportMode").value;

    if (!start || !end) {
        alert("Vui lòng nhập đủ vị trí xuất phát và điểm đến!");
        return;
    }

    let [startLat, startLng] = start.split(",").map(Number);
    let [endLat, endLng] = end.split(",").map(Number);

    let result = await showRouteORS(endLat, endLng, startLat, startLng, mode);

    // Hiển thị kết quả trong form
    if (result) {
        document.getElementById("route-summary").innerText = `📏 ${result.distance} km | ⏱ ${result.duration} phút`;
        document.getElementById("route-detail").innerHTML = `<p><strong>Phương tiện:</strong> ${mode}</p>`;
    }
}

// ==============================
// Chỉ đường ORS (trả dữ liệu)
// ==============================
async function showRouteORS(destLat, destLng, startLat=null, startLng=null, mode="DRIVING") {
    if (!startLat || !startLng) {
        if (!userMarker) {
            alert("Vui lòng bật định vị trước khi xem chỉ đường!");
            return null;
        }
        let userLatLng = userMarker.getLatLng();
        startLat = userLatLng.lat;
        startLng = userLatLng.lng;
    }

    let orsProfile = "driving-car";
    if (mode === "WALKING") orsProfile = "foot-walking";
    else if (mode === "BICYCLING") orsProfile = "cycling-regular";

    try {
        let response = await fetch(`https://api.openrouteservice.org/v2/directions/${orsProfile}`, {
            method: "POST",
            headers: {
                "Authorization": "YOUR_ORS_KEY",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                coordinates: [[startLng, startLat], [destLng, destLat]]
            })
        });

        let data = await response.json();
        if (!data.routes || data.routes.length === 0) {
            alert("Không tìm thấy tuyến đường!");
            return null;
        }

        let route = data.routes[0];
        let distanceKm = (route.summary.distance / 1000).toFixed(2);
        let durationMin = (route.summary.duration / 60).toFixed(1);

        // Vẽ tuyến đường
        let coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
        if (routeLine) map.removeLayer(routeLine);
        routeLine = L.polyline(coords, { color: '#1a73e8', weight: 5 }).addTo(map);
        map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

        return { distance: distanceKm, duration: durationMin };
    } catch (err) {
        console.error("ORS error:", err);
        alert("Lỗi khi tải chỉ đường. Vui lòng thử lại!");
        return null;
    }
}

// ==============================
// Hàm chỉ đường từ kết quả tìm kiếm
// ==============================
function showRouteFromSearch() {
    const modal = document.getElementById("route-modal");
    modal.style.display = "block";

    // Điền mặc định điểm đến từ searchMarker nếu có
    if (window.searchMarker) {
        let latlng = window.searchMarker.getLatLng();
        document.getElementById("endPoint").value = `${latlng.lat},${latlng.lng}`;
    }
    // Điền mặc định vị trí xuất phát từ userMarker nếu có
    if (window.userMarker) {
        let pos = window.userMarker.getLatLng();
        document.getElementById("startPoint").value = `${pos.lat},${pos.lng}`;
    }
}

async function calculateRoute() {
    let start = document.getElementById("startPoint").value;
    let end = document.getElementById("endPoint").value;
    let mode = document.getElementById("transportMode").value;

    if (!start || !end) {
        alert("Vui lòng nhập đủ vị trí xuất phát và điểm đến!");
        return;
    }

    let [startLat, startLng] = start.split(",").map(Number);
    let [endLat, endLng] = end.split(",").map(Number);

    showRouteORS(endLat, endLng, startLat, startLng, mode);
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
// 5. Tìm địa điểm gần đây 
// ==============================
let bufferLayer = null; // lưu vòng tròn buffer

function findNearby() {
    if (!userMarker) return alert("Vui lòng bật định vị trước!");

    // Xóa marker cũ
    nearbyMarkers.forEach(m => map.removeLayer(m));
    nearbyMarkers = [];

    // Xóa buffer cũ
    if (bufferLayer) {
        map.removeLayer(bufferLayer);
        bufferLayer = null;
    }

    let pos = userMarker.getLatLng();
    fetch(`/nearby_places?lat=${pos.lat}&lng=${pos.lng}&radius=2`)
      .then(res => {
          if (!res.ok) throw new Error("Lỗi Server 500");
          return res.json();
      })
      .then(data => {
          // Nếu backend trả về lỗi
          if (data.error) {
              alert("Backend báo lỗi: " + data.error);
              return;
          }

          // Luôn vẽ buffer polygon (màu cam nhạt)
          bufferLayer = L.geoJSON(data.buffer, {
              style: { 
                  color: 'orange',        
                  fillColor: 'orange',   
                  fillOpacity: 0.3        
              }
          }).addTo(map);

          // Vẽ các điểm nearby (nếu có)
          if (data.nearby.length === 0) {
              alert("Không tìm thấy địa điểm nào trong bán kính 2km.");
              // Fit bản đồ theo buffer nếu không có marker
              if (bufferLayer) {
                  map.fitBounds(bufferLayer.getBounds().pad(0.2));
              }
          } else {
              data.nearby.forEach(p => {
                  let m = L.marker([p.latitude, p.longitude])
                    .addTo(map)
                    .bindPopup(`<b>${p.name}</b><br>${p.distance_km} km`);
                  nearbyMarkers.push(m);
              });
              let group = new L.featureGroup(nearbyMarkers);
              map.fitBounds(group.getBounds().pad(0.2));
          }
      })
      .catch(err => alert("Không thể tải dữ liệu gần đây. Kiểm tra Backend!"));
}

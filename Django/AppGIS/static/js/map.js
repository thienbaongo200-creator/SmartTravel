/**
 * ==========================================
 * 1. KHỞI TẠO BẢN ĐỒ & BIẾN TOÀN CỤC
 * ==========================================
 */
if (typeof map !== "undefined") {
    map.remove();
}

// Cấu hình các lớp bản đồ
var streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
    attribution: '© OpenStreetMap contributors' 
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

/**
 * ==========================================
 * 3. CHỈ ĐƯỜNG (SỬA LỖI X OF UNDEFINED & POLYLINE)
 * ==========================================
 */
async function showRouteORS(destLat, destLng) {
    if (!userMarker) {
        alert("Vui lòng bật định vị trước!");
        return;
    }

    const userLatLng = userMarker.getLatLng();
    const modeSelect = document.getElementById("transport");
    const mode = modeSelect ? modeSelect.value : "DRIVING";

    // Map profile với OpenRouteService
    const profiles = { "DRIVING": "driving-car", "WALKING": "foot-walking", "BICYCLING": "cycling-regular" };
    const orsProfile = profiles[mode] || "driving-car";

    try {
        const response = await fetch(`https://api.openrouteservice.org/v2/directions/${orsProfile}`, {
            method: "POST",
            headers: {
                "Authorization": "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjlkNWI2M2RiODZmNzQzODA5ODM0NDVjOTZkYTFmMGRkIiwiaCI6Im11cm11cjY0In0=", 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                coordinates: [[userLatLng.lng, userLatLng.lat], [destLng, destLat]]
            })
        });

        const data = await response.json();
        if (!data.routes || data.routes.length === 0) throw new Error("Không tìm thấy đường đi");

        const route = data.routes[0];

        if (route.geometry) {
            // SỬA LỖI: Sử dụng thư viện polyline để decode chính xác [lat, lng]
            const decodedCoords = polyline.decode(route.geometry);
            
            if (routeLine) map.removeLayer(routeLine);
            
            routeLine = L.polyline(decodedCoords, { color: '#1a73e8', weight: 5, opacity: 0.8 }).addTo(map);
            
            // SỬA LỖI: Kiểm tra bounds hợp lệ trước khi zoom
            const bounds = routeLine.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        }

        const distanceKm = (route.summary.distance / 1000).toFixed(2);
        const durationMin = (route.summary.duration / 60).toFixed(0);
        document.getElementById("route-summary").innerText = `📏 ${distanceKm} km | ⏱ ${durationMin} phút`;

    } catch (err) {
        console.error("ORS error:", err);
        alert("Lỗi khi tải chỉ đường. Kiểm tra kết nối hoặc API Key.");
    }
}

/**
 * ==========================================
 * 4. TÌM KIẾM THEO DANH MỤC & GẦN ĐÂY
 * ==========================================
 */
function filterCategory(category) {
    // Xóa marker cũ và đường đi cũ
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

          // SỬA LỖI: Kiểm tra bounds hợp lệ
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
 * 5. UI PANEL & WEATHER
 * ==========================================
 */
async function showWeather(lat, lng) {
    const apiKey = "0a34bc50ed55b44c50527935679b9f79";
    const weatherContainer = document.getElementById("info-content");
    
    try {
        let res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&lang=vi&appid=${apiKey}`);
        let data = await res.json();
        if (data.cod === 200) {
            weatherContainer.innerHTML += `<p><strong>🌦 Thời tiết:</strong> ${data.weather[0].description}, ${data.main.temp}°C</p>`;
        }
    } catch (err) {
        console.error("Weather error");
    }
}

function displayInfo(p) {
    const panel = document.getElementById("info-panel");
    const content = document.getElementById("info-content");
    if (!panel || !content) return;

    panel.style.display = "block";
    
    // 1. Xử lý ảnh đại diện (img)
    let imgPath = p.img || "";
    if (imgPath && !imgPath.startsWith('http') && !imgPath.startsWith('/')) {
        imgPath = "/static/images/" + imgPath.replace("images/", "");
    } else if (!imgPath) {
        imgPath = "/static/images/no-image.jpg";
    }

    // 2. Xử lý menu_imgs (Đồng bộ với logic View)
    let rawMenu = p.menu_imgs || [];
    
    // Nếu rawMenu là chuỗi (do lỗi parse), chuyển về mảng
    if (typeof rawMenu === 'string') {
        try { rawMenu = JSON.parse(rawMenu.replace(/'/g, '"')); } catch (e) { rawMenu = []; }
    }

    // Chuẩn hóa đường dẫn cho mảng Menu
    currentMenuImgs = rawMenu.map(item => {
        if (item.startsWith('http') || item.startsWith('/')) return item;
        // Nếu view chưa nối /static/, ta nối ở đây
        return "/static/images/" + item;
    });
    
    currentMenuIndex = 0;

    // 3. Tạo nội dung HTML
    let html = `
        <div class="info-header">
            <img src="${imgPath}" alt="${p.name}" 
                 style="width:100%; height:200px; object-fit:cover; border-radius:8px;"
                 onerror="this.src='/static/images/no-image.jpg'">
        </div>
        <div class="info-body">
            <h2 style="margin:10px 0; color:#1a73e8;">${p.name}</h2>
            <p><strong>📍 Địa chỉ:</strong> ${p.address || 'Đang cập nhật'}</p>
            <p><strong>⏰ Giờ mở cửa:</strong> ${p.open_hours || '8:00 - 21:00'}</p>
            <p><strong>⭐ Đánh giá:</strong> ${p.rating || '5.0'}/5</p>
            <p><strong>ℹ️ Mô tả:</strong> ${p.description || 'Không có mô tả.'}</p>
            
            <div style="background:#f8f9fa; padding:15px; border-radius:10px; margin-top:15px; border:1px solid #eee;">
                <label><b>Chọn phương tiện:</b></label>
                <select id="transport" style="width:100%; padding:10px; margin:10px 0; border-radius:5px; border:1px solid #ddd;">
                    <option value="DRIVING">🚗 Ô tô / Xe máy</option>
                    <option value="WALKING">🚶 Đi bộ</option>
                    <option value="BICYCLING">🚴 Xe đạp</option>
                </select>
                <button onclick="showRouteORS(${p.latitude}, ${p.longitude})" 
                        style="width:100%; background:#1a73e8; color:white; border:none; padding:12px; border-radius:5px; cursor:pointer; font-weight:bold; transition:0.3s;">
                    <i class="fa-solid fa-location-arrow"></i> XEM ĐƯỜNG ĐI
                </button>
                <div id="route-summary" style="margin-top:10px; font-weight:bold; color:#1a73e8; text-align:center;"></div>
            </div>
        </div>
    `;

    // 4. Phần Menu Carousel (Chỉ hiện khi có ảnh)
    if (currentMenuImgs.length > 0) {
        html += `
        <div class="menu-section" style="margin-top:20px; padding-top:15px; border-top:2px solid #f1f1f1;">
            <h4 style="margin-bottom:12px;"><i class="fa-solid fa-utensils"></i> Thực đơn & Hình ảnh</h4>
            <div class="carousel-box" style="position:relative; background:#222; border-radius:10px; display:flex; align-items:center; height:200px; overflow:hidden;">
                
                <button onclick="prevMenu()" style="position:absolute; left:0; z-index:10; background:rgba(0,0,0,0.6); color:white; border:none; height:100%; width:35px; cursor:pointer; font-size:20px;">❮</button>
                
                <div style="width:100%; height:100%; display:flex; justify-content:center; align-items:center; padding:5px;">
                    <img id="menu-img" src="${currentMenuImgs[0]}" 
                         style="max-height:100%; max-width:100%; object-fit:contain; cursor:zoom-in;" 
                         onclick="openImageModal(this.src)"
                         onerror="this.src='/static/images/no-image.jpg'">
                </div>

                <button onclick="nextMenu()" style="position:absolute; right:0; z-index:10; background:rgba(0,0,0,0.6); color:white; border:none; height:100%; width:35px; cursor:pointer; font-size:20px;">❯</button>
                
                <div style="position:absolute; bottom:8px; right:12px; background:rgba(0,0,0,0.7); color:white; padding:2px 8px; border-radius:10px; font-size:11px;">
                    <span id="menu-counter">1 / ${currentMenuImgs.length}</span>
                </div>
            </div>
        </div>`;
    }

    content.innerHTML = html;
    if (typeof showWeather === "function") showWeather(p.latitude, p.longitude); 
}

// Hàm bổ trợ Carousel ảnh
function updateMenuUI() {
    const imgElem = document.getElementById("menu-img");
    const counterElem = document.getElementById("menu-counter");
    if (imgElem && currentMenuImgs[currentMenuIndex]) {
        imgElem.src = currentMenuImgs[currentMenuIndex];
    }
    if (counterElem) {
        counterElem.innerText = `${currentMenuIndex + 1} / ${currentMenuImgs.length}`;
    }
}

function prevMenu() {
    if (currentMenuImgs.length <= 1) return;
    currentMenuIndex = (currentMenuIndex - 1 + currentMenuImgs.length) % currentMenuImgs.length;
    updateMenuUI();
}

function nextMenu() {
    if (currentMenuImgs.length <= 1) return;
    currentMenuIndex = (currentMenuIndex + 1) % currentMenuImgs.length;
    updateMenuUI();
}

function openImageModal(src) {
    const modal = document.getElementById("image-modal");
    const modalImg = document.getElementById("modal-img");
    if (modal && modalImg) {
        modalImg.src = src;
        modal.style.display = "block";
    }
}

function closeImageModal() {
    const modal = document.getElementById("image-modal");
    if (modal) modal.style.display = "none";
}
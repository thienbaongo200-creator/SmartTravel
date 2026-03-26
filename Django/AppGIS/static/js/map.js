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

function showRouteFromSearch(destLat=null, destLng=null) {
    const panel = document.getElementById("info-panel");
    if (panel) panel.style.display = "none";
    const modal = document.getElementById("route-modal");
    if (modal) modal.style.display = "block"

    if (destLat && destLng) {
        endInput.value = `${destLat},${destLng}`;
    }

    if (window.userMarker) {
        let pos = window.userMarker.getLatLng();
        startInput.value = `${pos.lat},${pos.lng}`;
    } else {
        startInput.placeholder = "Đang xác định vị trí chính xác...";
        if (loading) loading.style.display = "block";

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function (pos) {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;

                    updateUserMarker(lat, lng);

                    map.flyTo([lat, lng], 15);

                    startInput.value = `${lat},${lng}`;

                    if (loading) loading.style.display = "none";
                },
                function (err) {
                    let msg = "Không thể lấy vị trí.";
                    if (err.code === 1) msg = "Vui lòng cho phép truy cập vị trí.";
                    startInput.placeholder = msg;
                    console.error("Lỗi định vị:", err.message);

                    if (loading) loading.style.display = "none";
                },
                { 
                    enableHighAccuracy: true, 
                    timeout: 10000,        
                    maximumAge: 0           
                }
            );
        } else {
            alert("Trình duyệt của bạn không hỗ trợ định vị.");
            if (loading) loading.style.display = "none";
        }
    }
}

function updateUserMarker(lat, lng) {
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
}

async function calculateRoute() {
    let start = document.getElementById("startPoint").value;
    let end = document.getElementById("endPoint").value;
    let mode = document.getElementById("transportMode") ? document.getElementById("transportMode").value : "DRIVING";

    if (!start || !end) {
        alert("Vui lòng nhập đủ vị trí xuất phát và điểm đến!");
        return;
    }

    let [startLat, startLng] = start.split(",").map(Number);
    let [endLat, endLng] = end.split(",").map(Number);

    await showRouteORS(endLat, endLng, startLat, startLng, mode);
}

function showSavedRoutes() {
    alert("Hiển thị danh sách tuyến đường đã lưu.");
}

function showSearchHistory() {
    alert("Hiển thị lịch sử tìm kiếm.");
}

/**
 * ==========================================
 * 4. UI PANEL & WEATHER
 * ==========================================
 */
async function showWeather(lat, lng) {
    const apiKey = "0a34bc50ed55b44c50527935679b9f79";
    const weatherContainer = document.getElementById("weather-info");
    
    if (!weatherContainer) return;

    try {
        let res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&lang=vi&appid=${apiKey}`);
        let data = await res.json();
        if (data.cod === 200) {
            weatherContainer.innerHTML = `<strong>🌦 Thời tiết:</strong> ${data.weather[0].description}, ${data.main.temp}°C`;
        } else {
            weatherContainer.innerHTML = `<strong>🌦 Thời tiết:</strong> Không tải được (${data.message})`;
        }
    } catch (err) {
        weatherContainer.innerHTML = `<strong>🌦 Thời tiết:</strong> Lỗi kết nối`;
        console.error("Weather error:", err);
    }
}

function displayInfo(p) {
    const panel = document.getElementById("info-panel");
    const content = document.getElementById("info-content");
    if (!panel || !content) return;

    // Hiển thị panel thông tin
    panel.style.display = "block";
    
    // 1. Xử lý đường dẫn ảnh đại diện (Thumbnail)
    let imgPath = p.img || "";
    if (imgPath && !imgPath.startsWith('http') && !imgPath.startsWith('/')) {
        imgPath = "/static/images/" + imgPath.replace("images/", "");
    } else if (!imgPath) {
        imgPath = "/static/images/no-image.jpg";
    }

    // 2. Xử lý danh sách hình ảnh chi tiết (Carousel)
    let rawMenu = p.menu_imgs || [];
    if (typeof rawMenu === 'string') {
        try { 
            // Fix lỗi nếu chuỗi JSON dùng dấu nháy đơn
            rawMenu = JSON.parse(rawMenu.replace(/'/g, '"')); 
        } catch (e) { 
            rawMenu = []; 
        }
    }

    // Chuẩn hóa đường dẫn cho mảng ảnh chi tiết
    currentMenuImgs = rawMenu.map(item => {
        if (item.startsWith('http') || item.startsWith('/')) return item;
        return "/static/images/" + item;
    });
    
    currentMenuIndex = 0;

    // 3. Khởi tạo cấu trúc HTML sử dụng class từ style.css
    let html = `
        <div class="info-header">
            <img src="${imgPath}" alt="${p.name}" onerror="this.src='/static/images/no-image.jpg'">
        </div>
        <div class="info-body">
            <h2>${p.name}</h2>
            <p id="weather-info"><strong>🌦 Thời tiết:</strong> đang tải...</p>
            <p><strong>Địa chỉ:</strong> ${p.address || 'Đang cập nhật'}</p>
            <p><strong>Giờ mở cửa:</strong> ${p.open_hours || '8:00 - 21:00'}</p>
            <p><strong>Đánh giá:</strong> ${p.rating || '5.0'}/5</p>
<<<<<<< HEAD
            <p><strong>ℹMô tả:</strong> ${p.description || 'Không có mô tả.'}</p>
=======
            <p><strong>Mô tả:</strong> ${p.description || 'Không có mô tả.'}</p>
>>>>>>> 1949ec8c35408db14a2e93916740ddc7bb9021ae
            
            <div class="button-group">
                <button class="btn-direction" onclick="showRouteFromSearch(${p.latitude}, ${p.longitude})">
                    <i class="fa-solid fa-route"></i> HƯỚNG ĐI
                </button>
                
                <button class="btn-save" onclick="savePlace('${p.name}')">
                    <i class="fa-solid fa-bookmark"></i> LƯU
                </button>
            </div>
            
            <div id="route-summary"></div>
        </div>
    `;

    // 4. Thêm phần Hình ảnh chi tiết nếu có dữ liệu
    if (currentMenuImgs.length > 0) {
        html += `
        <div class="menu-section">
            <h4><i class="fa-solid fa-images"></i> Hình ảnh chi tiết</h4>
            <div class="carousel-box">
                <button class="carousel-btn prev" onclick="prevMenu()">❮</button>
                
                <div class="carousel-image-container">
                    <img id="menu-img" src="${currentMenuImgs[0]}" 
                         alt="Chi tiết"
                         onclick="openImageModal(this.src)"
                         onerror="this.src='/static/images/no-image.jpg'">
                </div>

                <button class="carousel-btn next" onclick="nextMenu()">❯</button>
                
                <div class="menu-counter-tag">
                    <span id="menu-counter">1 / ${currentMenuImgs.length}</span>
                </div>
            </div>
        </div>`;
    }

    // Gán HTML vào giao diện
    content.innerHTML = html;

    // 5. Cập nhật thời tiết thực tế cho địa điểm
    if (typeof showWeather === "function") {
        showWeather(p.latitude, p.longitude);
    }
}
/**
 * ==========================================
 * 5. CÁC HÀM BỔ TRỢ CAROUSEL & MODAL ẢNH
 * ==========================================
 */
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
        modal.style.display = "flex";
    }
}

function closeImageModal() {
    const modal = document.getElementById("image-modal");
    if (modal) modal.style.display = "none";
}

// Tạo Custom Control cho nút Định vị
var LocateControl = L.Control.extend({
    options: { position: 'topleft' }, // Cùng vị trí với Zoom control

    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'locate-control leaflet-bar');
        container.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>'; // Dùng icon FontAwesome
        container.title = "Vị trí của tôi";

        container.onclick = function () {
            locateUser(); // Gọi hàm locateUser() bạn đã có sẵn
        };
        return container;
    }
});

// Thêm nút vào bản đồ
map.addControl(new LocateControl());

// --- LƯU TRỮ DỮ LIỆU ---
function savePlace(name) {
    let saved = JSON.parse(localStorage.getItem('myPlaces')) || [];
    if (!saved.includes(name)) {
        saved.push(name);
        localStorage.setItem('myPlaces', JSON.stringify(saved));
        alert("Đã lưu địa điểm: " + name);
    } else {
        alert("Địa điểm này đã có trong danh sách lưu!");
    }
}

function addToHistory(query) {
    let history = JSON.parse(localStorage.getItem('searchHistory')) || [];
    history = history.filter(item => item !== query); // Xóa bản cũ nếu có
    history.unshift(query); // Đẩy vào đầu mảng
    localStorage.setItem('searchHistory', JSON.stringify(history.slice(0, 10))); // Lưu tối đa 10 cái
}

function showSavedRoutes() {
    const saved = JSON.parse(localStorage.getItem('myPlaces')) || [];
    const panel = document.getElementById("info-panel");
    const content = document.getElementById("info-content");

    let html = `<h3><i class="fa-solid fa-star" style="color:#fbbc04"></i> Địa điểm đã lưu</h3>`;
    if (saved.length === 0) {
        html += "<p class='text-muted'>Bạn chưa lưu địa điểm nào.</p>";
    } else {
        html += "<ul>" + saved.map(item => `
            <li class="list-item">
                <div style="display:flex; align-items:center;">
                    <div class="item-icon icon-saved"><i class="fa-solid fa-bookmark"></i></div>
                    <div class="item-info">
                        <span class="item-name">${item}</span>
                        <span class="item-sub">Địa điểm yêu thích của bạn</span>
                    </div>
                </div>
            </li>`).join('') + "</ul>";
        html += `<button class="btn-clear-all" onclick="localStorage.removeItem('myPlaces'); showSavedRoutes()">Xóa tất cả đã lưu</button>`;
    }
    
    content.innerHTML = html;
    panel.style.display = "block";
}

function showSearchHistory() {
    const history = JSON.parse(localStorage.getItem('searchHistory')) || [];
    const content = document.getElementById("info-content");
    
    let html = `<h3><i class="fa-solid fa-clock-rotate-left"></i> Lịch sử tìm kiếm</h3>`;
    if (history.length === 0) {
        html += "<p class='text-muted'>Chưa có lịch sử tìm kiếm.</p>";
    } else {
        html += "<ul>" + history.map(q => `
            <li class="list-item" onclick="document.getElementById('searchBox').value='${q}'; searchPlace();">
                <div style="display:flex; align-items:center;">
                    <div class="item-icon icon-history"><i class="fa-solid fa-magnifying-glass"></i></div>
                    <div class="item-info">
                        <span class="item-name">${q}</span>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right" style="color:#ccc; font-size:0.8rem;"></i>
            </li>`).join('') + "</ul>";
        html += `<button class="btn-clear-all" onclick="localStorage.removeItem('searchHistory'); showSearchHistory()">Xóa lịch sử</button>`;
    }
    
    content.innerHTML = html;
    document.getElementById("info-panel").style.display = "block";
}


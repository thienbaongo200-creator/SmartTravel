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
 * 2. ĐỊNH VỊ & TÌM KIẾM (Bản hoàn chỉnh)
 * ==========================================
 */

// Hàm định vị vị trí người dùng
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
            alert("Lỗi định vị: " + err.message);
            if (loading) loading.style.display = "none";
        },
        { enableHighAccuracy: true }
    );
}

// Hàm tìm kiếm thông minh: Ưu tiên Database -> Dự phòng OpenStreetMap
async function searchPlace() {
    let query = document.getElementById("searchBox").value.trim();
    if (!query || query.length < 2) return;

    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "block";

    // Lưu vào lịch sử tìm kiếm (Hàm bạn đã viết ở cuối file)
    if (typeof addToHistory === "function") addToHistory(query);

    try {
        // --- BƯỚC 1: Tìm trong Database nội bộ của bạn ---
        const res = await fetch(`/search/?q=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (data && data.length > 0) {
            // Nếu tìm thấy trong DB, lấy kết quả đầu tiên
            const p = data[0];
            renderSearchResult(p.latitude, p.longitude, p.name, p);
        } 
        else {
            // --- BƯỚC 2: Nếu DB không có, tra cứu trên OpenStreetMap ---
            console.log("Không có trong DB, đang tìm trên bản đồ toàn cầu...");
            const osmRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ", Vietnam")}&limit=1`);
            const osmData = await osmRes.json();
            
            if (osmData && osmData.length > 0) {
                const lat = parseFloat(osmData[0].lat);
                const lon = parseFloat(osmData[0].lon);
                const displayName = osmData[0].display_name;
                
                // TỰ ĐỘNG TẠO ẢNH: Sử dụng một icon địa chỉ đẹp hoặc ảnh bản đồ tĩnh
                // Ở đây tôi dùng một ảnh placeholder chuyên nghiệp cho địa chỉ nhà
                const defaultAddressImg = "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?q=80&w=400&h=300&auto=format&fit=crop"; 

                const osmPlace = {
                    name: displayName.split(',')[0], // Tên số nhà/đường
                    latitude: lat,
                    longitude: lon,
                    address: displayName,
                    description: "Đây là địa chỉ tìm kiếm từ bản đồ vệ tinh.",
                    category: "Địa chỉ riêng",
                    rating: "N/A",
                    img: defaultAddressImg // Gán ảnh này vào để Panel không bị trống
                };

                renderSearchResult(lat, lon, osmPlace.name, osmPlace);
            }
            else {
                alert("Rất tiếc, không tìm thấy địa điểm này!");
            }
        }
    } catch (err) {
        console.error("Lỗi thực thi tìm kiếm:", err);
    } finally {
        if (loading) loading.style.display = "none";
    }
}

// Hàm hỗ trợ: Hiển thị Marker và Panel thông tin
function renderSearchResult(lat, lon, name, placeObject) {
    // Xóa marker cũ nếu có
    if (searchMarker) map.removeLayer(searchMarker);

    // Di chuyển bản đồ
    map.flyTo([lat, lon], 16);

    // Cắm marker mới
    searchMarker = L.marker([lat, lon]).addTo(map)
        .bindPopup(`<b>${name}</b>`)
        .openPopup();

    // Hiển thị Panel thông tin bên trái (Gọi hàm displayInfo bạn đã có)
    if (typeof displayInfo === "function") {
        displayInfo(placeObject);
    }
}

// Lọc theo danh mục (Sửa lỗi encode và dọn dẹp bản đồ)
async function filterCategory(category) {
    // Dọn dẹp các marker cũ
    nearbyMarkers.forEach(m => map.removeLayer(m));
    nearbyMarkers = [];
    if (routeLine) map.removeLayer(routeLine);
    if (searchMarker) map.removeLayer(searchMarker);
    if (bufferLayer) map.removeLayer(bufferLayer);

    try {
        const res = await fetch(`/search_category/?cat=${encodeURIComponent(category)}`);
        const data = await res.json();

        if (!data || data.length === 0) {
            alert(`Không có địa điểm nào thuộc mục "${category}".`);
            return;
        }

        data.forEach(p => {
            let m = L.marker([p.latitude, p.longitude])
                     .addTo(map)
                     .bindPopup(`<b>${p.name}</b><br>${p.address || ''}`);
            
            // Click vào marker trên bản đồ để hiện Panel thông tin
            m.on('click', () => displayInfo(p));
            nearbyMarkers.push(m);
        });

        // Tự động căn chỉnh bản đồ bao phủ hết các Marker vừa tìm được
        const group = new L.featureGroup(nearbyMarkers);
        if (group.getBounds().isValid()) {
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }
    } catch (err) {
        console.error("Lỗi lọc danh mục:", err);
    }
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

    panel.style.display = "block";

    // --- CHỈNH SỬA HÀM getCorrectPath ---
    const getCorrectPath = (path) => {
        if (!path) return ""; // bỏ default.jpg, trả về rỗng
        if (path.startsWith('http') || path.startsWith('/static/')) return path;

        const category = p.category ? p.category.toLowerCase() : "";

        if (category.includes("nhà hàng") || category.includes("restaurant")) {
            if (path.startsWith('restaurants/')) {
                return "/static/images/" + path;
            }
            return "/static/images/restaurants/" + path;
        }

        return "/static/images/" + path;
    };

    // Gán imgPath chính
    let imgPath = getCorrectPath(p.img);

    // 2. Danh sách ảnh chi tiết (carousel)
    let rawMenu = p.menu_imgs || [];
    if (typeof rawMenu === 'string') {
        try { 
            rawMenu = JSON.parse(rawMenu.replace(/'/g, '"')); 
        } catch (e) { 
            rawMenu = []; 
        }
    }
    
    currentMenuImgs = Array.isArray(rawMenu) ? rawMenu.map(item => getCorrectPath(item)) : [];
    currentMenuIndex = 0;

    // 3. Khởi tạo HTML
    let html = `
        <div class="info-header">
            ${imgPath ? `<img src="${imgPath}" alt="${p.name}">` : ""}
        </div>
        <div class="info-body">
            <h2>${p.name}</h2>
            <p id="weather-info"><strong>🌦 Thời tiết:</strong> đang tải...</p>
            <p><strong>Địa chỉ:</strong> ${p.address || 'Đang cập nhật'}</p>
            <p><strong>Giờ mở cửa:</strong> ${p.open_hours || '8:00 - 21:00'}</p>
            <p><strong>Đánh giá:</strong> ${p.rating || '5.0'}/5</p>
            <p><strong>Mô tả:</strong> ${p.description || 'Không có mô tả.'}</p>
            
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

    // 4. Thêm carousel nếu có ảnh menu
    if (currentMenuImgs.length > 0) {
        html += `
        <div class="menu-section">
            <h4><i class="fa-solid fa-images"></i> Hình ảnh chi tiết</h4>
            <div class="carousel-box">
                <button class="carousel-btn prev" onclick="prevMenu()">❮</button>
                <div class="carousel-image-container">
                    <img id="menu-img" src="${currentMenuImgs[0]}" 
                         alt="Chi tiết"
                         onclick="openImageModal(this.src)">
                </div>
                <button class="carousel-btn next" onclick="nextMenu()">❯</button>
                <div class="menu-counter-tag">
                    <span id="menu-counter">1 / ${currentMenuImgs.length}</span>
                </div>
            </div>
        </div>`;
    }

    content.innerHTML = html;

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
function saveRoute() {
    console.log("Đang gọi hàm saveRoute..."); 
    
    const start = document.getElementById("startPoint").value;
    const end = document.getElementById("endPoint").value;
    const mode = document.getElementById("transportMode") ? document.getElementById("transportMode").value : "DRIVING";
    const summary = document.getElementById("route-modal-summary") ? document.getElementById("route-modal-summary").innerText : "";

    if (!start || !end) {
        alert("Không có thông tin tuyến đường để lưu!");
        return;
    }

    let savedRoutes = JSON.parse(localStorage.getItem('mySavedRoutes')) || [];
    
    const isDuplicate = savedRoutes.some(r => r.start === start && r.end === end);
    if (isDuplicate) {
        alert("Tuyến đường này đã có trong danh sách lưu!");
        return;
    }

    const newRoute = {
        id: Date.now(),
        start: start,
        end: end,
        mode: mode,
        summary: summary,
        time: new Date().toLocaleString('vi-VN')
    };

    savedRoutes.push(newRoute);
    localStorage.setItem('mySavedRoutes', JSON.stringify(savedRoutes));

    alert("Đã lưu tuyến đường thành công!");
}

function addToHistory(query) {
    let history = JSON.parse(localStorage.getItem('searchHistory')) || [];
    history = history.filter(item => item !== query); // Xóa bản cũ nếu có
    history.unshift(query); // Đẩy vào đầu mảng
    localStorage.setItem('searchHistory', JSON.stringify(history.slice(0, 10))); // Lưu tối đa 10 cái
}

function showSavedRoutes() {
    const savedPlaces = JSON.parse(localStorage.getItem('myPlaces')) || [];
    const savedRoutes = JSON.parse(localStorage.getItem('mySavedRoutes')) || [];
    
    const panel = document.getElementById("info-panel");
    const content = document.getElementById("info-content");

    let html = `<h3><i class="fa-solid fa-star" style="color:#fbbc04"></i> Dữ liệu đã lưu</h3>`;

    if (savedPlaces.length === 0 && savedRoutes.length === 0) {
        html += "<p class='text-muted' style='padding:20px;'>Bạn chưa lưu dữ liệu nào.</p>";
    } else {
        // Phần hiển thị Tuyến đường
        if (savedRoutes.length > 0) {
            html += `<h4 style="margin-top:15px; border-bottom:1px solid #eee;">Tuyến đường</h4><ul>`;
            html += savedRoutes.map((route, index) => `
                <li class="list-item" style="padding:10px; border-bottom:1px solid #f9f9f9;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="color:#1a73e8;">Từ:</strong> ${route.start}<br>
                            <strong style="color:#1a73e8;">Đến:</strong> ${route.end}<br>
                            <small class="text-muted">${route.summary} (${route.time})</small>
                        </div>
                        <button onclick="deleteRoute(${index})" style="border:none; background:none; color:red; cursor:pointer;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </li>`).join('');
            html += "</ul>";
        }

        // Phần hiển thị Địa điểm
        if (savedPlaces.length > 0) {
            html += `<h4 style="margin-top:15px; border-bottom:1px solid #eee;">Địa điểm</h4><ul>`;
            html += savedPlaces.map((place, index) => `
                <li class="list-item">
                    <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                        <div style="display:flex; align-items:center;">
                            <div class="item-icon icon-saved"><i class="fa-solid fa-location-dot"></i></div>
                            <div class="item-info">
                                <span class="item-name">${place}</span>
                            </div>
                        </div>
                    </div>
                </li>`).join('');
            html += "</ul>";
        }

        html += `<button class="btn-clear-all" onclick="clearAllData()" style="width:100%; margin-top:20px; padding:10px; background:#f44336; color:white; border:none; border-radius:5px; cursor:pointer;">Xóa tất cả</button>`;
    }

    content.innerHTML = html;
    panel.style.display = "block";
}
function clearAllData() {
    if(confirm("Bạn có chắc chắn muốn xóa toàn bộ địa điểm và tuyến đường đã lưu?")) {
        localStorage.removeItem('myPlaces');
        localStorage.removeItem('mySavedRoutes');
        showSavedRoutes();
    }
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
function showNearbyPlaces() {
    if (!navigator.geolocation) {
        alert("Trình duyệt không hỗ trợ định vị.");
        return;
    }

    navigator.geolocation.getCurrentPosition(async position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
            // Gọi API backend (đúng route trong urls.py)
            const res = await fetch(`/nearby_places/?lat=${lat}&lng=${lng}&radius=20`);
            const data = await res.json();

            // Lấy mảng địa điểm từ key "nearby"
            const places = data.nearby || [];

            // Xóa layer cũ nếu có
            if (window.nearbyLayer) {
                map.removeLayer(window.nearbyLayer);
            }

            // Tạo layer mới
            window.nearbyLayer = L.layerGroup().addTo(map);

            // Vẽ vòng tròn bán kính 20km quanh vị trí người dùng
            L.circle([lat, lng], {
                radius: data.radius_km * 1000, // km → mét
                color: "#007bff",
                fillColor: "#007bff",
                fillOpacity: 0.1
            }).addTo(window.nearbyLayer);

            // Thêm marker vị trí người dùng
            L.marker([lat, lng]).bindPopup("📍 Vị trí của bạn").addTo(window.nearbyLayer);

            // Thêm các địa điểm xung quanh
            places.forEach(p => {
                const marker = L.marker([p.latitude, p.longitude])
                    .bindPopup(`<strong>${p.name}</strong><br>${p.address || ''}<br>📏 ${p.distance_km} km`);
                window.nearbyLayer.addLayer(marker);
            });

            // Zoom bản đồ vào vị trí người dùng
            map.setView([lat, lng], 12);

        } catch (err) {
            console.error("Lỗi khi tải dữ liệu:", err);
            alert("Không thể tải danh sách địa điểm quanh bạn.");
        }

    }, () => {
        alert("Không thể lấy vị trí hiện tại.");
    });
}
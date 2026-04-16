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
    // 1. Kiểm tra và gán ID dự phòng nếu Backend không trả về
    // Nếu không có id, dùng osm_id hoặc tạo một chuỗi tạm để tránh lỗi logic
    if (!placeObject.id) {
        placeObject.id = placeObject.osm_id || "temp_" + Date.now();
        console.warn("Cảnh báo: placeObject thiếu ID, đã gán ID tạm thời:", placeObject.id);
    }

    const placeId = placeObject.id; 

    // 2. Xóa marker cũ
    if (window.searchMarker) {
        map.removeLayer(window.searchMarker);
    }

    // 3. Di chuyển bản đồ
    map.flyTo([lat, lon], 16);

    // 4. Cắm marker mới
    window.searchMarker = L.marker([lat, lon]).addTo(map)
        .bindPopup(`
            <div style="min-width:150px; text-align:center;">
                <b style="color:#e67e22;">${name}</b><br>
                <small>Nhấp để xem chi tiết</small>
            </div>
        `)
        .openPopup();
        
    // 5. Hiển thị Panel thông tin
    if (typeof displayInfo === "function") {
        displayInfo(placeObject);
    }

    // 6. Lưu vào lịch sử (Đã có ID nên xem được review)
    if (typeof addToHistory === "function") {
        addToHistory(placeObject);
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

/**
 * Hàm gọi API OpenRouteService để tìm đường và vẽ lên bản đồ
 */
async function showRouteORS(destLat, destLng, startLat, startLng, modeOverride = null) {
    // Không dùng logic tự lấy userMarker ở đây nữa, vì calculateRoute đã lo việc đó
    if (!startLat || !startLng || !destLat || !destLng) {
        alert("Dữ liệu tọa độ không hợp lệ!");
        return;
    }

    const mode = modeOverride || (document.getElementById("transportMode")?.value || "DRIVING-CAR");
    const profiles = { 
        "DRIVING-CAR": "driving-car", "DRIVING-MOTO": "driving-car", 
        "WALKING": "foot-walking", "BICYCLING": "cycling-regular" 
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
        
        if (typeof routeLine !== 'undefined' && routeLine) {
            map.removeLayer(routeLine);
        }

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const decodedCoords = polyline.decode(route.geometry);
            
            routeLine = L.polyline(decodedCoords, { 
                color: '#1a73e8', weight: 6, opacity: 0.8, lineCap: 'round' 
            }).addTo(map);
            
            map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
            updateRouteUI(route.summary);
        } else {
            alert("Không tìm thấy đường đi giữa 2 địa điểm này.");
        }
    } catch (err) {
        alert("Lỗi kết nối API.");
    }
}

/**
 * Hàm hỗ trợ cập nhật kết quả lên Modal
 */
function updateRouteUI(summary) {
    const distanceKm = (summary.distance / 1000).toFixed(2);
    const durationMin = (summary.duration / 60).toFixed(0);
    
    // Cập nhật vào modal tóm tắt
    const summaryDiv = document.getElementById("route-modal-summary");
    if (summaryDiv) {
        summaryDiv.innerHTML = `
            <div style="background: #e8f0fe; padding: 15px; border-radius: 8px; border-left: 5px solid #1a73e8; margin-top: 10px;">
                <p style="margin: 0; color: #1a73e8; font-weight: bold;">
                    <i class="fa-solid fa-route"></i> Đã tìm thấy tuyến đường tốt nhất
                </p>
                <div style="display: flex; gap: 20px; margin-top: 8px; color: #333;">
                    <span><i class="fa-solid fa-road"></i> ${distanceKm} km</span>
                    <span><i class="fa-solid fa-clock"></i> ~${durationMin} phút</span>
                </div>
            </div>
        `;
    }

    // Hiển thị vùng chứa nút "Lưu"
    const resultArea = document.getElementById("route-modal-result");
    if (resultArea) {
        resultArea.style.display = "block";
    }
}

async function showRouteFromSearch(destLat = null, destLng = null, destName = null) {
    const modal = document.getElementById("route-modal");
    const startInput = document.getElementById("startPoint");
    const endInput = document.getElementById("endPoint");

    if (!modal || !startInput || !endInput) return;

    modal.style.display = "block";
    
    // ÉP KIỂU SỐ thực để đảm bảo dữ liệu chuẩn
    const lat = destLat ? parseFloat(destLat) : null;
    const lng = destLng ? parseFloat(destLng) : null;

    // Nếu có đích đến từ Marker/Info Panel
    if (!isNaN(lat) && !isNaN(lng)) {
        endInput.value = destName ? decodeURIComponent(destName) : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        endInput.dataset.lat = lat;
        endInput.dataset.lng = lng;
    } else {
        endInput.value = "";
        delete endInput.dataset.lat;
        delete endInput.dataset.lng;
    }

    // Xử lý điểm xuất phát (Giữ nguyên logic GPS của bạn)
    if (window.userMarker) {
        const pos = window.userMarker.getLatLng();
        startInput.value = "Vị trí của bạn";
        startInput.dataset.lat = pos.lat;
        startInput.dataset.lng = pos.lng;
    } else {
        startInput.value = "";
        startInput.placeholder = "Đang xác định vị trí...";
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const uLat = pos.coords.latitude;
                const uLng = pos.coords.longitude;
                if (typeof updateUserMarker === 'function') updateUserMarker(uLat, uLng);
                startInput.value = "Vị trí của bạn";
                startInput.dataset.lat = uLat;
                startInput.dataset.lng = uLng;
            }, (err) => {
                startInput.placeholder = "Nhập điểm xuất phát...";
            });
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
    const startInput = document.getElementById("startPoint");
    const endInput = document.getElementById("endPoint");
    const loading = document.getElementById("loading");

    const startVal = startInput.value.trim();
    const endVal = endInput.value.trim();

    if (!startVal || !endVal) {
        alert("Vui lòng nhập đầy đủ điểm xuất phát và điểm đến!");
        return;
    }

    if (loading) loading.style.display = "block";

    try {
        // Chuyển đổi tên địa điểm thành tọa độ
        const startCoords = await getCoordinate(startVal, startInput);
        const endCoords = await getCoordinate(endVal, endInput);

        if (!startCoords) {
            alert("Không tìm thấy vị trí xuất phát: " + startVal);
            return;
        }
        if (!endCoords) {
            alert("Không tìm thấy điểm đến: " + endVal);
            return;
        }

        // Gọi hàm vẽ đường (Chú ý thứ tự: destLat, destLng, startLat, startLng)
        await showRouteORS(endCoords[0], endCoords[1], startCoords[0], startCoords[1]);

    } catch (error) {
        console.error(error);
        alert("Có lỗi xảy ra trong quá trình tính toán tuyến đường.");
    } finally {
        if (loading) loading.style.display = "none";
    }
}

/**
 * Hàm bổ trợ: Chuyển đổi Input (Địa chỉ hoặc Tọa độ) thành Array [lat, lng]
 */
async function getCoordsFromInput(val, inputElement) {
    // 1. Kiểm tra nếu là tọa độ lat,lng (đã có từ click bản đồ hoặc GPS)
    const regExp = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
    if (regExp.test(val)) {
        return val.split(',').map(Number);
    }
    
    // 2. Nếu đã lưu tọa độ trong dataset (do click bản đồ trước đó)
    if (inputElement.dataset.lat && inputElement.dataset.lng) {
        return [parseFloat(inputElement.dataset.lat), parseFloat(inputElement.dataset.lng)];
    }

    // 3. Nếu là địa chỉ chữ (ví dụ: "Hồ Gươm"), dùng OpenStreetMap Nominatim để tìm tọa độ
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=1`);
    const data = await response.json();
    if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
    
    throw new Error("Không tìm thấy địa điểm");
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

async function displayInfo(p) {
    const panel = document.getElementById("info-panel");
    const content = document.getElementById("info-content");
    if (!panel || !content) return;

    // --- KIỂM TRA ID TRƯỚC KHI CHẠY ---
    // Thử lấy p.id hoặc p.pk (tùy theo cấu trúc Django/Database của bạn)
    const placeId = p.id || p.pk; 

    panel.style.display = "block";
    const encodedData = btoa(unescape(encodeURIComponent(JSON.stringify(p))));

    // Hàm định dạng giá
    // Đoạn này nằm trong map.js (hàm displayInfo)
    const formatPrice = (price, category) => {
    if (!price || price === "0" || price === 0 || price === "None") return "Liên hệ";
    const formatted = new Intl.NumberFormat('vi-VN').format(price);
    const cat = category ? category.toLowerCase() : "";

    // Kiểm tra từ khóa khách sạn
    if (cat.includes("khách sạn") || cat.includes("hotel")) {
        return `${formatted} VNĐ<small style="font-size: 0.7rem; font-weight: normal; margin-left: 2px;">/đêm</small>`;
    }
    return `${formatted} VNĐ`;
};

    const getCorrectPath = (path, category) => {
        if (!path) return "/static/images/default.jpg";
        if (path.startsWith('/media/') || path.startsWith('http')) return path;

        const cat = category ? category.toLowerCase() : "";

        if (cat.includes("nhà hàng") || cat.includes("restaurant")) {
            return "/static/images/restaurants/" + path.replace('restaurants/', '');
        }
        if (cat.includes("khách sạn") || cat.includes("hotel")) {
            return "/static/images/hotels/" + path.replace('hotels/', '');
        }
        if (cat.includes("công viên") || cat.includes("khu vui chơi")) {
            return "/static/images/parks/" + path.replace('parks/', '');
        }
        if (cat.includes("chùa") || cat.includes("nhà thờ") || cat.includes("bảo tàng") || cat.includes("di tích")) {
            return "/static/images/monuments/" + path.replace('monuments/', '');
        }
        if (cat.includes("atm")) {
            return "/static/images/atm/" + path.replace('atm/', '');
        }
        if (cat.includes("nhà thuốc") || cat.includes("pharmacy")) {
            return "/static/images/pharmacy/" + path.replace('pharmacy/', '');
        }

        return "/static/images/" + path;
    };

    // --- XỬ LÝ DANH SÁCH ẢNH ---
    const mainImgPath = getCorrectPath(p.img, p.category);
    
    // 2. Lấy danh sách ảnh phụ từ menu_imgs
    let extraImages = [];
    if (p.menu_imgs) {
        let rawMenu = p.menu_imgs;
        // Nếu là string (do parse từ Django cũ) thì convert, nếu là array thì dùng luôn
        if (typeof rawMenu === 'string') {
            try { 
                rawMenu = JSON.parse(rawMenu.replace(/'/g, '"')); 
            } catch (e) { 
                console.error("Lỗi parse menu_imgs:", e);
                rawMenu = []; 
            }
        }
        extraImages = Array.isArray(rawMenu) ? rawMenu : [];
    }

    // 3. Gộp lại: Ảnh chính luôn đứng đầu, sau đó đến các ảnh phụ
    let finalGallery = [];
    if (p.img) finalGallery.push(mainImgPath);
    
    extraImages.forEach(path => {
        const fullPath = getCorrectPath(path, p.category);
        if (fullPath !== mainImgPath) { // Tránh trùng lặp nếu p.img cũng nằm trong menu_imgs
            finalGallery.push(fullPath);
        }
    });

    currentMenuImgs = finalGallery;
    currentMenuIndex = 0;

    // --- KHỞI TẠO HTML CƠ BẢN ---
    let html = `
        <div class="info-header" style="position: relative;">
            ${mainImgPath ? `<img src="${mainImgPath}" alt="${p.name}" class="main-info-img">` : ""}
            <div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: #fff; padding: 5px 10px; border-radius: 4px; font-weight: bold; font-size: 0.9rem; z-index: 2;">
                <i class="fa-solid fa-tags" style="color: #ffc107;"></i> ${formatPrice(p.price)}
            </div>
        </div>
        <div class="info-body">
            <h2>${p.name}</h2>
            <div id="average-rating-container" style="margin-bottom: 10px; font-size: 1.1rem; color: #f1c40f;">
                <span id="avg-stars"></span> 
                <span id="avg-score" style="color: #444; font-weight: bold; margin-left: 5px;"></span>
                <span id="total-reviews-count" style="color: #888; font-size: 0.9rem; font-weight: normal;"></span>
            </div>
            <p id="weather-info"><strong>🌦 Thời tiết:</strong> đang tải...</p>
            <p><strong>Địa chỉ:</strong> ${p.address || 'Đang cập nhật'}</p>
            <p><strong>Giờ mở cửa:</strong> ${p.open_hours || '8:00 - 21:00'}</p>
            <p><strong>Mô tả:</strong> ${p.description || 'Không có mô tả.'}</p>
            
            <div class="button-group">
                <button class="btn-direction" onclick="showRouteFromSearch(${p.latitude}, ${p.longitude}, '${p.name.replace(/'/g, "\\'")}')">
                    <i class="fa-solid fa-route"></i> HƯỚNG ĐI
                </button>
                <button id="btn-save-main" class="btn-save" onclick="savePlace('${encodedData}', event)">
                    <i class="fa-solid fa-bookmark"></i> LƯU
                </button>
                <button class="btn-review" onclick="openReviewModal('${placeId}', '${p.name.replace(/'/g, "\\'")}')">
                    <i class="fa-solid fa-pen-to-square"></i> VIẾT ĐÁNH GIÁ
                </button>
            </div>
        </div>

        <div class="reviews-display-section" style="padding: 15px; border-top: 8px solid #f0f2f5;">
            <h4><i class="fa-solid fa-comments"></i> Đánh giá từ cộng đồng</h4>
            <div id="direct-reviews-list" style="margin-top: 10px;">
                ${placeId ? '<p style="color: #666; font-size: 14px;">Đang tải đánh giá...</p>' : '<p style="color: #666; font-size: 14px;">Không thể tải đánh giá (Thiếu ID).</p>'}
            </div>
        </div>
    `;

    // Thêm Carousel ảnh nếu có
    if (currentMenuImgs.length > 0) {
        html += `
        <div class="menu-section" style="border-top: 8px solid #f0f2f5;">
            <h4><i class="fa-solid fa-images"></i> Hình ảnh chi tiết</h4>
            <div class="carousel-box">
                <button class="carousel-btn prev" onclick="prevMenu()">❮</button>
                <div class="carousel-image-container">
                    <img id="menu-img" src="${currentMenuImgs[0]}" onclick="openImageModal(this.src)">
                </div>
                <button class="carousel-btn next" onclick="nextMenu()">❯</button>
            </div>
        </div>`;
    }

    content.innerHTML = html;

    // --- CHỈ GỌI LOAD REVIEWS NẾU CÓ ID ---
    if (placeId && placeId !== 'undefined') {
        loadReviewsToPanel(placeId);
    } else {
        console.error("Lỗi: Không tìm thấy ID cho địa điểm:", p.name);
    }

    // Kiểm tra trạng thái lưu
    const savedPlaces = JSON.parse(localStorage.getItem("mySavedPlaces")) || [];
    if (savedPlaces.some(item => item.name === p.name)) {
        const btnSave = document.getElementById("btn-save-main");
        if (btnSave) { btnSave.style.color = "gold"; btnSave.innerHTML = '<i class="fa-solid fa-check"></i> ĐÃ LƯU'; }
    }

    if (typeof showWeather === "function") showWeather(p.latitude, p.longitude);
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
    const modalImg = document.getElementById("image-modal-src");
    if (!modal || !modalImg) return;

    modalImg.src = src;
    modal.style.display = "flex";

    // Khởi tạo biến scale riêng biệt đính kèm trực tiếp vào đối tượng ảnh
    // để không đụng chạm đến bất kỳ biến toàn cục nào khác
    modalImg.dataset.scale = 1;
    modalImg.style.transform = "scale(1)";

    // Gán sự kiện cuộn chuột trực tiếp cho ảnh
    modalImg.onwheel = function(e) {
        // Ngăn sự kiện cuộn ảnh hưởng đến bản đồ phía dưới
        e.stopPropagation(); 
        e.preventDefault();

        let scale = parseFloat(this.dataset.scale) || 1;
        const delta = e.deltaY;
        
        if (delta < 0) {
            scale += 0.1; // Phóng to
        } else {
            scale -= 0.1; // Thu nhỏ
        }

        // Giới hạn tỉ lệ zoom
        scale = Math.min(Math.max(0.5, scale), 3);
        
        this.dataset.scale = scale;
        this.style.transform = `scale(${scale})`;
    };
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
    history = history.filter(item => item !== query);
    history.unshift(query); 
    localStorage.setItem('searchHistory', JSON.stringify(history.slice(0, 10))); 
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
            const res = await fetch(`/nearby_places/?lat=${lat}&lng=${lng}&radius=20`);
            const data = await res.json();
            const places = data.nearby || [];

            // 1. Hiển thị Sidebar
            const sidebar = document.getElementById("nearby-sidebar");
            const listContainer = document.getElementById("nearby-list");
            sidebar.style.display = "flex";
            listContainer.innerHTML = ""; // Xóa danh sách cũ

            // 2. Xóa Layer cũ trên bản đồ
            if (window.nearbyLayer) {
                map.removeLayer(window.nearbyLayer);
            }
            window.nearbyLayer = L.layerGroup().addTo(map);

            // 3. Vẽ vị trí người dùng
            L.circle([lat, lng], {
                radius: data.radius_km * 1000,
                color: "#007bff",
                fillOpacity: 0.1
            }).addTo(window.nearbyLayer);
            
            L.marker([lat, lng]).bindPopup("📍 Vị trí của bạn").addTo(window.nearbyLayer);

            // 4. Duyệt qua từng địa điểm
            if (places.length === 0) {
                listContainer.innerHTML = "<p style='padding:15px;'>Không tìm thấy địa điểm nào quanh đây.</p>";
            }

            places.forEach(p => {
                // Thêm Marker lên bản đồ
                const marker = L.marker([p.latitude, p.longitude])
                    .bindPopup(`<strong>${p.name}</strong><br>${p.address || ''}`);
                window.nearbyLayer.addLayer(marker);

                // Thêm Item vào danh sách Sidebar
                const item = document.createElement("div");
                item.className = `nearby-item category-${p.category || 'attraction'}`;
                item.innerHTML = `
                    <h4>${p.name}</h4>
                    <p>${p.address || 'Không có địa chỉ'}</p>
                    <span class="distance-badge">📍 ${p.distance_km.toFixed(2)} km</span>
                `;
                
                // Click vào item trong danh sách thì di chuyển bản đồ tới marker đó
                item.onclick = () => {
                    map.setView([p.latitude, p.longitude], 16);
                    marker.openPopup();
                };
                
                listContainer.appendChild(item);
            });

            map.setView([lat, lng], 13);

        } catch (err) {
            console.error("Lỗi:", err);
            alert("Không thể tải danh sách địa điểm.");
        }
    });
}

// Hàm đóng sidebar
function closeNearbySidebar() {
    document.getElementById("nearby-sidebar").style.display = "none";
    if (window.nearbyLayer) {
        map.removeLayer(window.nearbyLayer);
    }
}

function getCSRFToken() {
    const tokenInput = document.querySelector('[name=csrfmiddlewaretoken]');
    return tokenInput ? tokenInput.value : null;
}

async function openReviewModal(placeId, placeName) {
    const modal = document.getElementById('reviewModal');
    const title = document.getElementById('reviewTitle');
    const form = document.getElementById('reviewForm');
    
    if (!modal || !form) return;

    title.innerText = "Viết đánh giá cho: " + placeName;
    modal.style.display = 'flex';
    
    // Hiển thị trạng thái đang kiểm tra
    form.innerHTML = "<p style='text-align:center;'>Đang kiểm tra trạng thái...</p>";

    try {
        // Vẫn gọi API để kiểm tra xem user đã đánh giá địa điểm này chưa
        const response = await fetch(`/api/reviews/${placeId}/`);
        const data = await response.json();

        if (data.has_reviewed) {
            form.innerHTML = `
                <div class="alert-info" style="text-align:center; padding:20px; background:#e1f5fe; border-radius:8px;">
                    <i class="fa-solid fa-circle-check" style="font-size: 24px; color: #0288d1;"></i>
                    <p style="margin-top:10px;">Bạn đã thực hiện đánh giá cho địa điểm này.</p>
                    <button type="button" class="btn" style="margin-top:10px;" onclick="closeReviewModal()">Đóng</button>
                </div>`;
        } else {
            // Chỉ hiện Form nhập
            form.innerHTML = `
                <div class="rating-group" style="text-align: center; margin-bottom: 15px;">
                    <label style="display:block; margin-bottom:10px; font-weight:bold;">Chất lượng dịch vụ:</label>
                    ${renderStarRating('overall')}
                </div>
                <div class="comment-group">
                    <textarea id="commentText" name="comment" rows="4" 
                        style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; resize:none;" 
                        placeholder="Hãy chia sẻ trải nghiệm của bạn về địa điểm này..."></textarea>
                </div>
                <div class="modal-footer" style="margin-top:20px; display:flex; gap:10px; justify-content: flex-end;">
                    <button type="button" class="btn" onclick="closeReviewModal()" style="background:#eee;">Hủy</button>
                    <button type="submit" class="btn btn-add" style="background:#28a745; color:white;">Gửi đánh giá</button>
                </div>`;

            form.onsubmit = (e) => handleReviewSubmit(e, placeId);
        }
    } catch (error) {
        form.innerHTML = "<p style='color:red; text-align:center;'>Không thể kết nối máy chủ. Vui lòng thử lại sau.</p>";
    }
}
// Thêm hàm này vào file JS của bạn
async function handleReviewSubmit(e, numericId) {
    e.preventDefault();
    
    const form = e.target;
    const rating = form.querySelector('input[name="overall"]:checked')?.value;
    const comment = form.querySelector('#commentText')?.value;

    if (!rating) { alert("Vui lòng chọn sao!"); return; }

    try {
        const response = await fetch(`/review/${numericId}/`, {
            method: "POST",
            headers: {
                // ĐÂY LÀ PHẦN QUAN TRỌNG ĐỂ HẾT LỖI 403
                "X-CSRFToken": getCookie('csrftoken'), 
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                'rating': rating,
                'comment': comment
            })
        });

        if (response.ok) {
            alert("Đánh giá thành công!");
            closeReviewModal();
            // Load lại danh sách hoặc trang
            location.reload(); 
        } else if (response.status === 403) {
            alert("Lỗi 403: Phiên làm việc hết hạn hoặc thiếu mã bảo mật CSRF. Hãy thử F5 lại trang.");
        } else {
            const err = await response.json();
            alert("Lỗi: " + (err.error || "Không thể lưu"));
        }
    } catch (error) {
        alert("Lỗi kết nối server!");
    }
}
async function deleteReview(reviewId) {
    if (!confirm("Bạn có chắc chắn muốn xóa đánh giá này?")) return;

    try {
        const res = await fetch(`/api/delete-review/${reviewId}/`, {
            method: "DELETE",
            headers: { "X-CSRFToken": getCSRFToken() }
        });
        if (res.ok) {
            alert("Đã xóa đánh giá.");
            // Đóng modal hoặc load lại trang
            location.reload(); 
        }
    } catch (e) {
        alert("Lỗi khi xóa!");
    }
}
function renderStarRating(name) {
    return `
        <div class="star-rating">
            <input type="radio" id="${name}5" name="${name}" value="5">
            <label for="${name}5">★</label>
            <input type="radio" id="${name}4" name="${name}" value="4">
            <label for="${name}4">★</label>
            <input type="radio" id="${name}3" name="${name}" value="3">
            <label for="${name}3">★</label>
            <input type="radio" id="${name}2" name="${name}" value="2">
            <label for="${name}2">★</label>
            <input type="radio" id="${name}1" name="${name}" value="1">
            <label for="${name}1">★</label>
        </div>
    `;
}

function closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    if (modal) modal.style.display = 'none';
}
function savePlace(placeName) {
    let savedPlaces = JSON.parse(localStorage.getItem("mySavedPlaces")) || [];

    const isExisted = savedPlaces.some(place => place.name === placeName);

    if (isExisted) {
        alert("Địa điểm này đã có trong danh sách lưu của bạn!");
        return;
    }

    const newPlace = {
        name: placeName,
        savedAt: new Date().toLocaleString('vi-VN'),
    };

    savedPlaces.push(newPlace);
    localStorage.setItem("mySavedPlaces", JSON.stringify(savedPlaces));

    alert(`Đã lưu "${placeName}" thành công!`);
}
function savePlace(encodedData, event) {
    // 1. Giải mã dữ liệu
    let placeObj;
    try {
        placeObj = JSON.parse(decodeURIComponent(escape(atob(encodedData))));
    } catch (e) {
        console.error("Lỗi giải mã dữ liệu:", e);
        return;
    }
    
    const btnSave = event ? event.currentTarget : null;
    let savedPlaces = JSON.parse(localStorage.getItem("mySavedPlaces")) || [];
    
    const existingIndex = savedPlaces.findIndex(item => item.name === placeObj.name);

    if (existingIndex !== -1) {
        if (confirm(`Bạn có muốn bỏ lưu "${placeObj.name}" không?`)) {
            savedPlaces.splice(existingIndex, 1);
            localStorage.setItem("mySavedPlaces", JSON.stringify(savedPlaces));

            if (btnSave) {
                btnSave.style.color = ""; 
                btnSave.innerHTML = '<i class="fa-solid fa-bookmark"></i> LƯU';
            }
        }
    } else {
        savedPlaces.push({
            ...placeObj,
            savedAt: new Date().toLocaleString('vi-VN')
        });
        localStorage.setItem("mySavedPlaces", JSON.stringify(savedPlaces));

        if (btnSave) {
            btnSave.style.color = "gold";
            btnSave.innerHTML = '<i class="fa-solid fa-check"></i> ĐÃ LƯU';
        }
        alert("Đã lưu vào danh sách yêu thích!");
    }
}
function showSavedPlaces() {
    const savedPlaces = JSON.parse(localStorage.getItem("mySavedPlaces")) || [];
    const content = document.getElementById("info-content");
    
    let html = `<h3><i class="fa-solid fa-star" style="color: #ffc107;"></i> Địa điểm đã lưu</h3>`;
    
    if (savedPlaces.length === 0) {
        html += "<p class='text-muted'>Danh sách yêu thích trống.</p>";
    } else {
        html += "<ul>" + savedPlaces.map(p => {
            // Mã hóa dữ liệu để truyền vào hàm an toàn
            const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(p))));
            
            return `
            <li class="list-item" onclick="handleSavedItemClick('${encoded}')">
                <div style="display:flex; align-items:center;">
                    <div class="item-icon"><i class="fa-solid fa-location-dot"></i></div>
                    <div class="item-info">
                        <span class="item-name">${p.name}</span>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right" style="color:#ccc; font-size:0.8rem;"></i>
            </li>`;
        }).join('') + "</ul>";
        
        html += `<button class="btn-clear-all" onclick="if(confirm('Xóa hết?')){localStorage.removeItem('mySavedPlaces'); showSavedPlaces();}">Xóa tất cả</button>`;
    }
    
    content.innerHTML = html;
    document.getElementById("info-panel").style.display = "block";
}

function handleSavedItemClick(encodedData) {
    // 1. Giải mã dữ liệu từ chuỗi encoded
    let p;
    try {
        p = JSON.parse(decodeURIComponent(escape(atob(encodedData))));
    } catch (e) {
        console.error("Lỗi giải mã dữ liệu lưu trữ:", e);
        return;
    }

    // 2. Hiển thị bảng thông tin (Panel) và nạp Review
    displayInfo(p); 

    if (window.map) {
        // 3. Di chuyển bản đồ đến vị trí địa điểm
        window.map.flyTo([p.latitude, p.longitude], 16);

        // 4. TỰ ĐỘNG HIỆN MARKER (Đây là phần bạn đang thiếu)
        
        // Xóa marker cũ nếu có (tùy chọn - để tránh chồng chéo)
        if (window.currentSearchMarker) {
            window.map.removeLayer(window.currentSearchMarker);
        }

        // Tạo marker mới tại tọa độ địa điểm đã lưu
        window.currentSearchMarker = L.marker([p.latitude, p.longitude])
            .addTo(window.map)
            .bindPopup(`<b>${p.name}</b><br>${p.address || ''}`)
            .openPopup();
    }
}
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
async function loadReviewsToPanel(placeId) {
    const listContainer = document.getElementById("direct-reviews-list");
    const avgStarsContainer = document.getElementById("avg-stars");
    const avgScoreContainer = document.getElementById("avg-score");
    const countContainer = document.getElementById("total-reviews-count");

    if (!listContainer) return;

    try {
        const response = await fetch(`/api/reviews/${placeId}/`);
        if (!response.ok) throw new Error("Không thể tải đánh giá");
        
        const data = await response.json();

        if (data.reviews && data.reviews.length > 0) {
            // 1. Logic tính toán trung bình cộng
            const totalReviews = data.reviews.length;
            const sumRating = data.reviews.reduce((acc, rev) => acc + rev.rating, 0);
            const average = (sumRating / totalReviews).toFixed(1);

            // 2. Cập nhật phần hiển thị tổng quan (Top Rating)
            if (avgStarsContainer) {
                // Tạo chuỗi sao (ví dụ 4.5 làm tròn thành 5 sao vàng hoặc 4 sao vàng tùy bạn chọn)
                // Ở đây dùng Math.round để hiển thị số sao vàng tương ứng
                const roundedAvg = Math.round(average);
                avgStarsContainer.innerHTML = `<span style="color: #f1c40f;">${'★'.repeat(roundedAvg)}${'☆'.repeat(5 - roundedAvg)}</span>`;
            }
            if (avgScoreContainer) avgScoreContainer.innerText = average;
            if (countContainer) countContainer.innerText = `(${totalReviews} đánh giá)`;

            // 3. Hiển thị danh sách chi tiết các đánh giá
            listContainer.innerHTML = data.reviews.map(rev => `
                <div class="direct-review-item" style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="font-size: 14px; color: #333;">${rev.user_name}</strong>
                        <span style="color: #f1c40f; font-size: 12px;">${'★'.repeat(rev.rating)}${'☆'.repeat(5 - rev.rating)}</span>
                    </div>
                    <p style="margin: 5px 0; font-size: 13px; color: #555;">${rev.comment || 'Không có nhận xét.'}</p>
                    <small style="color: #999; font-size: 11px;">${rev.created_at}</small>
                </div>
            `).join('');
        } else {
            // Trường hợp không có đánh giá
            if (avgStarsContainer) avgStarsContainer.innerHTML = '<span style="color: #ccc;">' + '☆'.repeat(5) + '</span>';
            if (avgScoreContainer) avgScoreContainer.innerText = "0.0";
            if (countContainer) countContainer.innerText = "(0 đánh giá)";
            listContainer.innerHTML = "<p style='color:#999; font-size: 13px;'>Địa điểm này chưa có đánh giá nào. Hãy là người đầu tiên!</p>";
        }
    } catch (error) {
        console.error(error);
        listContainer.innerHTML = "<p style='color:red; font-size: 13px;'>Lỗi khi tải đánh giá.</p>";
    }
}
async function getCoordinate(query) {
    if (!query || typeof query !== 'string') return null;
    
    let val = query.trim();

    // 1. Nếu người dùng nhập trực tiếp tọa độ dạng số "21.02, 105.83"
    const regExp = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
    if (regExp.test(val)) {
        return val.split(',').map(Number);
    }

    // 2. Nếu là địa chỉ (Tên đường, Tên tỉnh...) -> Search qua Nominatim
    console.log("Đang tìm tọa độ qua API cho:", val);
    try {
        // Thêm ", Vietnam" để kết quả chính xác hơn
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val + ", Vietnam")}&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
            return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
    } catch (err) {
        console.error("Lỗi tìm kiếm tọa độ:", err);
    }
    return null;
}

async function calculateRoute() {
    const startInput = document.getElementById("startPoint");
    const endInput = document.getElementById("endPoint");
    const loading = document.getElementById("loading");

    // 1. Kiểm tra sự tồn tại của các ô nhập liệu
    if (!startInput || !endInput) {
        console.error("Không tìm thấy startPoint hoặc endPoint");
        return;
    }

    if (loading) loading.style.display = "block";

    try {
        let startLat, startLng, endLat, endLng;

        // --- XỬ LÝ ĐIỂM ĐI ---
        // Ưu tiên lấy từ dataset (đã lưu khi bấm "Vị trí của bạn" hoặc chọn từ bản đồ)
        if (startInput.dataset.lat && startInput.dataset.lng) {
            startLat = startInput.dataset.lat;
            startLng = startInput.dataset.lng;
        } else {
            // Nếu không có dataset (người dùng gõ địa điểm mới), gọi getCoordinate
            const val = startInput.value ? startInput.value.trim() : "";
            if (val) {
                const coords = await getCoordinate(val); // Truyền String, không truyền Input
                if (coords) {
                    startLat = coords[0];
                    startLng = coords[1];
                }
            }
        }

        // --- XỬ LÝ ĐIỂM ĐẾN ---
        // Ưu tiên lấy từ dataset (Lưu tọa độ thực của Du Miên Garden Cafe vào đây)
        if (endInput.dataset.lat && endInput.dataset.lng) {
            endLat = endInput.dataset.lat;
            endLng = endInput.dataset.lng;
        } else {
            const val = endInput.value ? endInput.value.trim() : "";
            if (val) {
                const coords = await getCoordinate(val); 
                if (coords) {
                    endLat = coords[0];
                    endLng = coords[1];
                }
            }
        }

        // 2. Kiểm tra kết quả
        if (!startLat || !startLng) {
            alert("Không xác định được điểm đi: " + startInput.value);
            return;
        }
        if (!endLat || !endLng) {
            alert("Không xác định được điểm đến: " + endInput.value);
            return;
        }

        // 3. GỌI HÀM VẼ ĐƯỜNG
        console.log(`Bắt đầu chỉ đường từ [${startLat}, ${startLng}] đến [${endLat}, ${endLng}]`);
        await showRouteORS(endLat, endLng, startLat, startLng);

    } catch (error) {
        console.error("Lỗi calculateRoute:", error);
        alert("Có lỗi xảy ra khi tính toán đường đi.");
    } finally {
        if (loading) loading.style.display = "none";
    }
}
async function searchGlobal(query) {
    console.log("Tìm kiếm toàn cầu cho:", query);
    try {
        const osmRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ", Vietnam")}&limit=1`);
        const osmData = await osmRes.json();
        
        if (osmData && osmData.length > 0) {
            const item = osmData[0];
            const osmPlace = {
                id: "temp_" + Date.now(), // Gán ID tạm để ko bị lỗi code hiển thị
                name: item.display_name.split(',')[0],
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                address: item.display_name,
                description: "Địa chỉ từ vệ tinh.",
                category: "Địa chỉ",
                img: "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?w=400"
            };
            renderSearchResult(osmPlace.latitude, osmPlace.longitude, osmPlace.name, osmPlace);
        } else {
            alert("Không tìm thấy địa điểm!");
        }
    } catch (e) {
        console.error("Lỗi tìm global:", e);
    }
}
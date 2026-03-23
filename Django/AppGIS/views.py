from django.conf import settings
from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, JsonResponse
from .models import TourismPoint, Category 
from geopy.distance import geodesic
import re
import unicodedata
import json
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q
import math
# ==============================
# Các trang tĩnh
# ==============================
def index(request):
    return render(request, 'home.html')

def about(request):
    return render(request, 'about.html')

def destinations(request):
    points = TourismPoint.objects.all() 
    return render(request, "destinations.html", {"points": points})

def events(request):
    return render(request, 'events.html')

def services(request):
    return render(request, 'services.html')

def contact(request): 
    if request.method == "POST": 
        name = request.POST.get("name") 
        email = request.POST.get("email") 
        message = request.POST.get("message") 
        print(f"Liên hệ từ {name} - {email}: {message}") 
        return redirect("contact_success") 
    return render(request, "contact.html")

def contact_success(request):
    return render(request, 'contact_success.html')

# ==============================
# Tool WebGIS
# ==============================
def slugify(value):
    # chuyển unicode có dấu thành không dấu
    value = unicodedata.normalize('NFD', value)
    value = value.encode('ascii', 'ignore').decode('utf-8')
    # loại bỏ ký tự đặc biệt, khoảng trắng
    value = re.sub(r'[^\w\s-]', '', value).strip().lower()
    return re.sub(r'[-\s]+', '', value)

def search(request):
    query = request.GET.get("q", "")
    results = TourismPoint.objects.filter(name__icontains=query)
    data = [] 
    for p in results: 
        folder = slugify(p.name)  # tên thư mục theo tên địa điểm
        data.append({ 
            "name": p.name, 
            "description": p.description, 
            "latitude": p.latitude, 
            "longitude": p.longitude, 
            "category": p.category.name if p.category else None, 
            "address": p.address, 
            "open_hours": p.open_hours, 
            "rating": p.rating, 
            "img": p.img, 
            "menu_imgs": [f"/static/images/menus/{folder}/{img}" for img in (p.menu_imgs or [])]
        })
    return JsonResponse(data, safe=False)

def get_places_by_category(request):
    category_slug = request.GET.get('category', '').strip().lower()

    # Mapping slug tiếng Anh sang tên tiếng Việt trong DB
    category_map = {
        'restaurant': 'Nhà hàng',
        'hotel': 'Khách sạn',
        'attraction': 'Khu vui chơi',
        'museum': 'Di tích',
        'pharmacy': 'Hiệu thuốc',
        'atm': 'ATM'
    }

    target_type_vn = category_map.get(category_slug, category_slug)

    # Sửa lại: dùng category__name thay vì type
    places = TourismPoint.objects.filter(
        Q(category__name__icontains=target_type_vn)
    ).values(
        'id', 'name', 'latitude', 'longitude', 'address', 'description', 'rating', 'img'
    )

    data = list(places)
    for item in data:
        item['image'] = item.get('img', '')

    return JsonResponse(data, safe=False)

def distance(request):
    start = request.GET.get("start")
    end = request.GET.get("end")
    try:
        p1 = TourismPoint.objects.get(name=start)
        p2 = TourismPoint.objects.get(name=end)
        dist = geodesic((p1.latitude, p1.longitude), (p2.latitude, p2.longitude)).km
        return JsonResponse({"distance_km": dist})
    except TourismPoint.DoesNotExist:
        return JsonResponse({"error": "Không tìm thấy điểm"}, status=404)

def get_distance(request, point_id):
    try:
        user_lat = float(request.GET.get("lat"))
        user_lng = float(request.GET.get("lng"))
        point = TourismPoint.objects.get(id=point_id)
        info = point.distance_from(user_lat, user_lng, speed_kmh=40)
        return JsonResponse({
            "point": point.name,
            "distance_km": info["distance_km"],
            "time_minutes": info["time_minutes"],
            "latitude": point.latitude,
            "longitude": point.longitude,
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

def hotels_list(request):
    hotels = TourismPoint.objects.filter(category__name="Khách sạn")
    return render(request, "hotels.html", {"hotels": hotels})

def restaurants_list(request):
    restaurants = TourismPoint.objects.filter(category__name="Nhà hàng")
    return render(request, "restaurants.html", {"restaurants": restaurants})

def tour_list(request):
    tours = [
        {"id": 1, "title": "Hành trình Di sản Lịch sử", "desc": "Tham quan Dinh Độc Lập...", "price": "850.000 VND", "duration": "1 ngày", "tag": "Lịch sử"},
        {"id": 2, "title": "Sài Gòn Street Food & Motorbike", "desc": "Thưởng thức ẩm thực...", "price": "1.100.000 VND", "duration": "4 tiếng (Tối)", "tag": "Ẩm thực"},
        {"id": 3, "title": "Khám phá Địa đạo Củ Chi", "desc": "Hệ thống địa đạo...", "price": "950.000 VND", "duration": "Nửa ngày", "tag": "Khám phá"},
        {"id": 4, "title": "Ngắm hoàng hôn trên Sông Sài Gòn", "desc": "Du thuyền hạng sang...", "price": "1.500.000 VND", "duration": "2 tiếng", "tag": "Nghỉ dưỡng"},
        {"id": 5, "title": "Tour Sinh thái Cần Giờ", "desc": "Lá phổi xanh...", "price": "1.350.000 VND", "duration": "1 ngày", "tag": "Thiên nhiên"},
        {"id": 6, "title": "Chinatown - Chợ Lớn Sầm uất", "desc": "Văn hóa người Hoa...", "price": "700.000 VND", "duration": "Nửa ngày", "tag": "Văn hóa"}
    ]
    return render(request, "tours.html", {"tours": tours})

def book_tour(request, tour_id):
    # Dữ liệu tour giả lập để phục vụ logic render/post
    tours = [{"id": i, "title": f"Tour {i}"} for i in range(1, 7)]
    tour = next((t for t in tours if t["id"] == tour_id), None)
    if not tour:
        return HttpResponse("Không tìm thấy tour")

    if request.method == "POST":
        name = request.POST.get("name")
        print(f"Đã đặt tour: {tour['title']} cho khách {name}")
        return redirect("booking_success")

    return render(request, "book_tour.html", {"tour": tour})

def booking_success(request):
    return render(request, "booking_success.html")

def transport_list(request):
    transports = [
        {"id": 1, "title": "Xe máy điện (VinFast)", "desc": "Tiện lợi...", "price": "150.000 VND/ngày", "type": "Xe máy", "capacity": "2 người", "rating": 4.8},
        {"id": 2, "title": "Xe Ô tô 7 chỗ (Xpander)", "desc": "Rộng rãi...", "price": "1.200.000 VND/ngày", "type": "Ô tô", "capacity": "7 người", "rating": 4.9},
        {"id": 3, "title": "Xe buýt sông (Saigon Waterbus)", "desc": "Ngắm cảnh sông...", "price": "15.000 VND/lượt", "type": "Đường thủy", "capacity": "60 người", "rating": 4.7},
        {"id": 4, "title": "Xe Buýt 2 Tầng (Hop-on Hop-off)", "desc": "Toàn cảnh Sài Gòn...", "price": "150.000 VND/vé", "type": "Xe buýt", "capacity": "50 người", "rating": 4.9},
        {"id": 5, "title": "Xe Buýt Điện (D4)", "desc": "Hiện đại...", "price": "7.000 VND/lượt", "type": "Xe buýt", "capacity": "25 chỗ", "rating": 4.8}
    ]
    return render(request, "transport.html", {"transports": transports})

def nearby_places(request):
    lat_str = request.GET.get("lat")
    lng_str = request.GET.get("lng")
    radius_str = request.GET.get("radius", "2")

    if not lat_str or not lng_str:
        return JsonResponse({"error": "Thiếu tham số lat hoặc lng"}, status=400)

    try:
        user_lat = float(lat_str)
        user_lng = float(lng_str)
        radius_km = float(radius_str)

        points = TourismPoint.objects.all()
        nearby = []

        for p in points:
            dist = geodesic((user_lat, user_lng), (p.latitude, p.longitude)).km
            if dist <= radius_km:
                nearby.append({
                    "name": p.name,
                    "latitude": p.latitude,
                    "longitude": p.longitude,
                    "address": p.address,
                    "rating": p.rating,
                    "distance_km": round(dist, 2)
                })

        # Tạo polygon buffer (GeoJSON circle)
        buffer_coords = []
        steps = 36  # số điểm để vẽ vòng tròn
        for i in range(steps):
            angle = 2 * math.pi * i / steps
            dlat = (radius_km / 111) * math.cos(angle)  # 1 độ lat ~111km
            dlng = (radius_km / (111 * math.cos(math.radians(user_lat)))) * math.sin(angle)
            buffer_coords.append([user_lng + dlng, user_lat + dlat])

        buffer_geojson = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [buffer_coords]
            },
            "properties": {"radius_km": radius_km}
        }

        return JsonResponse({
            "center": {"lat": user_lat, "lng": user_lng},
            "radius_km": radius_km,
            "nearby": nearby,
            "buffer": buffer_geojson
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)
    
# ==============================
# API Admin & Quản lý địa điểm
# ==============================
def admin_places_view(request):
    return render(request, 'admin_places.html')

@csrf_exempt
def api_places(request):
    if request.method == "GET":
        places = TourismPoint.objects.all().order_by('-id')
        data = []
        for p in places:
            img_value = p.img if p.img else ""
            if img_value and not img_value.startswith(('http', '/')):
                img_url = settings.STATIC_URL + "images/" + img_value
            else:
                img_url = img_value

            data.append({
                "id": p.id,
                "name": p.name,
                "latitude": float(p.latitude) if p.latitude else 0,
                "longitude": float(p.longitude) if p.longitude else 0,
                "category": p.category.name if p.category else "Khác",
                "address": p.address if p.address else "Chưa có địa chỉ",
                "rating": p.rating if p.rating else 0,
                "img": img_url,
                "raw_img": p.img 
            })
        return JsonResponse(data, safe=False)

    elif request.method == "POST":
        try:
            raw_data = json.loads(request.body)

            name = raw_data.get('name')
            if not name:
                return JsonResponse({"error": "Thiếu tên địa điểm"}, status=400)

            lat = raw_data.get('latitude')
            lng = raw_data.get('longitude')
            latitude = float(lat) if lat else 0.0
            longitude = float(lng) if lng else 0.0

            cat_name = raw_data.get('category')
            cat_obj, _ = Category.objects.get_or_create(name=cat_name if cat_name else "Khác")

            new_place = TourismPoint.objects.create(
                name=name,
                latitude=latitude,
                longitude=longitude,
                category=cat_obj,   # gán object Category, không phải chuỗi
                address=raw_data.get('address', ''),
                img=raw_data.get('img', ''),
                rating=raw_data.get('rating', 5.0)
            )
            return JsonResponse({"message": "Thêm thành công"}, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
def api_place_detail(request, pk):
    place = get_object_or_404(TourismPoint, pk=pk)
    
    if request.method == "DELETE":
        place.delete()
        return JsonResponse({"message": "Xóa thành công"}, status=204)
    
    elif request.method == "PUT":
        try:
            raw_data = json.loads(request.body)
            place.name = raw_data.get('name', place.name)
            place.latitude = raw_data.get('latitude', place.latitude)
            place.longitude = raw_data.get('longitude', place.longitude)
            cat_name = raw_data.get('category')

            if cat_name:
                cat_obj, _ = Category.objects.get_or_create(name=cat_name)
                place.category = cat_obj

            place.address = raw_data.get('address', place.address)
            place.save()
            return JsonResponse({"message": "Cập nhật thành công"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

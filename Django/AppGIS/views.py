from django.conf import settings
from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, JsonResponse
from .models import TodoItem, TourismPoint 
from geopy.distance import geodesic
import json
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q

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
def search(request):
    query = request.GET.get("q", "")
    results = TourismPoint.objects.filter(name__icontains=query)
    data = [] 
    for p in results: 
        data.append({ 
            "name": p.name, 
            "description": p.description, 
            "latitude": p.latitude, 
            "longitude": p.longitude, 
            "type": p.type, 
            "address": p.address, 
            "open_hours": p.open_hours, 
            "rating": p.rating, 
            "img": p.img, 
        })
    return JsonResponse(data, safe=False)

def get_places_by_category(request):
    category_slug = request.GET.get('category', '')
    category_map = {
        'restaurant': 'Nhà hàng',
        'hotel': 'Khách sạn',
        'attraction': 'Khu vui chơi',
        'museum': 'Di tích',
        'pharmacy': 'Hiệu thuốc',
        'atm': 'ATM'
    }
    
    target_type_vn = category_map.get(category_slug, '')
    places = TourismPoint.objects.filter(
        Q(type__icontains=target_type_vn) | Q(type__icontains=category_slug)
    ).values(
        'name', 'latitude', 'longitude', 'address', 'description', 'rating', 'img'
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
    hotels = TourismPoint.objects.filter(type="Khách sạn")
    return render(request, "hotels.html", {"hotels": hotels})

def restaurants_list(request):
    restaurants = TourismPoint.objects.filter(type="Nhà hàng")
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
    try:
        user_lat = float(request.GET.get("lat"))
        user_lng = float(request.GET.get("lng"))
        radius_km = float(request.GET.get("radius", 2))

        points = TourismPoint.objects.all()
        nearby = []

        for p in points:
            dist = geodesic((user_lat, user_lng), (p.latitude, p.longitude)).km
            if dist <= radius_km:
                nearby.append({
                    "name": p.name,
                    "description": p.description,
                    "latitude": p.latitude,
                    "longitude": p.longitude,
                    "type": p.type,
                    "address": p.address,
                    "open_hours": p.open_hours,
                    "rating": p.rating,
                    "img": p.img.url if p.img else "",
                    "distance_km": round(dist, 2)
                })
        return JsonResponse(nearby, safe=False)
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
                "category": p.type if p.type else "Khác",
                "address": p.address if p.address else "Chưa có địa chỉ",
                "rating": p.rating if p.rating else 0,
                "img": img_url,
                "raw_img": p.img 
            })
        return JsonResponse(data, safe=False)

    elif request.method == "POST":
        try:
            raw_data = json.loads(request.body)
            new_place = TourismPoint.objects.create(
                name=raw_data.get('name'),
                latitude=float(raw_data.get('latitude')),
                longitude=float(raw_data.get('longitude')),
                type=raw_data.get('category'), 
                address=raw_data.get('address', ''),
                img=raw_data.get('img', ''), 
                rating=5.0
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
            place.type = raw_data.get('type', place.type)
            place.address = raw_data.get('address', place.address)
            place.save()
            return JsonResponse({"message": "Cập nhật thành công"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
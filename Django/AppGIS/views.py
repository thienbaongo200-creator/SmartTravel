from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from .models import TodoItem, TourismPoint
from geopy.distance import geodesic
from django.http import JsonResponse
# ==============================
# Các trang tĩnh
# ==============================
def index(request):
    return render(request, 'home.html')

def about(request):
    return render(request, 'about.html')

def destinations(request):
    return render(request, 'destinations.html')

def events(request):
    return render(request, 'events.html')

def services(request):
    return render(request, 'services.html')

def contact(request):
    return render(request, 'contact.html')

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
    except TourismPoint.DoesNotExist:
        return JsonResponse({"error": "Không tìm thấy địa điểm"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)
# ==============================
def destinations(request):
    points = TourismPoint.objects.all() 
    return render(request, "destinations.html", {"points": points})
def hotels_list(request):
    hotels = TourismPoint.objects.filter(type="Khách sạn")
    return render(request, "hotels.html", {"hotels": hotels})
def restaurants_list(request):
    restaurants = TourismPoint.objects.filter(type="Nhà hàng")
    return render(request, "restaurants.html", {"restaurants": restaurants})
def tour_list(request):
    tours = [
        {"title": "Tour Sài Gòn trong ngày", "desc": "Khám phá các điểm nổi bật ở TP.HCM", "price": "1.200.000 VND"},
        {"title": "Tour miền Tây sông nước", "desc": "Trải nghiệm chợ nổi và văn hóa miền Tây", "price": "2.500.000 VND"},
        {"title": "Tour Đà Lạt 3 ngày 2 đêm", "desc": "Khám phá thành phố ngàn hoa", "price": "3.800.000 VND"},
    ]
    return render(request, "tours.html", {"tours": tours})
def transport_list(request):
    transports = [
        {"title": "Taxi", "desc": "Đặt taxi nhanh chóng, tích hợp định vị GPS.", "price": "Theo km"},
        {"title": "Xe buýt", "desc": "Thông tin tuyến xe buýt, giờ chạy và trạm dừng.", "price": "5.000 VND/lượt"},
        {"title": "Thuê xe máy", "desc": "Thuê xe máy theo ngày, có sẵn bản đồ chỉ đường.", "price": "150.000 VND/ngày"},
        {"title": "Thuê ô tô", "desc": "Xe 4-7 chỗ, có tài xế hoặc tự lái.", "price": "800.000 VND/ngày"},
    ]
    return render(request, "transport.html", {"transports": transports})


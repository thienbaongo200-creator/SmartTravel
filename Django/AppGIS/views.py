from django.conf import settings
from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, JsonResponse
from .models import TodoItem, TourismPoint 
from geopy.distance import geodesic
import json
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q

# ==============================
# Các trang giao diện (Templates)
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
        print(f"Liên hệ từ {name}: {message}") 
        return redirect("contact_success") 
    return render(request, "contact.html")

def contact_success(request):
    return render(request, 'contact_success.html')

def admin_places_view(request):
    return render(request, 'admin_places.html')

# ==============================
# API Quản lý Địa điểm (Admin)
# ==============================
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
                "rating": p.rating if p.rating else 5.0,
                "img": img_url,
                "raw_img": p.img  
            })
        return JsonResponse(data, safe=False)

    elif request.method == "POST":
        try:
            raw_data = json.loads(request.body)
            new_place = TourismPoint.objects.create(
                name=raw_data.get('name'),
                latitude=float(raw_data.get('latitude', 0)),
                longitude=float(raw_data.get('longitude', 0)),
                type=raw_data.get('category') or raw_data.get('type') or 'Khác', 
                address=raw_data.get('address', ''),
                img=raw_data.get('img', ''), 
                rating=5.0
            )
            return JsonResponse({"message": "Thêm thành công", "id": new_place.id}, status=201)
        except Exception as e:
            print(f"LỖI TẠI VIEW POST: {str(e)}") 
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
            place.latitude = float(raw_data.get('latitude', place.latitude))
            place.longitude = float(raw_data.get('longitude', place.longitude))
            place.type = raw_data.get('category') or raw_data.get('type') or place.type
            place.address = raw_data.get('address', place.address)
            place.save()
            return JsonResponse({"message": "Cập nhật thành công"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

# ==============================
# Công cụ WebGIS & Tìm kiếm
# ==============================
def search(request):
    query = request.GET.get("q", "")
    results = TourismPoint.objects.filter(name__icontains=query)
    data = [] 
    for p in results: 
        data.append({ 
            "name": p.name, 
            "latitude": p.latitude, 
            "longitude": p.longitude, 
            "type": p.type, 
            "address": p.address, 
            "rating": p.rating, 
            "img": p.img, 
        })
    return JsonResponse(data, safe=False)

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
                    "latitude": p.latitude,
                    "longitude": p.longitude,
                    "type": p.type,
                    "distance_km": round(dist, 2)
                })
        return JsonResponse(nearby, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

def hotels_list(request):
    hotels = TourismPoint.objects.filter(type="Khách sạn")
    return render(request, "hotels.html", {"hotels": hotels})

def restaurants_list(request):
    restaurants = TourismPoint.objects.filter(type="Nhà hàng")
    return render(request, "restaurants.html", {"restaurants": restaurants})

def transport_list(request):
    transports = [
        {"id": 1, "title": "Xe máy điện", "price": "150.000 VND/ngày", "type": "Xe máy"},
        {"id": 2, "title": "Xe Ô tô 7 chỗ", "price": "1.200.000 VND/ngày", "type": "Ô tô"},
    ]
    return render(request, "transport.html", {"transports": transports})
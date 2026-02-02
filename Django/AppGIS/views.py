from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from .models import TodoItem, TourismPoint
from geopy.distance import geodesic
from django.http import JsonResponse
from .models import TourismPoint
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
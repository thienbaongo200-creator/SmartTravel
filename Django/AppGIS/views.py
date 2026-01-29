from django.shortcuts import render, HttpResponse
from .models import TodoItem

# Các trang tĩnh
def index(requets):
    return render(requets, 'home.html')
def about(requets):
    return render(requets, 'about.html')
def destinations(requets):
    return render(requets, 'destinations.html')
def events(request):
    return render(request, 'events.html')
def services(request):
    return render(request, 'services.html')
def contact(request):
    return render(request, 'contact.html')

# Tool WebGIS
# Trang bản đồ 
def map_view(request): 
    points = TourismPoint.objects.all() 
    return render(request, "map.html", {"points": points}) 

# API tìm kiếm địa điểm 
def search(request): 
    query = request.GET.get("q", "") 
    results = TourismPoint.objects.filter(name__icontains=query) 
    return JsonResponse(list(results.values()), safe=False) 

# API tính khoảng cách 
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
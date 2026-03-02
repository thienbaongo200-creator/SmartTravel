from django.shortcuts import render, redirect
from django.http import HttpResponse, JsonResponse
from .models import TodoItem, TourismPoint 
from geopy.distance import geodesic

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
    
    target_type = category_map.get(category_slug, category_slug)
    places = TourismPoint.objects.filter(type__icontains=target_type).values(
        'name', 'latitude', 'longitude', 'address', 'description', 'rating', 'img'
    )
    data = list(places)
    for item in data:
        item['image'] = item.get('img', '') 

    return JsonResponse(data, safe=False)
# ------------------------------

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
        {
            "id": 1,
            "title": "Hành trình Di sản Lịch sử", 
            "desc": "Tham quan Dinh Độc Lập, Nhà thờ Đức Bà, Bưu điện Thành phố và Bảo tàng Chứng tích Chiến tranh.", 
            "price": "850.000 VND",
            "duration": "1 ngày",
            "tag": "Lịch sử"
        },
        {
            "id": 2,
            "title": "Sài Gòn Street Food & Motorbike", 
            "desc": "Ngồi sau xe máy len lỏi qua các con hẻm, thưởng thức bánh xèo, cơm tấm và cà phê vợt huyền thoại.", 
            "price": "1.100.000 VND",
            "duration": "4 tiếng (Tối)",
            "tag": "Ẩm thực"
        },
        {
            "id": 3,
            "title": "Khám phá Địa đạo Củ Chi", 
            "desc": "Trải nghiệm hệ thống địa đạo kỳ vĩ dưới lòng đất và tìm hiểu về tinh thần thép của quân dân Việt Nam.", 
            "price": "950.000 VND",
            "duration": "Nửa ngày",
            "tag": "Khám phá"
        },
        {
            "id": 4,
            "title": "Ngắm hoàng hôn trên Sông Sài Gòn", 
            "desc": "Du ngoạn bằng du thuyền hạng sang, ngắm nhìn Landmark 81 và các tòa nhà lung linh ánh đèn từ mặt sông.", 
            "price": "1.500.000 VND",
            "duration": "2 tiếng",
            "tag": "Nghỉ dưỡng"
        },
        {
            "id": 5,
            "title": "Tour Sinh thái Cần Giờ", 
            "desc": "Rời xa khói bụi để đến với 'lá phổi xanh' của TP.HCM, thăm Đảo Khỉ và chèo xuồng qua rừng ngập mặn.", 
            "price": "1.350.000 VND",
            "duration": "1 ngày",
            "tag": "Thiên nhiên"
        },
        {
            "id": 6,
            "title": "Chinatown - Chợ Lớn Sầm uất", 
            "desc": "Khám phá văn hóa người Hoa tại Quận 5, tham quan Chùa Bà Thiên Hậu và chợ sỉ Bình Tây.", 
            "price": "700.000 VND",
            "duration": "Nửa ngày",
            "tag": "Văn hóa"
        }
    ]
    return render(request, "tours.html", {"tours": tours})

def book_tour(request, tour_id):
    tours = [
        {
            "id": 1,
            "title": "Hành trình Di sản Lịch sử", 
            "desc": "Tham quan Dinh Độc Lập, Nhà thờ Đức Bà, Bưu điện Thành phố và Bảo tàng Chứng tích Chiến tranh.", 
            "price": "850.000 VND",
            "duration": "1 ngày",
            "tag": "Lịch sử"
        },
        {
            "id": 2,
            "title": "Sài Gòn Street Food & Motorbike", 
            "desc": "Ngồi sau xe máy len lỏi qua các con hẻm, thưởng thức bánh xèo, cơm tấm và cà phê vợt huyền thoại.", 
            "price": "1.100.000 VND",
            "duration": "4 tiếng (Tối)",
            "tag": "Ẩm thực"
        },
        {
            "id": 3,
            "title": "Khám phá Địa đạo Củ Chi", 
            "desc": "Trải nghiệm hệ thống địa đạo kỳ vĩ dưới lòng đất và tìm hiểu về tinh thần thép của quân dân Việt Nam.", 
            "price": "950.000 VND",
            "duration": "Nửa ngày",
            "tag": "Khám phá"
        },
        {
            "id": 4,
            "title": "Ngắm hoàng hôn trên Sông Sài Gòn", 
            "desc": "Du ngoạn bằng du thuyền hạng sang, ngắm nhìn Landmark 81 và các tòa nhà lung linh ánh đèn từ mặt sông.", 
            "price": "1.500.000 VND",
            "duration": "2 tiếng",
            "tag": "Nghỉ dưỡng"
        },
        {
            "id": 5,
            "title": "Tour Sinh thái Cần Giờ", 
            "desc": "Rời xa khói bụi để đến với 'lá phổi xanh' của TP.HCM, thăm Đảo Khỉ và chèo xuồng qua rừng ngập mặn.", 
            "price": "1.350.000 VND",
            "duration": "1 ngày",
            "tag": "Thiên nhiên"
        },
        {
            "id": 6,
            "title": "Chinatown - Chợ Lớn Sầm uất", 
            "desc": "Khám phá văn hóa người Hoa tại Quận 5, tham quan Chùa Bà Thiên Hậu và chợ sỉ Bình Tây.", 
            "price": "700.000 VND",
            "duration": "Nửa ngày",
            "tag": "Văn hóa"
        }
    ]
    tour = next((t for t in tours if t["id"] == tour_id), None)
    if not tour:
        return HttpResponse("Không tìm thấy tour")

    if request.method == "POST":
        name = request.POST.get("name")
        email = request.POST.get("email")
        phone = request.POST.get("phone")
        people = request.POST.get("people")
        note = request.POST.get("note")

        # TODO: xử lý dữ liệu (lưu DB, gửi email, log ra console...)
        print(f"Khách {name} ({email}, {phone}) đặt tour {tour['title']} cho {people} người. Ghi chú: {note}")

        return redirect("booking_success")  # chuyển sang trang xác nhận đặt thành công

    return render(request, "book_tour.html", {"tour": tour})

def booking_success(request):
    return render(request, "booking_success.html")

def transport_list(request):
    transports = [
        {
            "id": 1,
            "title": "Xe máy điện (VinFast)",
            "desc": "Tiện lợi, bảo vệ môi trường, phù hợp len lỏi hẻm nhỏ Sài Gòn.",
            "price": "150.000 VND/ngày",
            "type": "Xe máy",
            "capacity": "2 người",
            "rating": 4.8
        },
        {
            "id": 2,
            "title": "Xe Ô tô 7 chỗ (Xpander)",
            "desc": "Xe đời mới, rộng rãi, phù hợp cho gia đình hoặc nhóm bạn.",
            "price": "1.200.000 VND/ngày",
            "type": "Ô tô",
            "capacity": "7 người",
            "rating": 4.9
        },
        {
            "id": 3,
            "title": "Xe buýt sông (Saigon Waterbus)",
            "desc": "Trải nghiệm ngắm thành phố từ sông Sài Gòn vô cùng thú vị.",
            "price": "15.000 VND/lượt",
            "type": "Đường thủy",
            "capacity": "60 người",
            "rating": 4.7
        },
        {
            "id": 4,
            "title": "Xe Buýt 2 Tầng (Hop-on Hop-off)",
            "desc": "Tour ngắm toàn cảnh Sài Gòn từ tầng 2, đi qua các điểm di tích nổi tiếng.",
            "price": "150.000 VND/vé",
            "type": "Xe buýt",
            "capacity": "50 người",
            "rating": 4.9
        },
        {
            "id": 5,
            "title": "Xe Buýt Điện (D4)",
            "desc": "Tuyến xe buýt điện hiện đại, máy lạnh, chạy êm ái qua các quận trung tâm.",
            "price": "7.000 VND/lượt",
            "type": "Xe buýt",
            "capacity": "25 chỗ",
            "rating": 4.8
        },
    ]
    return render(request, "transport.html", {"transports": transports})
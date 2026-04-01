import re
import os
import json
import math
import unicodedata
from django.conf import settings
from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, JsonResponse
from django.db.models import Q
from django.contrib.auth import login, logout
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.models import User
from django.contrib.admin.views.decorators import staff_member_required
from django.views.decorators.csrf import csrf_exempt
from geopy.distance import geodesic
from django.contrib.auth.decorators import login_required
from .models import TourismPoint, Category, Review, ImageGallery
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.core.paginator import Paginator
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
            'id': p.id,
            "name": p.name, 
            "description": p.description, 
            "latitude": p.latitude, 
            "longitude": p.longitude, 
            "category": p.category.name if p.category else None, 
            "address": p.address,
            "rating": p.rating, 
            "price": int(p.price) if p.price is not None else None, 
            "img": p.img, 
            "menu_imgs": [img for img in (p.menu_imgs or [])]
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
        'id', 'name', 'latitude', 'longitude', 'address', 'description', 'rating', 'img', 'price'
    )

    data = list(places)
    for item in data:
        item['image'] = item.get('img', '')
        item['price'] = int(item['price']) if item['price'] is not None else None
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
# Dịch Vụ Hiển Thị
# ==============================
def hotels_list(request):
    hotels = TourismPoint.objects.filter(category__name="Khách sạn")
    paginator = Paginator(hotels, 5) 
    page_number = request.GET.get('page') 
    hotels = paginator.get_page(page_number)
    return render(request, "hotels.html", {"hotels": hotels})

def restaurants_list(request):
    restaurants = TourismPoint.objects.filter(category__name="Nhà hàng")
    paginator = Paginator(restaurants, 5) 
    page_number = request.GET.get('page')
    restaurants = paginator.get_page(page_number)
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

@login_required
def submit_review(request, point_id):
    if request.method == "POST":
        # point_id ở đây nhận từ <int:point_id> trong urls.py
        point = get_object_or_404(TourismPoint, id=point_id)
        
        rating = request.POST.get('rating')
        comment = request.POST.get('comment', '')

        try:
            # Django sẽ tự điền user_id từ request.user
            # và tourismpoint_id từ đối tượng point
            Review.objects.create(
                tourismpoint=point,
                user=request.user,
                rating=float(rating),
                comment=comment
            )
            return JsonResponse({"message": "Lưu thành công"}, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Yêu cầu không hợp lệ"}, status=405)

# ==============================
# Admin Dashboard
# ==============================
@staff_member_required(login_url='login')
def admin_dashboard(request):
    places_count = TourismPoint.objects.count()
    users_count = User.objects.count()
    return render(request, 'admin/admin_dashboard.html', {
        "places_count": places_count,
        "users_count": users_count
    })

# ==============================
# Admin & Quản lý địa điểm
# ==============================
@staff_member_required(login_url='login')
def admin_places(request):
    return render(request, 'admin/admin_places.html')

@csrf_exempt
def api_places(request):
    if request.method == "GET":
        places = TourismPoint.objects.all().order_by('-id')
        data = []
        for p in places:
            gallery = []

            # Lấy ảnh từ ImageGallery (ảnh upload mới)
            for img in p.images.all():
                media_path = os.path.join(settings.MEDIA_ROOT, img.image.name)
                if os.path.exists(media_path):
                    gallery.append(settings.MEDIA_URL + img.image.name)
                else:
                    gallery.append(settings.STATIC_URL + "images/" + img.image.name)

            # Nếu gallery rỗng nhưng có dữ liệu menu_imgs (chuỗi JSON)
            if not gallery and hasattr(p, "menu_imgs") and p.menu_imgs:
                try:
                    imgs = json.loads(p.menu_imgs)
                    gallery = [settings.STATIC_URL + "images/" + path for path in imgs]
                except Exception:
                    gallery = []

            # Ảnh chính
            if gallery:
                img_url = gallery[0]
            elif p.img:
                media_path = os.path.join(settings.MEDIA_ROOT, p.img)
                if os.path.exists(media_path):
                    img_url = settings.MEDIA_URL + p.img
                else:
                    img_url = settings.STATIC_URL + "images/" + p.img
            else:
                img_url = None

            data.append({
                "id": p.id,
                "name": p.name,
                "latitude": float(p.latitude) if p.latitude else 0,
                "longitude": float(p.longitude) if p.longitude else 0,
                "category": p.category.name if p.category else "Khác",
                "address": p.address or "Chưa có địa chỉ",
                "rating": p.rating or 0,
                "price": p.price or 0,
                "img": img_url,
                "gallery": gallery
            })
        return JsonResponse(data, safe=False)

    elif request.method == "POST":
        try:
            name = request.POST.get('name')
            if not name:
                return JsonResponse({"error": "Thiếu tên địa điểm"}, status=400)

            latitude = float(request.POST.get('latitude', 0.0))
            longitude = float(request.POST.get('longitude', 0.0))
            cat_name = request.POST.get('category')
            cat_obj, _ = Category.objects.get_or_create(name=cat_name if cat_name else "Khác")

            place = TourismPoint.objects.create(
                name=name,
                latitude=latitude,
                longitude=longitude,
                category=cat_obj,
                address=request.POST.get('address', ''),
                price=request.POST.get('price', 0),
                rating=request.POST.get('rating', 5.0)
            )

            # Lưu nhiều ảnh (nếu upload mới)
            for f in request.FILES.getlist("images"):
                ImageGallery.objects.create(tourismpoint=place, image=f)

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
            if request.content_type == "application/json":
                raw_data = json.loads(request.body)
            else:
                raw_data = request.POST

            place.name = raw_data.get('name', place.name)
            place.latitude = raw_data.get('latitude', place.latitude)
            place.longitude = raw_data.get('longitude', place.longitude)

            cat_name = raw_data.get('category')
            if cat_name:
                cat_obj, _ = Category.objects.get_or_create(name=cat_name)
                place.category = cat_obj

            place.address = raw_data.get('address', place.address)
            place.price = raw_data.get('price', place.price)
            place.save()

            # Nếu có ảnh mới thì thêm vào gallery
            for f in request.FILES.getlist("images"):
                ImageGallery.objects.create(tourismpoint=place, image=f)

            return JsonResponse({"message": "Cập nhật thành công"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
                
# ==============================
# Admin & Quản lý User
# ==============================
@staff_member_required(login_url='login')
def admin_user(request):
    return render(request, 'admin/admin_user.html')

@csrf_exempt
@staff_member_required(login_url='login')
def api_users(request):
    if request.method == "GET":
        users = User.objects.all().order_by('-id')
        data = []
        for u in users:
            data.append({
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "is_staff": u.is_staff,
                "is_superuser": u.is_superuser,
                "is_active": u.is_active,
            })
        return JsonResponse(data, safe=False)

    elif request.method == "POST":
        try:
            raw_data = json.loads(request.body)
            username = raw_data.get('username')
            email = raw_data.get('email')
            password = raw_data.get('password')
            if not username or not password:
                return JsonResponse({"error": "Thiếu username hoặc password"}, status=400)

            user = User.objects.create_user(
                username=username,
                email=email,
                password=password
            )
            user.is_staff = raw_data.get('is_staff', False)
            user.is_superuser = raw_data.get('is_superuser', False)
            user.is_active = raw_data.get('is_active', True)
            user.save()
            return JsonResponse({"message": "Thêm user thành công"}, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@staff_member_required(login_url='login')
def api_user_detail(request, pk):
    user = get_object_or_404(User, pk=pk)
    if request.method == "DELETE":
        user.delete()
        return JsonResponse({"message": "Xóa user thành công"}, status=204)
    elif request.method == "PUT":
        try:
            raw_data = json.loads(request.body)
            user.username = raw_data.get('username', user.username)
            user.email = raw_data.get('email', user.email)
            if raw_data.get('password'):
                user.set_password(raw_data['password'])
            user.is_staff = raw_data.get('is_staff', user.is_staff)
            user.is_superuser = raw_data.get('is_superuser', user.is_superuser)
            user.is_active = raw_data.get('is_active', user.is_active)
            user.save()
            return JsonResponse({"message": "Cập nhật user thành công"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

# ==============================
# Đăng Nhập & Đăng Ký & Đăng Xuất
# ==============================
def register_view(request):
    if request.method == "POST":
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect("home")
    else:
        form = UserCreationForm()
    return render(request, "account/register.html", {"form": form})

def login_view(request):
    form = AuthenticationForm(request, data=request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.get_user()
        login(request, user)
        # 👉 Nếu là admin (staff hoặc superuser) thì vào dashboard
        if user.is_staff or user.is_superuser:
            return redirect("admin_dashboard")
        # 👉 Nếu là user thường thì về trang home
        return redirect("home")
    return render(request, "account/login.html", {"form": form})

def logout_view(request):
    logout(request)
    return redirect("home")
@api_view(['POST'])
def add_tourism_place(request):
    # 1. Lấy các thông tin text từ request.data
    name = request.data.get('name')
    category_name = request.data.get('category')
    address = request.data.get('address')
    latitude = request.data.get('latitude')
    longitude = request.data.get('longitude')
    price = request.data.get('price', 0)

    category_obj, _ = Category.objects.get_or_create(name=category_name)

    place = TourismPoint.objects.create(
        name=name,
        category=category_obj,
        address=address,
        latitude=latitude,
        longitude=longitude,
        price=price
    )

    images = request.FILES.getlist('images')

    for img in images:
        ImageGallery.objects.create(
            tourismpoint=place,
            image=img
        )

    return Response({"message": "Thêm địa điểm và ảnh thành công!"}, status=201)


def get_places(request):
    places = TourismPoint.objects.all()
    data = []
    
    for p in places:
        # Lấy tất cả ảnh từ ImageGallery liên quan đến địa điểm này
        # images là related_name bạn đặt trong model ImageGallery
        gallery_urls = [img.image.url for img in p.images.all()]
        
        data.append({
            "id": p.id,
            "name": p.name,
            "address": p.address,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "category": p.category.name if p.category else "",
            "description": p.description,
            "price": float(p.price) if p.price else 0,
            "img": p.img, # Đây là field cũ
            "gallery": gallery_urls, # ĐÂY LÀ DỮ LIỆU MỚI
        })
        
    return JsonResponse(data, safe=False)

def get_reviews(request, place_id):
    try:
        # Sửa: Sử dụng tourismpoint_id theo đúng model của bạn
        reviews = Review.objects.filter(tourismpoint_id=place_id).order_by('-created_at')
        
        has_reviewed = False
        if request.user.is_authenticated:
            # Sửa: Sử dụng tourismpoint_id
            has_reviewed = Review.objects.filter(
                tourismpoint_id=place_id, 
                user=request.user
            ).exists()
            
        data = {
            "has_reviewed": has_reviewed,
            "reviews": [
                {
                    "id": r.id, # Quan trọng: Gửi ID để JS có thể dùng cho hàm Xóa
                    "rating": r.rating,
                    "comment": r.comment,
                    "user_name": r.user.username,
                    "created_at": r.created_at.strftime("%d/%m/%Y")
                } for r in reviews
            ]
        }
        return JsonResponse(data)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
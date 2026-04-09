import json
import math
import os
import re
import unicodedata
from django.contrib.auth import login as auth_login
from django.conf import settings
from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.csrf import csrf_exempt

from geopy.distance import geodesic
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .forms import UserLoginForm
from .forms import UserRegisterForm
from .models import (
    Category, ContactMessage, Review, 
    Tour, TourBooking, TourismPoint, ContactMessage
)
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
        ContactMessage.objects.create(name=name, email=email, message=message)
        
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

def tours_list(request):
    tours = Tour.objects.all()
    return render(request, "tours.html", {"tours": tours})

@login_required
def book_tour(request, tour_id):
    tour = get_object_or_404(Tour, pk=tour_id)
    
    # 1. Chặn nếu người dùng đang có một tour ở trạng thái 'pending'
    if TourBooking.objects.filter(user=request.user, status="pending").exists():
        messages.warning(request, "Bạn có một yêu cầu đang chờ xử lý!")
        return redirect("tours_list")

    if request.method == "POST":
        try:
            # 2. Lấy dữ liệu từ Form trong Modal của tour.html
            guests = int(request.POST.get("guests", 1))
            start_date = request.POST.get("start_date")
            phone = request.POST.get("phone")
            
            # 3. Tính toán tổng tiền
            total_price = tour.price * guests

            # 4. Lưu vào Database (TourBooking)
            TourBooking.objects.create(
                tour=tour,
                user=request.user,
                guests=guests,
                start_date=start_date,
                phone=phone,
                total_price=total_price,
                status="pending"
            )
            messages.success(request, "Đặt tour thành công! Chúng tôi sẽ liên hệ sớm.")
            return redirect("tours_list")
            
        except Exception as e:
            messages.error(request, f"Có lỗi xảy ra: {e}")
            return redirect("tours_list")
    
    return redirect("tours_list")

@login_required
def cancel_booking(request, booking_id):
    # Tìm booking của đúng user đó
    booking = get_object_or_404(TourBooking, id=booking_id, user=request.user)
    
    if request.method == "POST":
        # Nếu tour chưa được xác nhận thì mới cho phép chuyển sang 'cancelled' hoặc xóa
        if booking.status == 'pending':
            booking.status = 'cancelled'
            booking.save()
            messages.info(request, "Đã hủy yêu cầu đặt tour thành công.")
        else:
            messages.error(request, "Không thể hủy tour đã được xác nhận.")
            
    return redirect("tours_list")
@login_required
def cancel_booking(request, booking_id):
    # Chỉ cho phép người dùng hủy chính tour của mình và tour đó phải đang ở trạng thái 'pending'
    booking = get_object_or_404(TourBooking, id=booking_id, user=request.user)
    
    if request.method == "POST":
        # Cách 1: Xóa hẳn khỏi DB
        # booking.delete()
        
        # Cách 2 (Khuyên dùng): Chuyển trạng thái thành 'cancelled' thay vì xóa
        booking.status = 'cancelled'
        booking.save()
        
        return redirect("tours_list")
    
    return redirect("tours_list")
        
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
    bookings_count = TourBooking.objects.count()  
    return render(request, 'admin/admin_dashboard.html', {
        "places_count": places_count,
        "users_count": users_count,
        "bookings_count": bookings_count
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
            # Ưu tiên lấy URL từ p.img, nếu không có thì lấy ảnh đầu tiên trong menu_imgs
            gallery = p.menu_imgs if isinstance(p.menu_imgs, list) else []
            img_url = p.img if p.img else (gallery[0] if gallery else None)

            data.append({
                "id": p.id,
                "name": p.name,
                "latitude": float(p.latitude) if p.latitude else 0,
                "longitude": float(p.longitude) if p.longitude else 0,
                "category": p.category.name if p.category else "Khác",
                "address": p.address or "Chưa có địa chỉ",
                "rating": p.rating or 0,
                "price": float(p.price) if p.price else 0,
                "img": img_url,
                "gallery": gallery
            })
        return JsonResponse(data, safe=False)

    elif request.method == "POST":
        try:
            # 1. Thông tin cơ bản
            name = request.POST.get('name')
            if not name:
                return JsonResponse({"error": "Thiếu tên địa điểm"}, status=400)

            cat_name = request.POST.get('category')
            cat_obj, _ = Category.objects.get_or_create(name=cat_name if cat_name else "Khác")

            # 2. Xử lý Ảnh Chính (Trường img)
            main_img = request.FILES.get('main_image')
            main_url = ""
            if main_img:
                path = default_storage.save(f'tourism/main/{main_img.name}', main_img)
                main_url = settings.MEDIA_URL + path

            # 3. Xử lý Ảnh Phụ (Trường menu_imgs - tối đa 6 ảnh)
            uploaded_files = request.FILES.getlist("images")
            saved_gallery_urls = []
            for f in uploaded_files[:6]:
                path = default_storage.save(f'tourism/gallery/{f.name}', f)
                saved_gallery_urls.append(settings.MEDIA_URL + path)

            # 4. Lưu vào Database
            place = TourismPoint.objects.create(
                name=name,
                latitude=float(request.POST.get('latitude', 0.0)),
                longitude=float(request.POST.get('longitude', 0.0)),
                category=cat_obj,
                address=request.POST.get('address', ''),
                price=request.POST.get('price', 0),
                rating=request.POST.get('rating', 5.0),
                img=main_url,             # Lưu URL ảnh chính
                menu_imgs=saved_gallery_urls # Lưu list URL ảnh phụ
            )

            return JsonResponse({"message": "Thêm địa điểm thành công"}, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
        
@csrf_exempt
def api_place_detail(request, pk):
    place = get_object_or_404(TourismPoint, pk=pk)

    if request.method == "DELETE":
        place.delete()
        return JsonResponse({"message": "Xóa thành công"}, status=204)

    # Chấp nhận cả PUT và POST (để xử lý form-data dễ dàng hơn)
    elif request.method in ["PUT", "POST"]:
        try:
            # 1. Cập nhật các trường thông tin cơ bản
            place.name = request.POST.get('name', place.name)
            place.address = request.POST.get('address', place.address)
            place.price = request.POST.get('price', place.price)
            
            # Xử lý tọa độ (đảm bảo không bị lỗi nếu gửi chuỗi trống)
            lat = request.POST.get('latitude')
            lng = request.POST.get('longitude')
            if lat: place.latitude = float(lat)
            if lng: place.longitude = float(lng)
            
            # Xử lý Category
            cat_name = request.POST.get('category')
            if cat_name:
                cat_obj, _ = Category.objects.get_or_create(name=cat_name)
                place.category = cat_obj

            # 2. Cập nhật Ảnh Chính (Trường img)
            main_img = request.FILES.get('main_image')
            if main_img:
                # Xóa ảnh cũ nếu cần (tùy chọn) hoặc ghi đè
                path = default_storage.save(f'tourism/main/{main_img.name}', main_img)
                place.img = settings.MEDIA_URL + path

            # 3. Cập nhật Ảnh Phụ (Gallery)
            new_files = request.FILES.getlist("images")
            if new_files:
                # Lấy danh sách ảnh hiện tại (nếu có)
                current_gallery = place.menu_imgs if isinstance(place.menu_imgs, list) else []
                for f in new_files:
                    path = default_storage.save(f'tourism/gallery/{f.name}', f)
                    current_gallery.append(settings.MEDIA_URL + path)
                
                # Giới hạn số lượng ảnh trong gallery (ví dụ tối đa 10 ảnh)
                place.menu_imgs = current_gallery[:10]
            
            place.save()
            return JsonResponse({"message": "Cập nhật địa điểm thành công"})
            
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
# Admin & Quản lý đặt tour
# ==============================
def admin_tours(request):
    return render(request, 'admin/admin_tours.html')
@csrf_exempt
def api_tours(request, tour_id=None):
    if request.method == "GET":
        tours = list(Tour.objects.all().values().order_by('-created_at'))
        return JsonResponse(tours, safe=False)

    if request.method == "POST":
        # Thêm hoặc Cập nhật (Sử dụng Method Override hoặc check tour_id)
        title = request.POST.get('title')
        description = request.POST.get('description')
        price = request.POST.get('price')
        duration = request.POST.get('duration')
        tag = request.POST.get('tag')

        if tour_id: # Cập nhật
            tour = Tour.objects.get(id=tour_id)
            tour.title = title
            tour.description = description
            tour.price = price
            tour.duration = duration
            tour.tag = tag
            tour.save()
        else: # Thêm mới
            Tour.objects.create(
                title=title, description=description, 
                price=price, duration=duration, tag=tag
            )
        return JsonResponse({"message": "Thành công"})

    if request.method == "DELETE":
        Tour.objects.get(id=tour_id).delete()
        return JsonResponse({"message": "Đã xóa"})
def admin_tour_booking(request):
    bookings = TourBooking.objects.select_related("tour", "user").all()
    return render(request, "admin/admin_tour_booking.html", {"bookings": bookings})

@csrf_exempt
def api_booking_detail(request, pk):
    booking = get_object_or_404(TourBooking, pk=pk)

    if request.method == "GET":
        return JsonResponse({
            "id": booking.id,
            "tour": booking.tour.title,
            "user": booking.user.username,
            "guests": booking.guests,
            "start_date": booking.start_date.strftime("%Y-%m-%d") if booking.start_date else None,
            "total_price": float(booking.total_price),
            "status": booking.status,
        })

    elif request.method == "PUT":
        try:
            raw_data = json.loads(request.body)
            booking.guests = raw_data.get("guests", booking.guests)
            booking.start_date = raw_data.get("start_date", booking.start_date)
            booking.status = raw_data.get("status", booking.status)
            booking.save()
            return JsonResponse({"message": "Cập nhật booking thành công"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    elif request.method == "DELETE":
        booking.delete()
        return JsonResponse({"message": "Xóa booking thành công"}, status=204)

# ==============================
# Admin & Liên Hệ
# ==============================
@staff_member_required(login_url='login')
def admin_contacts(request):
    messages = ContactMessage.objects.all().order_by('-created_at')
    return render(request, 'admin/admin_contacts.html', {"messages": messages})
@staff_member_required
def delete_contact(request, pk):
    if request.method == 'DELETE':
        contact = get_object_or_404(ContactMessage, pk=pk)
        contact.delete()
        return JsonResponse({'status': 'success', 'message': 'Đã xóa liên hệ.'})
    return JsonResponse({'status': 'error'}, status=400)

# API Phản hồi qua Email
@staff_member_required
def reply_contact(request, pk):
    if request.method == 'POST':
        try:
            # 1. Tìm tin nhắn trong DB
            contact = get_object_or_404(ContactMessage, pk=pk)
            
            # 2. Đọc dữ liệu JSON từ request
            data = json.loads(request.body)
            reply_content = data.get('message')

            # 3. Gửi mail (Nếu dùng console backend thì nó sẽ in ra Terminal)
            send_mail(
                subject="Phản hồi từ Smart Travel",
                message=f"Chào {contact.name},\n\n{reply_content}",
                from_email=None, 
                recipient_list=[contact.email],
                fail_silently=False,
            )
            return JsonResponse({'status': 'success'})
        except Exception as e:
            # In lỗi ra console để bạn quan sát
            print(f"Lỗi gửi mail: {e}")
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    
    return JsonResponse({'status': 'failed'}, status=400)
# ==============================
# Đăng Nhập & Đăng Ký & Đăng Xuất
# ==============================
def register_view(request):
    if request.method == 'POST':
        form = UserRegisterForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('login')
    else:
        form = UserRegisterForm()
    return render(request, 'account/register.html', {'form': form})

def login_view(request):
    if request.method == 'POST':
        form = UserLoginForm(data=request.POST)
        if form.is_valid():
            user = form.get_user()
            auth_login(request, user)
            return redirect('admin_dashboard' if user.is_staff else 'home') 
    else:
        form = UserLoginForm()
    return render(request, 'account/login.html', {'form': form})

def logout_view(request):
    logout(request)
    return redirect("home")

# ==============================
# API cho địa điểm & review
# ==============================
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
def tours_list(request):
    tours = Tour.objects.all()
    booked_tours = []
    has_booked_tour = False

    if request.user.is_authenticated:
        booked_tours = TourBooking.objects.filter(user=request.user).select_related('tour').order_by('-booked_at')
        has_booked_tour = TourBooking.objects.filter(user=request.user, status="pending").exists()
    
    return render(request, 'tours.html', {
        'tours': tours,
        'booked_tours': booked_tours,
        'has_booked_tour': has_booked_tour
    })
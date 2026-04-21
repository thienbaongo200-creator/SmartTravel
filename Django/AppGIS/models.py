import math
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.contrib.postgres.fields import ArrayField
from django.db import models
import math

class Category(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class TourismPoint(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    category = models.ForeignKey(Category, on_delete=models.CASCADE, null=True, blank=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="Số điện thoại")
    open_time = models.TimeField(default="09:00")
    close_time = models.TimeField(default="22:00")
    rating = models.FloatField(blank=True, null=True)
    img = models.CharField(max_length=500, blank=True, null=True)
    menu_imgs = models.JSONField(default=list, blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True, verbose_name="Giá từ")

    def __str__(self):
        return self.name

    def distance_from(self, user_lat, user_lng, speed_kmh=40):
        R = 6371
        lat1 = math.radians(user_lat)
        lon1 = math.radians(user_lng)
        lat2 = math.radians(self.latitude)
        lon2 = math.radians(self.longitude)

        dlat = lat2 - lat1
        dlon = lon2 - lon1

        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

        distance_km = R * c
        time_minutes = (distance_km / speed_kmh) * 60

        return {
            "distance_km": round(distance_km, 2),
            "time_minutes": round(time_minutes, 1)
        }

    def is_open_now(self):
        """Kiểm tra trạng thái mở cửa theo giờ thực tế"""
        now = timezone.localtime().time()
        return self.open_time <= now <= self.close_time


class Review(models.Model):
    tourismpoint = models.ForeignKey(TourismPoint, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    comment = models.TextField()
    rating = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "AppGIS_review"

    def __str__(self):
        return f"{self.user.username} - {self.tourismpoint.name}"


class Tour(models.Model):
    title = models.CharField(max_length=200)
    short_intro = models.CharField(max_length=300, blank=True)  # Giới thiệu ngắn
    description = models.TextField(blank=True)                  # Mô tả chi tiết
    price = models.DecimalField(max_digits=12, decimal_places=0)
    duration = models.CharField(max_length=100, blank=True)
    tag = models.CharField(max_length=100, blank=True)
    image = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    images = ArrayField(models.CharField(max_length=255), size=6, blank=True, null=True)  # tối đa 6 ảnh phụ
    
    def __str__(self):
        return self.title


class TourBooking(models.Model):
    tour = models.ForeignKey(Tour, on_delete=models.CASCADE, related_name="bookings")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    guests = models.PositiveIntegerField(default=1)
    start_date = models.DateField(null=True, blank=True)
    total_price = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True)
    phone = models.CharField(max_length=15, null=True, blank=True)
    booked_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=[("pending", "Chờ xác nhận"), ("confirmed", "Đã xác nhận"), ("cancelled", "Đã hủy")],
        default="pending"
    )

    def __str__(self):
        return f"{self.user.username} - {self.tour.title} ({self.status})"


class ContactMessage(models.Model):
    name = models.CharField(max_length=255, verbose_name="Tên người gửi")
    email = models.EmailField(verbose_name="Email")
    message = models.TextField(verbose_name="Nội dung tin nhắn")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Ngày gửi")
    class Meta:
        ordering = ['-created_at']
    def __str__(self):
        return f"{self.name} - {self.email}"
class Event(models.Model):
    title = models.CharField(max_length=200)
    location = models.CharField(max_length=255, null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    
    # Tọa độ để hiển thị trên bản đồ
    lat = models.FloatField(null=True, blank=True, verbose_name="Vĩ độ")
    lng = models.FloatField(null=True, blank=True, verbose_name="Kinh độ")
    
    # THÊM MỚI: Thể loại (Lễ hội, Văn hóa, Âm nhạc...)
    category = models.CharField(max_length=100, default="Văn hóa")
    
    # THÊM MỚI: Trạng thái (Sắp diễn ra, Đang diễn ra...) - Admin chọn thủ công
    STATUS_CHOICES = [
        ('Sắp diễn ra', 'Sắp diễn ra'),
        ('Đang diễn ra', 'Đang diễn ra'),
        ('Tạm hoãn', 'Tạm hoãn'),
        ('Đã kết thúc', 'Đã kết thúc'),
    ]
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="Sắp diễn ra")

    def __str__(self):
        return self.title

    @property
    def status_class(self):
        """Hàm trả về class CSS tương ứng với trạng thái để đổi màu bên giao diện"""
        status_map = {
            'Đang diễn ra': 'bg-danger text-white',
            'Sắp diễn ra': 'bg-info text-dark',
            'Tạm hoãn': 'bg-warning text-dark',
            'Đã kết thúc': 'bg-secondary text-white',
        }
        return status_map.get(self.status, 'bg-info text-dark')

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.end_date and self.end_date < self.start_date:
            raise ValidationError("Ngày kết thúc không thể trước ngày bắt đầu.")
        # Nếu start_date là hôm nay, end_date không thể trong quá khứ
        from datetime import date
        today = date.today()
        if self.start_date == today and self.end_date and self.end_date < today:
            raise ValidationError("Nếu sự kiện bắt đầu hôm nay, ngày kết thúc không thể trong quá khứ.")
class EventImage(models.Model):
    event = models.ForeignKey(Event, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(upload_to='events/gallery/')

class AboutContent(models.Model):
    title = models.CharField(max_length=200, default="Về Hệ Thống Web GIS Thông Minh")
    subtitle = models.CharField(max_length=300, default="Kiến tạo nền tảng số dựa trên dữ liệu không gian")
    description = models.TextField(default="Chúng tôi cung cấp giải pháp bản đồ tương tác hiện đại, giúp biến dữ liệu địa lý phức tạp thành những thông tin trực quan, dễ tiếp cận cho mọi người.")
    vision_title = models.CharField(max_length=100, default="Tầm nhìn")
    vision_text = models.TextField(default="Trở thành nền tảng bản đồ số hàng đầu, hỗ trợ đắc lực trong việc tra cứu thông tin địa lý và ra quyết định dựa trên dữ liệu.")
    mission_title = models.CharField(max_length=100, default="Sứ mệnh")
    mission_text = models.TextField(default="Số hóa dữ liệu hạ tầng và du lịch nhằm minh bạch hóa thông tin, giúp người dùng tối ưu hóa lộ trình di chuyển.")
    values_title = models.CharField(max_length=100, default="Giá trị cốt lõi")
    values_text = models.TextField(default="Dữ liệu chính xác - Công nghệ tiên tiến - Trải nghiệm người dùng mượt mà trên mọi thiết bị.")
    stats_data_points = models.CharField(max_length=50, default="1,000+")
    stats_data_label = models.CharField(max_length=100, default="Điểm dữ liệu địa lý")
    stats_accuracy = models.CharField(max_length=50, default="99.9%")
    stats_accuracy_label = models.CharField(max_length=100, default="Độ chính xác tọa độ")
    stats_response_time = models.CharField(max_length=50, default="0.5s")
    stats_response_label = models.CharField(max_length=100, default="Tốc độ phản hồi")
    workflow_title = models.CharField(max_length=200, default="Hệ Thống Hoạt Động Thế Nào?")
    step1_title = models.CharField(max_length=100, default="Thu thập")
    step1_text = models.TextField(default="Dữ liệu được tích hợp từ các nguồn tin cậy và tệp tin GeoJSON chuẩn.")
    step2_title = models.CharField(max_length=100, default="Xử lý")
    step2_text = models.TextField(default="GeoPandas & Django thực hiện các thuật toán phân tích không gian phức tạp.")
    step3_title = models.CharField(max_length=100, default="Hiển thị")
    step3_text = models.TextField(default="Folium trực quan hóa kết quả lên bản đồ nền tương tác sinh động.")
    tech_title = models.CharField(max_length=200, default="Nền Tảng Công Nghệ")
    tech1_name = models.CharField(max_length=100, default="Folium & Leaflet")
    tech1_desc = models.CharField(max_length=200, default="Hiển thị bản đồ tương tác")
    tech2_name = models.CharField(max_length=100, default="GeoPandas")
    tech2_desc = models.CharField(max_length=200, default="Phân tích dữ liệu GIS")
    tech3_name = models.CharField(max_length=100, default="GeoPy & PyProj")
    tech3_desc = models.CharField(max_length=200, default="Xử lý tọa độ & Khoảng cách")
    tech4_name = models.CharField(max_length=100, default="Django 6.0")
    tech4_desc = models.CharField(max_length=200, default="Backend Framework")
    cta_text = models.TextField(default="Sẵn sàng khám phá những địa điểm thú vị?")
    cta_button = models.CharField(max_length=100, default="KHÁM PHÁ BẢN ĐỒ NGAY")

    class Meta:
        verbose_name = "Nội dung trang About"
        verbose_name_plural = "Nội dung trang About"

    def __str__(self):
        return "Nội dung trang About"
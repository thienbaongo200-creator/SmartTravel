from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
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
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=0)
    duration = models.CharField(max_length=100, blank=True)
    tag = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

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
    
    # THÊM MỚI: Thể loại (Lễ hội, Văn hóa, Âm nhạc...)
    category = models.CharField(max_length=100, default="Văn hóa")
    
    # THÊM MỚI: Trạng thái (Sắp diễn ra, Đang diễn ra...)
    status = models.CharField(max_length=50, default="Sắp diễn ra")

    def __str__(self):
        return self.title

    @property
    def status_class(self):
        """Hàm tự động trả về class CSS tương ứng với trạng thái để đổi màu bên giao diện"""
        status_map = {
            'Đang diễn ra': 'badge-danger',
            'Sắp diễn ra': 'badge-info',
            'Tạm hoãn': 'badge-warning',
            'Đã kết thúc': 'badge-secondary',
        }
        return status_map.get(self.status, 'badge-info')
    @property
    def status_info(self):
        today = date.today()
        if self.end_date and self.end_date < today:
            return {"text": "Đã kết thúc", "class": "badge-secondary"}
        
        if self.start_date:
            diff = (self.start_date - today).days
            if diff < 0: return {"text": "Đang diễn ra", "class": "badge-danger"}
            if diff == 0: return {"text": "Bắt đầu hôm nay", "class": "badge-danger"}
            if diff == 1: return {"text": "Ngày mai diễn ra", "class": "badge-warning"}
            return {"text": f"Còn {diff} ngày", "class": "badge-info"}
            
        return {"text": "Chưa xếp lịch", "class": "badge-dark"}
class EventImage(models.Model):
    event = models.ForeignKey(Event, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(upload_to='events/gallery/')
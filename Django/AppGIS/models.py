from django.db import models
import math
from django.contrib.auth.models import User

class Category(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

class TourismPoint(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    category = models.ForeignKey(Category, on_delete=models.CASCADE, null=True, blank=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    open_hours = models.CharField(max_length=100, blank=True, null=True)
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


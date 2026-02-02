from django.db import models
import math

class TodoItem(models.Model):
    title = models.CharField(max_length=200)
    completed = models.BooleanField(default=False)

    def __str__(self): 
        return self.title 
    

class TourismPoint(models.Model): 
    name = models.CharField(max_length=200) 
    description = models.TextField(blank=True) 
    latitude = models.FloatField() 
    longitude = models.FloatField() 
    type = models.CharField(max_length=100, blank=True) 
    address = models.CharField(max_length=255, blank=True, null=True) 
    open_hours = models.CharField(max_length=100, blank=True, null=True) 
    rating = models.FloatField(blank=True, null=True) 
    img = models.URLField(blank=True, null=True)
    
    def __str__(self): 
        return self.name

    def distance_from(self, user_lat, user_lng, speed_kmh=40):
        """
        user_lat, user_lng: tọa độ người dùng
        speed_kmh: tốc độ trung bình (km/h), mặc định 40 km/h
        """
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
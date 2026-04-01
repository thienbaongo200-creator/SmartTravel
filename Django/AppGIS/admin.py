from django.contrib import admin
from .models import TourismPoint, Tour, TourBooking

@admin.register(TourismPoint)
class TourismPointAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'latitude', 'longitude', 'rating', 'address')
    
    search_fields = ('name', 'address', 'category__name')
    
    list_filter = ('category', 'rating')
    
    list_editable = ('rating',)

@admin.register(Tour)
class TourAdmin(admin.ModelAdmin):
    list_display = ("title", "price", "duration", "tag", "created_at")
    search_fields = ("title", "tag")
    
@admin.register(TourBooking)
class TourBookingAdmin(admin.ModelAdmin):
    list_display = ("tour", "user", "status", "booked_at")
    list_filter = ("status", "booked_at")
    search_fields = ("tour__title", "user__username")
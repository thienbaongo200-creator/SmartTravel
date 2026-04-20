from django.contrib import admin
from .models import TourismPoint, Tour, TourBooking, Event, EventImage

@admin.register(TourismPoint)
class TourismPointAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'description' ,'latitude', 'longitude', 'rating', 'address')
    
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

class EventImageInline(admin.TabularInline):
    model = EventImage
    extra = 1

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "status", "start_date", "end_date", "location")
    list_filter = ("status", "category", "start_date")
    search_fields = ("title", "location")
    list_editable = ("status",)
    inlines = [EventImageInline]

@admin.register(EventImage)
class EventImageAdmin(admin.ModelAdmin):
    list_display = ("event", "image")
    search_fields = ("event__title",)
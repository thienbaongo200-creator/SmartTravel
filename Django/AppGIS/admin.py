from django.contrib import admin
from .models import TourismPoint, Tour, TourBooking, Event, EventImage
from .forms import EventImageForm, TourismPointForm

@admin.register(TourismPoint)
class TourismPointAdmin(admin.ModelAdmin):
    form = TourismPointForm
    list_display = ('name', 'category', 'description' ,'latitude', 'longitude', 'rating', 'address')
    
    search_fields = ('name', 'address', 'category__name')
    
    list_filter = ('category', 'rating')
    
    list_editable = ('rating',)
    
    readonly_fields = ('image_preview',)
    
    fieldsets = (
        ('Thông tin cơ bản', {
            'fields': ('name', 'description', 'category', 'address', 'phone')
        }),
        ('Vị trí', {
            'fields': ('latitude', 'longitude')
        }),
        ('Thời gian', {
            'fields': ('open_time', 'close_time')
        }),
        ('Đánh giá và giá', {
            'fields': ('rating', 'price')
        }),
        ('Hình ảnh', {
            'fields': ('img', 'menu_imgs', 'image_preview')
        }),
    )

    def response_change(self, request, obj):
        """
        Sau khi save, redirect về change list.
        """
        from django.shortcuts import redirect
        from django.urls import reverse
        return redirect(reverse('admin:AppGIS_tourismpoint_changelist'))

@admin.register(Tour)
class TourAdmin(admin.ModelAdmin):
    list_display = ("title", "price", "duration", "tag", "created_at")
    search_fields = ("title", "tag")

    def response_change(self, request, obj):
        """
        Sau khi save, redirect về change list.
        """
        from django.shortcuts import redirect
        from django.urls import reverse
        return redirect(reverse('admin:AppGIS_tour_changelist'))
    
@admin.register(TourBooking)
class TourBookingAdmin(admin.ModelAdmin):
    list_display = ("tour", "user", "status", "booked_at")
    list_filter = ("status", "booked_at")
    search_fields = ("tour__title", "user__username")

    def response_change(self, request, obj):
        """
        Sau khi save, redirect về change list.
        """
        from django.shortcuts import redirect
        from django.urls import reverse
        return redirect(reverse('admin:AppGIS_tourbooking_changelist'))

class EventImageInline(admin.TabularInline):
    model = EventImage
    extra = 1
    form = EventImageForm
    readonly_fields = ('image_preview',)

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "status", "start_date", "end_date", "location")
    list_filter = ("status", "category", "start_date")
    search_fields = ("title", "location")
    list_editable = ("status",)
    inlines = [EventImageInline]

    def response_change(self, request, obj):
        """
        Sau khi save, redirect về change list.
        """
        from django.shortcuts import redirect
        from django.urls import reverse
        return redirect(reverse('admin:AppGIS_event_changelist'))

@admin.register(EventImage)
class EventImageAdmin(admin.ModelAdmin):
    list_display = ("event", "image")
    search_fields = ("event__title",)
from django.contrib import admin
from .models import TourismPoint

@admin.register(TourismPoint)
class TourismPointAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'latitude', 'longitude', 'rating', 'address')
    
    search_fields = ('name', 'address', 'category__name')
    
    list_filter = ('category', 'rating')
    
    list_editable = ('rating',)

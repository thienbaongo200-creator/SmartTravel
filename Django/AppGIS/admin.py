from django.contrib import admin
from .models import TodoItem, TourismPoint

@admin.register(TourismPoint)
class TourismPointAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'latitude', 'longitude', 'rating', 'address')
    
    search_fields = ('name', 'address', 'type')
    
    list_filter = ('type', 'rating')
    
    list_editable = ('rating',)
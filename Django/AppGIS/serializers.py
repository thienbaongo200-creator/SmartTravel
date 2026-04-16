from rest_framework import serializers
from .models import TourBooking, Category, TourismPoint

class TourBookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TourBooking
        fields = "__all__"

class TourismPointSerializer(serializers.ModelSerializer):
    # Lấy tên category thay vì ID để hiển thị đẹp hơn
    category = serializers.SlugRelatedField(
        slug_field='name', 
        queryset=Category.objects.all(),
        allow_null=True,
        required=False
    )

    class Meta:
        model = TourismPoint
        # Liệt kê đầy đủ để chắc chắn description xuất hiện trong JSON
        fields = [
            'id', 'name', 'description', 'latitude', 'longitude', 
            'category', 'address', 'price', 'img', 'gallery', 'rating'
        ]
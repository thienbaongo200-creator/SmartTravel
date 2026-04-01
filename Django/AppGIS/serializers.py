from rest_framework import serializers
from .models import TourBooking

class TourBookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TourBooking
        fields = "__all__"

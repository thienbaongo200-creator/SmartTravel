from django.conf import settings
from django.urls import path
from django.conf.urls.static import static
from . import views

urlpatterns = [
    # Trang chính
    path("", views.index, name="home"),
    path("about/", views.about, name="about"),
    path("destinations/", views.destinations, name="destinations"),
    path("events/", views.events, name="events"),
    path("services/", views.services, name="services"),

    # Dịch vụ chi tiết
    path("hotels/", views.hotels_list, name="hotels"),
    path("restaurants/", views.restaurants_list, name="restaurants"),
    path("tours/", views.tour_list, name="tours"),
    path("transport/", views.transport_list, name="transport"),

    # Liên hệ
    path("contact/", views.contact, name="contact"),
    path("contact_success/", views.contact_success, name="contact_success"),

    # Tool WebGIS
    path("search/", views.search, name="search"),
    path("distance/", views.distance, name="distance"),
    path("distance/<int:point_id>/", views.get_distance, name="get_distance"),
] 
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
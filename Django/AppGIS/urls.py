from django.conf import settings
from django.conf.urls.static import static
from django.urls import path
from . import views

urlpatterns = [
    # Trang chính
    path("", views.index, name="home"),
    path("about/", views.about, name="about"),
    path("destinations/", views.destinations, name="destinations"),
    path("events/", views.events, name="events"),
    path("services/", views.services, name="services"),

    # Đăng nhập / Đăng ký
    path("login/", views.login_view, name="login"),
    path("register/", views.register_view, name="register"),
    path("logout/", views.logout_view, name="logout"),

    # Dịch vụ chi tiết
    path("hotels/", views.hotels_list, name="hotels"),
    path("restaurants/", views.restaurants_list, name="restaurants"),
    path("transport/", views.transport_list, name="transport"),

    # Tour du lịch
    path("tours/", views.tours_list, name="tours_list"),
    path("tours/<int:tour_id>/book/", views.book_tour, name="book_tour"),
    path("booking_success/", views.booking_success, name="booking_success"),
    
    # Liên hệ
    path("contact/", views.contact, name="contact"),
    path("contact_success/", views.contact_success, name="contact_success"),

    # Tool WebGIS
    path("search/", views.search, name="search"),
    path("distance/", views.distance, name="distance"),
    path("distance/<int:point_id>/", views.get_distance, name="get_distance"),
    path("nearby_places/", views.nearby_places, name="nearby_places"),
    path("review/<int:point_id>/", views.submit_review, name="submit_review"),
    
    # Admin giao diện
    path("admin/", views.admin_dashboard, name="admin_dashboard"),
    path("admin_places/", views.admin_places, name="admin_places"),
    path("admin_user/", views.admin_user, name="admin_user"),
    path("admin/tour-booking/", views.admin_tour_booking, name="admin_tour_booking"),
    path("admin/contacts/", views.admin_contacts, name="admin_contacts"),
    
    # API cho địa điểm
    path("api/places/", views.get_places_by_category, name="api_places"),
    path("api/admin/places/", views.api_places, name="api_admin_places"),
    path("api/admin/places/<int:pk>/", views.api_place_detail, name="api_place_detail"),
    
    # API cho user
    path("api/admin/users/", views.api_users, name="api_admin_users"),
    path("api/admin/users/<int:pk>/", views.api_user_detail, name="api_admin_user_detail"),
    path("api/reviews/<int:place_id>/", views.get_reviews, name="get_reviews"),

    # API cho booking
    path("api/bookings/<int:pk>/", views.api_booking_detail, name="api_booking_detail"),
    path('tours/cancel/<int:booking_id>/', views.cancel_booking, name='cancel_booking'),
    path('book-tour/<int:tour_id>/', views.book_tour, name='book_tour'),
]

# Chỉ thêm static khi DEBUG = True
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

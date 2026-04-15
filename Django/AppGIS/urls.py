from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, re_path
from . import views
from django.views.defaults import page_not_found
from django.urls import re_path
from django.shortcuts import render
from django.contrib.auth import views as auth_views
def custom_404_test_view(request, exception=None):
    return render(request, '404.html', status=404)
urlpatterns = [
    # Trang chính
    path("", views.index, name="home"),
    path("about/", views.about, name="about"),
    path("destinations/", views.destinations, name="destinations"),
    path("events/", views.events, name="events"),
    path("services/", views.services, name="services"),

    # Đăng nhập / Đăng ký
    path("login/", views.login_view, name="login"),
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

    path('admin-panel/tours/', views.admin_tours, name='admin_tours'),
    path('api/admin/tours/', views.api_tours, name='api_tours'),
    path('api/admin/tours/<int:tour_id>/', views.api_tours, name='api_tours_detail'),
    path('api/admin/contacts/<int:pk>/delete/', views.delete_contact, name='api_delete_contact'),
    path('api/admin/contacts/<int:pk>/reply/', views.reply_contact, name='api_reply_contact'),
    path("", views.index, name="home"),

    path('password-reset/', auth_views.PasswordResetView.as_view(template_name='registration/password_reset_form.html', html_email_template_name='registration/password_reset_email.html'), name='password_reset'),
    path('password-reset/done/', auth_views.PasswordResetDoneView.as_view(template_name='registration/password_reset_done.html'), name='password_reset_done'),
    path('password-reset-confirm/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(template_name='registration/password_reset_confirm.html'), name='password_reset_confirm'),
    path('password-reset-complete/', auth_views.PasswordResetCompleteView.as_view(template_name='registration/password_reset_complete.html'), name='password_reset_complete'),
    path('register/', views.register, name='register'),
    path('activate/<uidb64>/<token>/', views.activate, name='activate'),
]
handler403 = 'AppGIS.views.error_403_view'
# Chỉ thêm static khi DEBUG = True
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += [
        path('test-404/', views.error_404_view, {'exception': Exception("Test 404")}),
        path('test-403/', views.error_403_view, {'exception': Exception("Test 403")}),
    ]
    urlpatterns += [
        re_path(r'^(?!(media|static)/).*$', views.error_404_view),
    ]
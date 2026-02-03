from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="home"),
    path("about/", views.about, name="about"),
    path("destinations/", views.destinations, name="destinations"),
    path("contact/", views.contact, name="contact"),
    path("events/", views.events, name="events"),
    path("services/", views.services, name="services"),
    path("hotels/", views.hotels_list, name="hotels"),

    # Tool WebGIS
    path("search/", views.search, name="search"),
    path("distance/", views.distance, name="distance"),
    path("distance/<int:point_id>/", views.get_distance, name="get_distance"),
]
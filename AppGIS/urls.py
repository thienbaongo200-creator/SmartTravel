from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='home'), 
    path('about/', views.about, name='about'),
    path('destinations/', views.destinations, name='destinations'),
    path('events/', views.events, name='events'),
    path('services/', views.services, name='services'),
    path('contact/', views.contact, name='contact'),

    #Tool WebGIS
    path('search/', views.search, name='search'),
    path('distance/', views.distance, name='distance'),
]
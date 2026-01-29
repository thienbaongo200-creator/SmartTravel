from django.shortcuts import render, HttpResponse
from .models import TodoItem

# Create your views here.
def index(requets):
    return render(requets, 'home.html')
def about(requets):
    return render(requets, 'about.html')
def destination(requets):
    return render(requets, 'destination.html')
def events(request):
    return render(request, 'events.html')
def services(request):
    return render(request, 'services.html')
def contact(request):
    return render(request, 'contact.html')

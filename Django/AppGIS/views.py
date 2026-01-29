from django.shortcuts import render, HttpResponse

# Create your views here.
def index(request):
    return render(request, 'home.html')

def about(request):
    return render(request, 'about.html')

def destinations(request):
    return render(request, 'destinations.html')

def events(request):
    return render(request, 'events.html')

def services(request):
    return render(request, 'services.html')

def contact(request):
    return render(request, 'contact.html')
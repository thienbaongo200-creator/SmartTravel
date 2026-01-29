from django.shortcuts import render, HttpResponse

# Create your views here.
def home(requets):
    return HttpResponse("Hello world")


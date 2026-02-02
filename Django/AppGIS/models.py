from django.db import models

# Create your models here.
class TodoItem(models.Model):
    title = models.CharField(max_length=200)
    completed = models.BooleanField(default=False)

    def __str__(self): 
        return self.title 
    
class TourismPoint(models.Model): 
    name = models.CharField(max_length=200) 
    description = models.TextField(blank=True) 
    latitude = models.FloatField() 
    longitude = models.FloatField() 
    type = models.CharField(max_length=100, blank=True) 
    address = models.CharField(max_length=255, blank=True, null=True) 
    open_hours = models.CharField(max_length=100, blank=True, null=True) 
    rating = models.FloatField(blank=True, null=True) 
    img = models.URLField(blank=True, null=True)
    
    def __str__(self): 
        return self.name
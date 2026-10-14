from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'ecus', views.ECUViewSet, basename='ecu')
router.register(r'categories', views.CategoryViewSet, basename='category')
router.register(r'subcategories', views.SubCategoryViewSet, basename='subcategory')
router.register(r'testbenches', views.TestBenchViewSet, basename='testbench')
router.register(r'notifications', views.NotificationViewSet, basename='notification')
router.register(r'transfer-requests', views.TransferRequestViewSet, basename='transferrequest')
router.register(r'projects', views.ProjectViewSet, basename='project')

urlpatterns = [
    path('', include(router.urls)),
    path('import-excel/', views.import_excel, name='import-excel'),
    path('auth/login/', views.login_view, name='login'),
    path('auth/logout/', views.logout_view, name='logout'),
    path('auth/me/', views.me_view, name='me'),
    path('stats/', views.stats_view, name='stats'),
    path('ecus/<int:pk>/qr-code/', views.get_qr_code, name='qr-code'),
    path('ecus/bulk-delete/', views.bulk_delete_ecus, name='bulk-delete'),
]

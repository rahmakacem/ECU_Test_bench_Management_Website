from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'ecus', views.ECUViewSet)
router.register(r'categories', views.CategoryViewSet)
router.register(r'subcategories', views.SubCategoryViewSet)
router.register(r'testbenches', views.TestBenchViewSet)
router.register(r'notifications', views.NotificationViewSet, basename='notification')
router.register(r'transfer-requests', views.TransferRequestViewSet)
router.register(r'booking-requests', views.BookingRequestViewSet, basename='bookingrequest')
router.register(r'projects', views.ProjectViewSet, basename='projects')
router.register(r'suppliers', views.SupplierViewSet, basename='supplier')
router.register(r'locations', views.LocationViewSet, basename='location')
router.register(r'rooms', views.RoomViewSet, basename='room')
router.register(r'teams', views.TeamViewSet, basename='team')
router.register(r'domains', views.DomainViewSet, basename='domain')
router.register(r'activities', views.ActivityViewSet, basename='activity')

urlpatterns = [
    path('auth/login/', views.login_view),
    path('auth/logout/', views.logout_view),
    path('auth/me/', views.current_user),
    path('auth/csrf/', views.get_csrf_token),
    path('import-excel/', views.import_excel),
    path('dashboard/stats/', views.dashboard_stats),
    path('locations/', views.location_list),
    path('chat/', views.chat_view, name='chat'),
    path('', include(router.urls)),
]
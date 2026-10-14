import axios from 'axios';

const BASE_URL = 'http://localhost:8001/api';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to log requests and ensure CSRF token
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    console.log('Request headers:', config.headers);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to log errors
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.data);
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

// ── CSRF ──
export const setupCsrf = async (): Promise<void> => {
  try {
    const response = await api.get('/auth/csrf/');
    const csrfToken = response.data.csrfToken;
    if (csrfToken) {
      api.defaults.headers.common['X-CSRFToken'] = csrfToken;
      localStorage.setItem('csrfToken', csrfToken);
      console.log('✅ CSRF token set in axios defaults:', csrfToken);
    } else {
      console.warn('⚠️ No CSRF token in response');
    }
  } catch (error) {
    console.error('❌ Failed to fetch CSRF token:', error);
  }
};

export const refreshCsrfToken = async (): Promise<void> => {
  try {
    console.log('🔄 Manually refreshing CSRF token...');
    const response = await api.get('/auth/csrf/');
    const csrfToken = response.data.csrfToken;
    if (csrfToken) {
      api.defaults.headers.common['X-CSRFToken'] = csrfToken;
      localStorage.setItem('csrfToken', csrfToken);
      console.log('✅ CSRF token refreshed:', csrfToken);
    } else {
      console.warn('⚠️ No CSRF token in response');
    }
  } catch (error) {
    console.error('❌ Failed to refresh CSRF token:', error);
  }
};

// Initialize CSRF token from localStorage on app load
const initializeCsrf = () => {
  const storedToken = localStorage.getItem('csrfToken');
  if (storedToken) {
    api.defaults.headers.common['X-CSRFToken'] = storedToken;
    console.log('✅ CSRF token loaded from localStorage on init:', storedToken);
  } else {
    console.log('⚠️ No CSRF token found in localStorage on init');
  }
};

// Call it immediately
initializeCsrf();

// ── ECUs ──
export const getECUs = (params?: Record<string, string>) =>
  api.get('/ecus/', { params });

export const createECU = (data: Record<string, unknown>) =>
  api.post('/ecus/', data);

export const updateECU = (id: string | number, data: Record<string, unknown>) =>
  api.patch(`/ecus/${id}/`, data);

export const deleteECU = (id: string | number) =>
  api.delete(`/ecus/${id}/`);

export const bulkDeleteECUs = (ids: (string | number)[]) =>
  api.post('/ecus/bulk-delete/', { ecu_ids: ids.map(Number) });

export const getECUQRCode = (id: string | number) =>
  api.get(`/ecus/${id}/qr-code/`);

export const getECUHistory = (ecuId?: string | number) =>
  api.get('/ecus/history/', ecuId ? { params: { ecu_id: ecuId } } : {});

// ── Excel Import ──
export const importExcelRows = (rows: Record<string, unknown>[], project: string, category: string) =>
  api.post('/import-excel/', { rows, project, category });

// ── Categories ──
export const getCategories = () => api.get('/categories/');
export const createCategory = (data: { name: string }) => api.post('/categories/', data);
export const deleteCategory = (id: number) => api.delete(`/categories/${id}/`);

// ── SubCategories ──
export const getSubCategories = (params?: { category?: number; project?: string; is_custom?: boolean }) =>
  api.get('/subcategories/', { params });
export const createSubCategory = (data: { name: string; category: number; project?: string; icon_name?: string; color?: string; is_custom?: boolean }) =>
  api.post('/subcategories/', data);
export const deleteSubCategory = (id: number) => api.delete(`/subcategories/${id}/`);

// ── TestBenches ──
export const getTestBenches = () => api.get('/testbenches/');

// ── Transfer Requests ──
export const getTransferRequests = () => api.get('/transfer-requests/');
export const createTransferRequest = (data: Record<string, unknown>) =>
  api.post('/transfer-requests/', data);
export const approveTransferRequest = (id: number, notes?: string) =>
  api.post(`/transfer-requests/${id}/approve/`, { review_notes: notes });
export const declineTransferRequest = (id: number, notes?: string) =>
  api.post(`/transfer-requests/${id}/decline/`, { review_notes: notes });

export const confirmTransferArrival = (id: number) =>
  api.post(`/transfer-requests/${id}/confirm/`);

// ── Notifications ──
export const getNotifications = (userId?: number) =>
  api.get('/notifications/', userId ? { params: { user_id: userId } } : {});
export const markAllNotificationsRead = (userId?: number) =>
  api.post('/notifications/mark-all-read/', { user_id: userId });

// ── Auth ──
export const loginUser = async (username: string, password: string) => {
  try {
    // First, get a fresh CSRF token
    console.log('🔐 Fetching CSRF token...');
    await setupCsrf();
    
    console.log('🔐 Attempting login...');
    const response = await api.post('/auth/login/', { username, password });
    console.log('Login response:', response.data);
    
    if (response.data.success) {
      // Store user data in localStorage
      if (response.data.user) {
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('user', JSON.stringify(response.data.user));
        console.log('✅ User stored in localStorage:', response.data.user);
      }
      
      // IMPORTANT: Get a fresh CSRF token after login (the token changes after authentication)
      console.log('🔐 Fetching fresh CSRF token after login...');
      await setupCsrf();
      
      // Verify the token is set
      console.log('✅ CSRF token in axios defaults after login:', api.defaults.headers.common['X-CSRFToken']);
      
      console.log('✅ Login successful, session and CSRF token set');
      return response;
    }
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    const response = await api.post('/auth/logout/');
    // Clear localStorage on logout
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user');
    localStorage.removeItem('csrfToken');
    // Clear CSRF header
    delete api.defaults.headers.common['X-CSRFToken'];
    console.log('✅ User logged out, localStorage cleared');
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await api.get('/auth/me/');
    return response;
  } catch (error) {
    console.error('Failed to fetch current user:', error);
    throw error;
  }
};

// ── Dashboard ──
export const getDashboardStats = () => api.get('/dashboard/stats/');
export const getLocations = () => api.get('/locations/');

// ── Booking Requests ──
export const getAvailableTimeSlots = (testbenchId: number, date: string) =>
  api.get('/booking-requests/available_slots/', { params: { testbench_id: testbenchId, date } });

export const createBookingRequest = async (data: Record<string, unknown>) => {
  console.log('Creating booking request with data:', data);
  try {
    // Ensure we have a valid CSRF token before making the request
    const storedToken = localStorage.getItem('csrfToken');
    if (storedToken) {
      api.defaults.headers.common['X-CSRFToken'] = storedToken;
      console.log('✅ Using stored CSRF token:', storedToken);
    } else {
      console.log('🔄 No stored CSRF token, fetching new one...');
      await setupCsrf();
    }
    
    const response = await api.post('/booking-requests/', data);
    console.log('Booking request created:', response.data);
    return response;
  } catch (error: any) {
    console.error('Failed to create booking request:', error);
    // If CSRF error, try to refresh token and retry once
    if (error.response?.status === 403 && error.response?.data?.detail?.includes('CSRF')) {
      console.log('🔄 CSRF error, refreshing token and retrying...');
      await setupCsrf();
      try {
        const retryResponse = await api.post('/booking-requests/', data);
        console.log('Booking request created on retry:', retryResponse.data);
        return retryResponse;
      } catch (retryError) {
        console.error('Retry failed:', retryError);
        throw retryError;
      }
    }
    throw error;
  }
};

export const approveBookingRequest = async (id: number, reason?: string) => {
  console.log(`Approving booking request ${id} with reason:`, reason);
  try {
    // Ensure CSRF token is set
    const storedToken = localStorage.getItem('csrfToken');
    if (storedToken) {
      api.defaults.headers.common['X-CSRFToken'] = storedToken;
      console.log('✅ Using stored CSRF token for approve:', storedToken);
    } else {
      console.log('🔄 No stored CSRF token, fetching new one...');
      await setupCsrf();
    }
    
    const response = await api.post(`/booking-requests/${id}/approve/`, { reason });
    console.log('Booking request approved:', response.data);
    return response;
  } catch (error: any) {
    console.error('Failed to approve booking request:', error);
    if (error.response?.status === 403 && error.response?.data?.detail?.includes('CSRF')) {
      console.log('🔄 CSRF error, refreshing token and retrying...');
      await setupCsrf();
      try {
        const retryResponse = await api.post(`/booking-requests/${id}/approve/`, { reason });
        console.log('Booking request approved on retry:', retryResponse.data);
        return retryResponse;
      } catch (retryError) {
        console.error('Retry failed:', retryError);
        throw retryError;
      }
    }
    throw error;
  }
};

export const declineBookingRequest = async (id: number, reason: string) => {
  console.log(`Declining booking request ${id} with reason:`, reason);
  try {
    // Ensure CSRF token is set
    const storedToken = localStorage.getItem('csrfToken');
    if (storedToken) {
      api.defaults.headers.common['X-CSRFToken'] = storedToken;
      console.log('✅ Using stored CSRF token for decline:', storedToken);
    } else {
      console.log('🔄 No stored CSRF token, fetching new one...');
      await setupCsrf();
    }
    
    const response = await api.post(`/booking-requests/${id}/decline/`, { reason });
    console.log('Booking request declined:', response.data);
    return response;
  } catch (error: any) {
    console.error('Failed to decline booking request:', error);
    if (error.response?.status === 403 && error.response?.data?.detail?.includes('CSRF')) {
      console.log('🔄 CSRF error, refreshing token and retrying...');
      await setupCsrf();
      try {
        const retryResponse = await api.post(`/booking-requests/${id}/decline/`, { reason });
        console.log('Booking request declined on retry:', retryResponse.data);
        return retryResponse;
      } catch (retryError) {
        console.error('Retry failed:', retryError);
        throw retryError;
      }
    }
    throw error;
  }
};

export const getBookingRequests = (params?: Record<string, string>) =>
  api.get('/booking-requests/', { params });

export const updateBookingRequest = (id: number, data: Record<string, unknown>) =>
  api.patch(`/booking-requests/${id}/`, data);

export const deleteBookingRequest = async (id: number) => {
  console.log(`Deleting booking request ${id}`);
  try {
    // Ensure CSRF token is set in axios defaults
    const currentToken = api.defaults.headers.common['X-CSRFToken'];
    const storedToken = localStorage.getItem('csrfToken');
    
    if (!currentToken && storedToken) {
      // Restore token to axios defaults
      api.defaults.headers.common['X-CSRFToken'] = storedToken;
      console.log('✅ Restored CSRF token to axios defaults:', storedToken);
    } else if (!currentToken && !storedToken) {
      console.log('🔄 No CSRF token found, fetching new one...');
      await setupCsrf();
    }
    
    console.log('📤 Sending DELETE request with CSRF token:', api.defaults.headers.common['X-CSRFToken']);
    
    const response = await api.delete(`/booking-requests/${id}/`);
    console.log('Booking request deleted:', response.data);
    return response;
  } catch (error: any) {
    console.error('Failed to delete booking request:', error);
    // If CSRF error, try to refresh token and retry once
    if (error.response?.status === 403 && error.response?.data?.detail?.includes('CSRF')) {
      console.log('🔄 CSRF error, refreshing token and retrying...');
      await setupCsrf();
      try {
        const retryResponse = await api.delete(`/booking-requests/${id}/`);
        console.log('Booking request deleted on retry:', retryResponse.data);
        return retryResponse;
      } catch (retryError) {
        console.error('Retry failed:', retryError);
        throw retryError;
      }
    }
    throw error;
  }
};

export const getBookingRequest = (id: number) =>
  api.get(`/booking-requests/${id}/`);

// ── Teams (for BookingModal) ──
export const getTeams = (params?: { project?: string }) =>
  api.get('/teams/', { params });

export const createTeam = (data: { name: string; project: string }) =>
  api.post('/teams/', data);

// ── Domains (for BookingModal) ──
export const getDomains = (params?: { team?: number }) =>
  api.get('/domains/', { params });

export const createDomain = (data: { name: string; team: number }) =>
  api.post('/domains/', data);

// ── Activities (for BookingModal) ──
export const getActivities = (params?: Record<string, string | number | undefined>) =>
  api.get('/activities/', { params });

export const createActivity = (data: { name: string }) =>
  api.post('/activities/', data);

// ── Locations - Additional CRUD operations (getLocations already exists above in Dashboard section)
export const createLocation = (data: { name: string }) =>
  api.post('/locations/', data);

export const deleteLocation = (id: number) =>
  api.delete(`/locations/${id}/`);

// ── Rooms (for EditTestBenchModal / AddTestBenchModal) ──
export const getRooms = () =>
  api.get('/rooms/');

export const createRoom = (data: { name: string }) =>
  api.post('/rooms/', data);

export const deleteRoom = (id: number) =>
  api.delete(`/rooms/${id}/`);

// ── Suppliers (for ReturnToSupplierModal) ──
export const getSuppliers = (params?: { project?: string }) =>
  api.get('/suppliers/', { params });

export const createSupplier = (data: { name: string; country?: string; applicable_projects?: string }) =>
  api.post('/suppliers/', data);

export const deleteSupplier = (id: number) =>
  api.delete(`/suppliers/${id}/`);

export default api;
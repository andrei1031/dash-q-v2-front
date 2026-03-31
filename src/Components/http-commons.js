//export const API_URL = process.env.REACT_APP_API_URL
import axios from 'axios';

export const API_URL = "https://dash-q-v2-back.onrender.com/api";

// Create axios instance with auth interceptor
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Request interceptor - attach token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401/refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try refresh (for guests/non-guests)
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          const guestId = localStorage.getItem('guestId');
          
          let refreshData;
          if (user.is_guest || guestId) {
            // Guest refresh
            refreshData = await apiClient.post('/auth/guest', {
              guestId: guestId,
              nickname: user.nickname
            });
          } else {
            // Non-guest - need username/password stored? Skip for now or prompt
            console.warn('Non-guest refresh not implemented');
            localStorage.clear();
            window.location.href = '/';
            return Promise.reject(error);
          }
          
          // Update token
          localStorage.setItem('token', refreshData.data.token);
          localStorage.setItem('user', JSON.stringify(refreshData.data.user));
          
          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${refreshData.data.token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        localStorage.clear();
        window.location.href = '/';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;


import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor для добавления токена в каждый запрос
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor для обработки ответов и ошибок
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Если сервер ответил 401 (Токен протух или неверный)
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user'); // Очистка стейта контекста AuthContext
      localStorage.removeItem('auth-storage'); // Очистка стейта Zustand
      window.location.href = '/login'; // Жесткий редирект для очистки состояния приложения
    }
    return Promise.reject(error);
  }
);

export default api;

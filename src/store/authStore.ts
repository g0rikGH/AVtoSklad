import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/axios';

// Типизация профиля пользователя
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER';
}

// Типизация стора
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      // Метод для входа в систему
      login: async (email, password) => {
        try {
          const response = await api.post('/auth/login', { email, password });
          const { accessToken, user } = response.data.data;

          // Сохраняем токен в localStorage для axios-интерсептора
          localStorage.setItem('accessToken', accessToken);

          // Обновляем состояние Zustand
          set({ user, isAuthenticated: true });
        } catch (error) {
          console.error("Ошибка авторизации", error);
          throw error;
        }
      },

      // Метод для выхода
      logout: () => {
        localStorage.removeItem('accessToken');
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage', // Имя ключа в localStorage для хранения данных пользователя
    }
  )
);

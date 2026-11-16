import { create } from 'zustand';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

async function postAuth(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err?.detail;
    const fallback =
      path === '/auth/login'
        ? 'Login failed'
        : path === '/auth/google'
          ? 'Google sign-in failed'
          : 'Request failed';
    const message =
      (typeof detail === 'string' ? detail : detail?.message) || fallback;
    throw new Error(message);
  }
  return res.json();
}

let refreshPromise = null;

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  initialized: false,

  setAuth: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),
  clearAuth: () => set({ user: null, accessToken: null, isAuthenticated: false }),

  login: async (email, password) => {
    const data = await postAuth('/auth/login', { email, password });
    set({
      user: data.user,
      accessToken: data.access_token,
      isAuthenticated: true,
      initialized: true,
    });
    return data;
  },

  register: async (email, password, displayName) => {
    const data = await postAuth('/auth/register', {
      email,
      password,
      display_name: displayName,
    });
    set({
      user: data.user,
      accessToken: data.access_token,
      isAuthenticated: true,
      initialized: true,
    });
    return data;
  },

  // Exchange the Google ID token from the GIS button for our own session.
  loginWithGoogle: async (credential) => {
    const data = await postAuth('/auth/google', { credential });
    set({
      user: data.user,
      accessToken: data.access_token,
      isAuthenticated: true,
      initialized: true,
    });
    return data;
  },

  refresh: async () => {
    // Coalesce concurrent refreshes (initial boot plus any 401 retries) so the
    // rotating refresh token isn't spent twice.
    if (!refreshPromise) {
      refreshPromise = postAuth('/auth/refresh')
        .then((data) => {
          set({
            user: data.user,
            accessToken: data.access_token,
            isAuthenticated: true,
            initialized: true,
          });
          return data;
        })
        .catch(() => {
          set({ user: null, accessToken: null, isAuthenticated: false, initialized: true });
          return null;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  },

  // Restore the session from the refresh cookie on app boot.
  initAuth: async () => {
    if (get().initialized) return;
    await get().refresh();
  },

  logout: async () => {
    try {
      await postAuth('/auth/logout');
    } catch {
      // Even if the network call fails, drop the local session.
    }
    set({ user: null, accessToken: null, isAuthenticated: false, initialized: true });
  },
}));

export default useAuthStore;

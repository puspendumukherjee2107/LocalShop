import { Platform } from 'react-native';

const LOCAL_IP = '192.168.29.19';
export const BASE_URL = Platform.OS === 'web'
  ? 'http://localhost:5000/api'
  : `http://${LOCAL_IP}:5000/api`;

export const HUB_URL = Platform.OS === 'web'
  ? 'http://localhost:5000/hubs/orders'
  : `http://${LOCAL_IP}:5000/hubs/orders`;

export const setAuthToken = (token?: string) => {
  const value = token?.trim();

  if (Platform.OS === 'web') {
    if (value) {
      sessionStorage.setItem('localshop_token', value);
    } else {
      sessionStorage.removeItem('localshop_token');
    }
    return;
  }

  if (value) {
    (globalThis as any).__LOCALSHOP_TOKEN__ = value;
  } else if ((globalThis as any).__LOCALSHOP_TOKEN__) {
    delete (globalThis as any).__LOCALSHOP_TOKEN__;
  }
};

export const getAuthToken = () => {
  if (Platform.OS === 'web') {
    return sessionStorage.getItem('localshop_token') ?? undefined;
  }

  return (globalThis as any).__LOCALSHOP_TOKEN__ as string | undefined;
};

const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers(init?.headers || {});
  const token = getAuthToken();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return nativeFetch(input, { ...init, headers });
};
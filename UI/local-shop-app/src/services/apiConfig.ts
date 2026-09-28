import { Platform } from 'react-native';

export const GOOGLE_CLOUD_RUN_API = 'https://localshop-api-972000992560.asia-south1.run.app/api';
export const GOOGLE_CLOUD_RUN_HUB = 'https://localshop-api-972000992560.asia-south1.run.app/hubs/orders';
export const FIXED_CLOUD_API = GOOGLE_CLOUD_RUN_API;
export const FIXED_CLOUD_HUB = GOOGLE_CLOUD_RUN_HUB;
export const LOCAL_LAN_API = 'http://192.168.29.19:5000/api';
export const LOCAL_LAN_HUB = 'http://192.168.29.19:5000/hubs/orders';

const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;
const ENV_HUB_URL = process.env.EXPO_PUBLIC_HUB_URL;

let activeBaseUrl = Platform.OS === 'web'
  ? 'http://localhost:5000/api'
  : (ENV_API_URL || FIXED_CLOUD_API);

let activeHubUrl = Platform.OS === 'web'
  ? 'http://localhost:5000/hubs/orders'
  : (ENV_HUB_URL || FIXED_CLOUD_HUB);

export let BASE_URL = activeBaseUrl;
export let HUB_URL = activeHubUrl;

export const setServerEndpoint = (url: string) => {
  let clean = url.trim().replace(/\/+$/, '');
  if (!clean.endsWith('/api')) {
    BASE_URL = `${clean}/api`;
    HUB_URL = `${clean}/hubs/orders`;
  } else {
    BASE_URL = clean;
    HUB_URL = clean.replace(/\/api$/, '/hubs/orders');
  }
  return BASE_URL;
};

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
  headers.set('bypass-tunnel-reminder', 'true');

  return nativeFetch(input, { ...init, headers });
};
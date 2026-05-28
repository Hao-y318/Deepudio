// 前端路由

import { signal } from '@preact/signals';

export const currentRoute = signal('player');

const routes = {
  player: () => import('../pages/PlayerPage/index.jsx').then(m => m.default),
  chat: () => import('../pages/ChatPage/index.jsx').then(m => m.default),
  profile: () => import('../pages/ProfilePage/index.jsx').then(m => m.default),
  settings: () => import('../pages/SettingsPage/index.jsx').then(m => m.default)
};

export async function navigate(page) {
  if (routes[page]) {
    currentRoute.value = page;
  }
}

export async function loadPage() {
  const page = currentRoute.value;
  if (routes[page]) {
    return await routes[page]();
  }
  return await routes.player();
}

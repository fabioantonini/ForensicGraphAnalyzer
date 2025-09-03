/**
 * Configurazione versione applicazione GrapholexInsight
 */
export const APP_VERSION = {
  major: 2,
  minor: 1, 
  patch: 3,
  build: '2025.09.03',
  name: 'Enhanced Peer Review'
};

export const getVersionString = (): string => {
  return `v${APP_VERSION.major}.${APP_VERSION.minor}.${APP_VERSION.patch}`;
};

export const getFullVersionString = (): string => {
  return `v${APP_VERSION.major}.${APP_VERSION.minor}.${APP_VERSION.patch} (${APP_VERSION.build}) - ${APP_VERSION.name}`;
};
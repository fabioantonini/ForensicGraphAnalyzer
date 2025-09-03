/**
 * Configurazione versione applicazione GrapholexInsight
 */
export const APP_VERSION = {
  major: 2,
  minor: 2, 
  patch: 0,
  build: '2025.09.03',
  name: 'Version Tracking System'
};

export const getVersionString = (): string => {
  return `v${APP_VERSION.major}.${APP_VERSION.minor}.${APP_VERSION.patch}`;
};

export const getFullVersionString = (): string => {
  return `v${APP_VERSION.major}.${APP_VERSION.minor}.${APP_VERSION.patch} (${APP_VERSION.build}) - ${APP_VERSION.name}`;
};
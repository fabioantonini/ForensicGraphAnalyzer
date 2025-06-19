import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en.json';
import itTranslation from './locales/it.json';
import enAdminTranslation from './locales/en/admin.json';
import itAdminTranslation from './locales/it/admin.json';
import enCommonTranslation from './locales/en/common.json';
import itCommonTranslation from './locales/it/common.json';
import enRecommendationsTranslation from './locales/en/recommendations.json';
import itRecommendationsTranslation from './locales/it/recommendations.json';
import enOcrTranslation from './locales/en/ocr.json';
import itOcrTranslation from './locales/it/ocr.json';

// Create a very simplified version without language detection
// This will ensure Italian is always the default language
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslation,
        admin: enAdminTranslation,
        common: enCommonTranslation,
        recommendations: enRecommendationsTranslation,
        ocr: enOcrTranslation
      },
      it: {
        translation: itTranslation,
        admin: itAdminTranslation,
        common: itCommonTranslation,
        recommendations: itRecommendationsTranslation,
        ocr: itOcrTranslation
      }
    },
    lng: 'it', // Hard-code Italian as the default language
    fallbackLng: 'it',
    interpolation: {
      escapeValue: false
    },
    defaultNS: 'translation',
    ns: ['translation', 'admin', 'common', 'recommendations', 'ocr']
  });

// Helper function to ensure Italian is set as the default
export function setDefaultLanguage() {
  // Force Italian as the default language
  i18n.changeLanguage('it');
}

// Initialize with Italian
setDefaultLanguage();

export default i18n;
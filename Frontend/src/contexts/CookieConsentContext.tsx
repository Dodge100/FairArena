import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface ConsentSettings {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean; // Always true, can't be disabled
}
interface CookieConsentContextType {
  consentSettings: ConsentSettings | null;
  hasConsented: boolean;
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  updateConsent: (settings: ConsentSettings) => void;
  acceptAll: () => void;
  rejectAll: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextType | null>(null);

interface CookieConsentProviderProps {
  children: ReactNode;
}

export function CookieConsentProvider({ children }: CookieConsentProviderProps) {
  const [consentSettings, setConsentSettings] = useState<ConsentSettings | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const saved = localStorage.getItem('cookieConsent');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Check if consent is still valid (not older than 1 year)
        const consentDate = new Date(parsed.timestamp);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        if (consentDate > oneYearAgo && parsed.version === '1.0') {
          setConsentSettings({
            necessary: parsed.necessary,
            analytics: parsed.analytics,
            marketing: parsed.marketing,
            functional: parsed.functional,
          });
          return;
        }
      } catch (error) {
        console.warn('Invalid cookie consent data, showing modal');
      }
    }

    // Show modal if no valid consent or first visit
    setShowModal(true);
  }, []);

  const updateConsent = (settings: ConsentSettings) => {
    setConsentSettings(settings);
    setShowModal(false);
  };

  const acceptAll = () => {
    const settings: ConsentSettings = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
    };
    updateConsent(settings);
  };

  const rejectAll = () => {
    const settings: ConsentSettings = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: true, // Functional cookies are required
    };
    updateConsent(settings);
  };

  const hasConsented = consentSettings !== null;

  return (
    <CookieConsentContext.Provider
      value={{
        consentSettings,
        hasConsented,
        showModal,
        setShowModal,
        updateConsent,
        acceptAll,
        rejectAll,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error('useCookieConsent must be used inside CookieConsentProvider');
  }
  return ctx;
}

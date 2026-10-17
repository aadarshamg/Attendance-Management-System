import { CONSENT_NOTICE } from '@ams/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** Worker-facing screens are English by default with a one-tap switch to Hindi. Admin stays English. */
export type Lang = 'en' | 'hi';

const STORAGE_KEY = 'ams.lang';

const en = {
  // Language switch
  'lang.switch': 'हिंदी',
  'lang.switchLabel': 'Switch to Hindi',

  // Login
  'login.title': 'Welcome',
  'login.workerTab': 'Worker',
  'login.staffTab': 'Office staff',
  'login.phone': 'Mobile number',
  'login.phonePlaceholder': '10-digit mobile number',
  'login.pin': '4-digit PIN',
  'login.submit': 'Login',
  'login.busy': 'Logging in…',
  'login.employeeCode': 'Employee code',
  'login.employeeCodePlaceholder': 'Enter employee code',
  'login.password': 'Password',
  'login.passwordPlaceholder': 'Enter your password',
  'login.show': 'Show',
  'login.hide': 'Hide',
  'login.help': 'Forgot your PIN? Ask your supervisor.',

  // Home
  'home.hello': 'Namaste, {name}',
  'home.startWork': 'Start work',
  'home.endWork': 'End work',
  'home.tapToMark': 'Tap to mark attendance',
  'home.today': 'Today',
  'home.in': 'In',
  'home.out': 'Out',
  'home.notYet': '—',
  'home.history': 'My attendance',
  'home.logout': 'Log out',
  'home.logoutConfirm': 'Log out from this phone?',
  'home.doneToday': 'Work done for today. Tap again only if you are starting again.',

  // Capture
  'capture.startTitle': 'Start work',
  'capture.endTitle': 'End work',
  'capture.hint': 'Look at the camera and press the button',
  'capture.takePhoto': 'Take photo',
  'capture.working': 'Please wait…',
  'capture.retake': 'Retake',
  'capture.submit': 'Done — Save',
  'capture.saving': 'Saving…',
  'capture.back': 'Back',
  'capture.tryAgain': 'Try again',

  // Confirmation
  'done.in': 'Work started',
  'done.out': 'Work ended',
  'done.savedAt': 'Saved at {time}',
  'done.check': 'Your supervisor will check this entry.',
  'done.home': 'OK',

  // History
  'history.title': 'My attendance',
  'history.empty': 'No attendance yet.',
  'history.loading': 'Loading…',
  'history.back': 'Back',
  'status.ok': 'OK',
  'status.flagged': 'Supervisor will check',

  // Consent
  'consent.title': 'Before you start',
  'consent.body': CONSENT_NOTICE,
  'consent.agree': 'I agree',
  'consent.saving': 'Saving…',
  'consent.later': 'Not now — log out',

  // Errors: a title saying what went wrong, and what to do about it.
  'err.cameraDenied': 'Camera is blocked',
  'err.cameraDenied.fix':
    'Tap the 🔒 lock next to the web address → Camera → Allow. Then press "Try again".',
  'err.cameraMissing': 'Camera not found',
  'err.cameraMissing.fix': 'Use a phone with a front camera, or ask your supervisor for help.',
  'err.cameraBusy': 'Camera is in use',
  'err.cameraBusy.fix': 'Close other apps that use the camera (video call, camera app), then try again.',
  'err.locationDenied': 'Location is off',
  'err.locationDenied.fix':
    'Turn on Location from the top of your phone screen. Then tap the 🔒 lock → Location → Allow.',
  'err.locationWeak': 'Cannot find your location',
  'err.locationWeak.fix': 'Go to an open area, away from walls and roofs. Wait a little, then try again.',
  'err.network': 'No internet',
  'err.network.fix': 'Turn on mobile data or Wi-Fi, then try again.',
  'err.wrongPin': 'Wrong mobile number or PIN',
  'err.wrongPin.fix': 'Check the number and PIN. If you forgot your PIN, ask your supervisor.',
  'err.wrongPassword': 'Wrong employee code or password',
  'err.wrongPassword.fix': 'Check and try again. If you forgot, ask your administrator.',
  'err.locked': 'Too many wrong tries',
  'err.locked.fix': 'Wait 15 minutes, or ask your supervisor to set a new PIN.',
  'err.slowDown': 'Too many tries',
  'err.slowDown.fix': 'Wait one minute, then try again.',
  'err.badPhone': 'Mobile number looks wrong',
  'err.badPhone.fix': 'Enter your 10-digit mobile number.',
  'err.badPin': 'PIN must be 4 numbers',
  'err.badPin.fix': 'Enter the 4-digit PIN your supervisor gave you.',
  'err.photoTooBig': 'Photo could not be saved',
  'err.photoTooBig.fix': 'Press "Retake" and take the photo again.',
  'err.server': 'Something went wrong',
  'err.server.fix': 'Try again in a minute. If it keeps happening, tell your supervisor.',
} as const;

export type MessageKey = keyof typeof en;

const hi: Record<MessageKey, string> = {
  'lang.switch': 'English',
  'lang.switchLabel': 'अंग्रेज़ी में बदलें',

  'login.title': 'स्वागत है',
  'login.workerTab': 'मज़दूर',
  'login.staffTab': 'ऑफ़िस स्टाफ़',
  'login.phone': 'मोबाइल नंबर',
  'login.phonePlaceholder': '10 अंकों का मोबाइल नंबर',
  'login.pin': '4 अंकों का पिन',
  'login.submit': 'लॉगिन करें',
  'login.busy': 'लॉगिन हो रहा है…',
  'login.employeeCode': 'कर्मचारी कोड',
  'login.employeeCodePlaceholder': 'कर्मचारी कोड डालें',
  'login.password': 'पासवर्ड',
  'login.passwordPlaceholder': 'पासवर्ड डालें',
  'login.show': 'दिखाएँ',
  'login.hide': 'छिपाएँ',
  'login.help': 'पिन भूल गए? अपने सुपरवाइज़र से पूछें।',

  'home.hello': 'नमस्ते, {name}',
  'home.startWork': 'काम शुरू',
  'home.endWork': 'काम ख़त्म',
  'home.tapToMark': 'हाज़िरी लगाने के लिए दबाएँ',
  'home.today': 'आज',
  'home.in': 'आए',
  'home.out': 'गए',
  'home.notYet': '—',
  'home.history': 'मेरी हाज़िरी',
  'home.logout': 'लॉग आउट',
  'home.logoutConfirm': 'इस फ़ोन से लॉग आउट करें?',
  'home.doneToday': 'आज का काम पूरा। दोबारा तभी दबाएँ जब फिर से काम शुरू कर रहे हों।',

  'capture.startTitle': 'काम शुरू',
  'capture.endTitle': 'काम ख़त्म',
  'capture.hint': 'कैमरे की ओर देखें और बटन दबाएँ',
  'capture.takePhoto': 'फ़ोटो लें',
  'capture.working': 'कृपया रुकें…',
  'capture.retake': 'फिर से लें',
  'capture.submit': 'ठीक है — सेव करें',
  'capture.saving': 'सेव हो रहा है…',
  'capture.back': 'वापस',
  'capture.tryAgain': 'फिर कोशिश करें',

  'done.in': 'काम शुरू हो गया',
  'done.out': 'काम ख़त्म हो गया',
  'done.savedAt': '{time} पर सेव हुआ',
  'done.check': 'आपका सुपरवाइज़र इसे जाँचेगा।',
  'done.home': 'ठीक है',

  'history.title': 'मेरी हाज़िरी',
  'history.empty': 'अभी कोई हाज़िरी नहीं।',
  'history.loading': 'लोड हो रहा है…',
  'history.back': 'वापस',
  'status.ok': 'ठीक',
  'status.flagged': 'सुपरवाइज़र जाँचेगा',

  'consent.title': 'शुरू करने से पहले',
  'consent.body':
    'आपकी हाज़िरी दर्ज करने के लिए, यह ऐप हर बार काम शुरू या ख़त्म करते समय आपकी फ़ोटो और लोकेशन लेता है। ' +
    'इसका इस्तेमाल सिर्फ़ हाज़िरी जाँचने के लिए होता है। फ़ोटो 90 दिन बाद मिटा दी जाती हैं; हाज़िरी का समय और ' +
    'जगह आपके काम के रिकॉर्ड के रूप में रखे जाते हैं। आप अपना रिकॉर्ड ऐप में देख सकते हैं। ' +
    'कोई भी समस्या हो तो अपने साइट सुपरवाइज़र से बात करें।',
  'consent.agree': 'मैं सहमत हूँ',
  'consent.saving': 'सेव हो रहा है…',
  'consent.later': 'अभी नहीं — लॉग आउट',

  'err.cameraDenied': 'कैमरा बंद है',
  'err.cameraDenied.fix':
    'वेब पते के पास 🔒 ताले पर दबाएँ → Camera → Allow। फिर "फिर कोशिश करें" दबाएँ।',
  'err.cameraMissing': 'कैमरा नहीं मिला',
  'err.cameraMissing.fix': 'आगे वाले कैमरे वाला फ़ोन इस्तेमाल करें, या सुपरवाइज़र से मदद लें।',
  'err.cameraBusy': 'कैमरा किसी और ऐप में चल रहा है',
  'err.cameraBusy.fix': 'कैमरा इस्तेमाल करने वाले दूसरे ऐप (वीडियो कॉल, कैमरा) बंद करें, फिर कोशिश करें।',
  'err.locationDenied': 'लोकेशन बंद है',
  'err.locationDenied.fix':
    'फ़ोन की स्क्रीन के ऊपर से Location चालू करें। फिर 🔒 ताले पर दबाएँ → Location → Allow।',
  'err.locationWeak': 'आपकी लोकेशन नहीं मिल रही',
  'err.locationWeak.fix': 'खुली जगह पर जाएँ, दीवार और छत से दूर। थोड़ा रुकें, फिर कोशिश करें।',
  'err.network': 'इंटरनेट नहीं है',
  'err.network.fix': 'मोबाइल डेटा या Wi-Fi चालू करें, फिर कोशिश करें।',
  'err.wrongPin': 'मोबाइल नंबर या पिन ग़लत है',
  'err.wrongPin.fix': 'नंबर और पिन जाँचें। पिन भूल गए हैं तो सुपरवाइज़र से पूछें।',
  'err.wrongPassword': 'कर्मचारी कोड या पासवर्ड ग़लत है',
  'err.wrongPassword.fix': 'जाँच कर फिर कोशिश करें। भूल गए हैं तो एडमिन से पूछें।',
  'err.locked': 'बहुत बार ग़लत पिन डाला',
  'err.locked.fix': '15 मिनट रुकें, या सुपरवाइज़र से नया पिन बनवाएँ।',
  'err.slowDown': 'बहुत बार कोशिश की',
  'err.slowDown.fix': 'एक मिनट रुकें, फिर कोशिश करें।',
  'err.badPhone': 'मोबाइल नंबर ग़लत लग रहा है',
  'err.badPhone.fix': 'अपना 10 अंकों का मोबाइल नंबर डालें।',
  'err.badPin': 'पिन 4 अंकों का होना चाहिए',
  'err.badPin.fix': 'सुपरवाइज़र का दिया हुआ 4 अंकों का पिन डालें।',
  'err.photoTooBig': 'फ़ोटो सेव नहीं हो पाई',
  'err.photoTooBig.fix': '"फिर से लें" दबाएँ और दोबारा फ़ोटो लें।',
  'err.server': 'कुछ गड़बड़ हो गई',
  'err.server.fix': 'एक मिनट बाद फिर कोशिश करें। बार-बार हो तो सुपरवाइज़र को बताएँ।',
};

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, hi };

export type Translate = (key: MessageKey, vars?: Record<string, string>) => string;

interface I18nState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translate;
  /** Locale for dates/times: Hindi digits stay Latin, which workers read more easily on screens. */
  locale: string;
}

const I18nCtx = createContext<I18nState | null>(null);

function readLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18nState>(() => {
    const table = MESSAGES[lang];
    const t: Translate = (key, vars) => {
      let text: string = table[key] ?? en[key];
      if (vars) for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, v);
      return text;
    };
    return { lang, setLang, t, locale: lang === 'hi' ? 'hi-IN-u-nu-latn' : 'en-IN' };
  }, [lang, setLang]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** The English ⇄ हिंदी switch shown on every worker screen. */
export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <button
      type="button"
      className="lang-toggle"
      onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
      aria-label={t('lang.switchLabel')}
    >
      <span aria-hidden="true">🌐</span> {t('lang.switch')}
    </button>
  );
}

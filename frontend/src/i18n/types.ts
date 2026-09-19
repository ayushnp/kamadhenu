export type SupportedLocale = 'en' | 'hi' | 'kn';

export interface LanguageOption {
  code: SupportedLocale;
  label: string;       // e.g. "English", "ಕನ್ನಡ", "हिंदी"
  englishLabel: string; // e.g. "Kannada", "Hindi", "English"
  subtext: string;     // e.g. "ಕರ್ನಾಟಕದ ರೈತರಿಗಾಗಿ", "भारतीय किसानों के लिए"
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: 'en',
    label: 'English',
    englishLabel: 'English',
    subtext: 'Default international language',
  },
  {
    code: 'kn',
    label: 'ಕನ್ನಡ',
    englishLabel: 'Kannada',
    subtext: 'ಕರ್ನಾಟಕದ ಹೈನುಗಾರಿಕೆ ರೈತರಿಗಾಗಿ',
  },
  {
    code: 'hi',
    label: 'हिंदी',
    englishLabel: 'Hindi',
    subtext: 'भारत के सभी पशुपालकों के लिए',
  },
];

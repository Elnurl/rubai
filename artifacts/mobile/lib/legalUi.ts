// UI labels for the legal acceptance flow itself, mirrored across the same
// six languages we ship the documents in. Keeping the UI strings beside the
// language list (rather than a global i18n system) avoids pulling in a
// translation framework for one screen.
export const LEGAL_LOCALES = [
  { code: "en", label: "English" },
  { code: "az", label: "Azərbaycan" },
  { code: "ru", label: "Русский" },
  { code: "ar", label: "العربية" },
  { code: "zh", label: "中文" },
  { code: "es", label: "Español" },
] as const;

export type LegalLocaleCode = (typeof LEGAL_LOCALES)[number]["code"];

export const RTL_LOCALES: ReadonlyArray<LegalLocaleCode> = ["ar"];

export type LegalUiStrings = {
  consentTitle: string;
  consentSubtitle: string;
  agreeBoth: string;
  privacyLabel: string;
  termsLabel: string;
  readPrivacy: string;
  readTerms: string;
  continue: string;
  saving: string;
  errorTitle: string;
  errorBody: string;
  retry: string;
  signOut: string;
  languageLabel: string;
  privacyTitle: string;
  termsTitle: string;
  back: string;
  acceptedOn: string;
  notAccepted: string;
  legalSection: string;
  legalSubtitle: string;
  reAcceptNotice: string;
};

export const LEGAL_UI: Record<LegalLocaleCode, LegalUiStrings> = {
  en: {
    consentTitle: "Before you start",
    consentSubtitle:
      "rubai is an AI goal coach. To use it we need your agreement to two short documents.",
    agreeBoth: "I have read and agree to both documents.",
    privacyLabel: "Privacy Policy",
    termsLabel: "Terms of Service",
    readPrivacy: "Read Privacy Policy",
    readTerms: "Read Terms of Service",
    continue: "I accept and continue",
    saving: "Saving…",
    errorTitle: "Could not save",
    errorBody: "Please check your connection and try again.",
    retry: "Try again",
    signOut: "Sign out",
    languageLabel: "Language",
    privacyTitle: "Privacy Policy",
    termsTitle: "Terms of Service",
    back: "Back",
    acceptedOn: "Accepted",
    notAccepted: "Not yet accepted",
    legalSection: "Legal",
    legalSubtitle: "Privacy Policy & Terms of Service",
    reAcceptNotice: "We updated our documents — please re-accept to continue.",
  },
  az: {
    consentTitle: "Başlamazdan əvvəl",
    consentSubtitle:
      "rubai AI hədəf koçudur. İstifadə üçün iki qısa sənədlə razılığınız lazımdır.",
    agreeBoth: "Hər iki sənədi oxudum və qəbul edirəm.",
    privacyLabel: "Məxfilik Siyasəti",
    termsLabel: "İstifadə Şərtləri",
    readPrivacy: "Məxfilik Siyasətini oxu",
    readTerms: "İstifadə Şərtlərini oxu",
    continue: "Qəbul edirəm və davam edirəm",
    saving: "Yadda saxlanılır…",
    errorTitle: "Yadda saxlanmadı",
    errorBody: "İnternet bağlantısını yoxlayın və yenidən cəhd edin.",
    retry: "Yenidən cəhd et",
    signOut: "Çıxış",
    languageLabel: "Dil",
    privacyTitle: "Məxfilik Siyasəti",
    termsTitle: "İstifadə Şərtləri",
    back: "Geri",
    acceptedOn: "Qəbul edilib",
    notAccepted: "Hələ qəbul edilməyib",
    legalSection: "Hüquqi",
    legalSubtitle: "Məxfilik Siyasəti və İstifadə Şərtləri",
    reAcceptNotice:
      "Sənədlərimizi yenilədik — davam etmək üçün yenidən qəbul edin.",
  },
  ru: {
    consentTitle: "Перед началом",
    consentSubtitle:
      "rubai — это AI-коуч целей. Для использования нужно ваше согласие с двумя короткими документами.",
    agreeBoth: "Я прочитал(а) и принимаю оба документа.",
    privacyLabel: "Политика конфиденциальности",
    termsLabel: "Условия использования",
    readPrivacy: "Читать Политику конфиденциальности",
    readTerms: "Читать Условия использования",
    continue: "Принимаю и продолжить",
    saving: "Сохранение…",
    errorTitle: "Не удалось сохранить",
    errorBody: "Проверьте соединение и повторите попытку.",
    retry: "Повторить",
    signOut: "Выйти",
    languageLabel: "Язык",
    privacyTitle: "Политика конфиденциальности",
    termsTitle: "Условия использования",
    back: "Назад",
    acceptedOn: "Принято",
    notAccepted: "Ещё не принято",
    legalSection: "Юридическое",
    legalSubtitle: "Политика конфиденциальности и Условия",
    reAcceptNotice:
      "Мы обновили наши документы — пожалуйста, примите их снова, чтобы продолжить.",
  },
  ar: {
    consentTitle: "قبل أن تبدأ",
    consentSubtitle:
      "rubai مدرب أهداف بالذكاء الاصطناعي. لاستخدامه نحتاج موافقتك على وثيقتين قصيرتين.",
    agreeBoth: "لقد قرأت ووافقت على كلتا الوثيقتين.",
    privacyLabel: "سياسة الخصوصية",
    termsLabel: "شروط الخدمة",
    readPrivacy: "قراءة سياسة الخصوصية",
    readTerms: "قراءة شروط الخدمة",
    continue: "أوافق وأتابع",
    saving: "جارٍ الحفظ…",
    errorTitle: "تعذر الحفظ",
    errorBody: "يرجى التحقق من الاتصال والمحاولة مرة أخرى.",
    retry: "إعادة المحاولة",
    signOut: "تسجيل الخروج",
    languageLabel: "اللغة",
    privacyTitle: "سياسة الخصوصية",
    termsTitle: "شروط الخدمة",
    back: "رجوع",
    acceptedOn: "تم القبول",
    notAccepted: "لم يُقبل بعد",
    legalSection: "قانوني",
    legalSubtitle: "سياسة الخصوصية وشروط الخدمة",
    reAcceptNotice: "لقد قمنا بتحديث وثائقنا — يرجى القبول مرة أخرى للمتابعة.",
  },
  zh: {
    consentTitle: "开始之前",
    consentSubtitle: "rubai 是 AI 目标教练。使用前请同意以下两份简短文件。",
    agreeBoth: "我已阅读并同意两份文件。",
    privacyLabel: "隐私政策",
    termsLabel: "服务条款",
    readPrivacy: "阅读隐私政策",
    readTerms: "阅读服务条款",
    continue: "我接受并继续",
    saving: "保存中…",
    errorTitle: "无法保存",
    errorBody: "请检查网络后重试。",
    retry: "重试",
    signOut: "退出登录",
    languageLabel: "语言",
    privacyTitle: "隐私政策",
    termsTitle: "服务条款",
    back: "返回",
    acceptedOn: "已接受",
    notAccepted: "尚未接受",
    legalSection: "法律",
    legalSubtitle: "隐私政策与服务条款",
    reAcceptNotice: "我们更新了文件 — 请重新接受以继续。",
  },
  es: {
    consentTitle: "Antes de empezar",
    consentSubtitle:
      "rubai es un coach de objetivos con AI. Para usarlo necesitamos tu acuerdo con dos documentos breves.",
    agreeBoth: "He leído y acepto ambos documentos.",
    privacyLabel: "Política de Privacidad",
    termsLabel: "Términos de Servicio",
    readPrivacy: "Leer Política de Privacidad",
    readTerms: "Leer Términos de Servicio",
    continue: "Acepto y continúo",
    saving: "Guardando…",
    errorTitle: "No se pudo guardar",
    errorBody: "Comprueba tu conexión e inténtalo de nuevo.",
    retry: "Reintentar",
    signOut: "Cerrar sesión",
    languageLabel: "Idioma",
    privacyTitle: "Política de Privacidad",
    termsTitle: "Términos de Servicio",
    back: "Atrás",
    acceptedOn: "Aceptado",
    notAccepted: "Aún no aceptado",
    legalSection: "Legal",
    legalSubtitle: "Política de Privacidad y Términos",
    reAcceptNotice:
      "Hemos actualizado nuestros documentos — por favor, acéptalos de nuevo para continuar.",
  },
};

export function isLegalLocaleCode(value: string): value is LegalLocaleCode {
  return LEGAL_LOCALES.some((l) => l.code === value);
}

import type { Locale, LocalizedDocument } from "./index";

const en: LocalizedDocument = {
  title: "Privacy Policy",
  body: `Last updated: 03 May 2026 · Version 1.0.0

This Privacy Policy explains how Horizon ("we", "us", "our"), the operator of the rubai mobile application ("rubai", the "App"), processes personal data of users in accordance with the EU General Data Protection Regulation (Regulation (EU) 2016/679, "GDPR").

1. Controller
The data controller is Horizon, founded by Elnur Ahmadzada. For all privacy questions, data-subject requests, or complaints, contact us at: support@rubai.app.

2. Data we collect and why
We process only the data we need to operate rubai and respect the consent model described in Section 6.

a) Account data — your Supabase-managed authentication identifier and email address. Legal basis: contract performance (Art. 6(1)(b) GDPR).

b) App state — your goals, intake answers, generated roadmaps, daily plans, reflections, behavioral profile, subscription tier, and account preferences. Stored in our PostgreSQL database. Legal basis: contract performance.

c) AI inference content — the prompts and contextual data we send to OpenAI to generate roadmaps, daily plans, and coach replies. We do not use this content for our own model training. Legal basis: contract performance.

d) Calendar data (optional, opt-in) — when you connect a device or Google calendar and explicitly enable "read events" or "write tasks", we read today's events and/or create events on your chosen calendar. We do not store calendar contents server-side beyond the duration of a single AI request. Legal basis: explicit consent (Art. 6(1)(a) GDPR).

e) Push notification data — your Expo push token, device timezone offset, and a per-day flag tracking the most recent morning nudge so we don't double-send. Legal basis: legitimate interest in delivering the service you signed up for (Art. 6(1)(f)), with the ability to opt out from device settings.

f) Operational logs — request metadata (timestamps, status codes, paths, hashed IP) for security, abuse prevention, and debugging. We retain these for 30 days. Legal basis: legitimate interest.

g) Legal acceptance audit trail — the version, timestamp, locale, hashed IP, and user agent of each Privacy Policy and Terms of Service acceptance. Legal basis: legal obligation (Art. 6(1)(c)) to demonstrate consent under Art. 7(1) GDPR.

3. Sub-processors
We rely on the following processors to operate rubai. Each is bound by a written processing agreement.

- Supabase — authentication and identity management.
- OpenAI — large-language-model inference for roadmap, daily plan, and coach features.
- Google (Calendar API) — only when you explicitly connect and enable calendar access.
- Replit — application hosting, database, and connector infrastructure.
- Expo — push notification delivery.

Some of these providers operate in jurisdictions outside the EEA. Where this is the case we rely on the European Commission's Standard Contractual Clauses or equivalent transfer mechanisms.

4. Retention
We keep your account data and app state for as long as your account is active. You may delete your account at any time from the Account screen or by writing to support@rubai.app, and we will erase your personal data within 30 days, except where we are required by law to retain certain records (for example, financial records related to subscription billing).

5. Your rights under GDPR
You have the right to: (a) access your personal data, (b) rectify inaccurate data, (c) request erasure ("right to be forgotten"), (d) restrict processing, (e) object to processing based on legitimate interest, (f) request portability of your data in a structured machine-readable format, (g) withdraw consent at any time without affecting the lawfulness of prior processing, and (h) lodge a complaint with the supervisory authority in your EU member state.

To exercise any of these rights, write to support@rubai.app from the email address associated with your account.

6. Consent model for sensitive data
Calendar data — and any future personal data integrations such as email — is treated as raw signal that helps rubai understand your day. No such data flows without your explicit, granular consent. Connecting a provider only grants access; reading events into AI prompts and writing tasks back to the calendar are two independent switches that default to off. Disconnecting immediately stops every data path.

7. Security
We use TLS in transit, encrypted database storage at rest, hashed IP addresses in audit logs, and least-privilege access controls. No system is perfectly secure; if you believe an incident has occurred, please notify us immediately at support@rubai.app.

8. Children
rubai is not directed at children under 16. If you believe a child has created an account, contact us and we will erase the account.

9. Changes
We will notify you of material changes to this Privacy Policy in-app and require you to re-accept before continuing to use rubai. The current version is shown at the top of this document.`,
};

const az: LocalizedDocument = {
  title: "Məxfilik Siyasəti",
  body: `Son yenilənmə: 03 May 2026 · Versiya 1.0.0

Bu Məxfilik Siyasəti rubai mobil tətbiqinin ("rubai", "Tətbiq") operatoru olan Horizon ("biz", "bizim") tərəfindən istifadəçilərin şəxsi məlumatlarının Avropa İttifaqının Ümumi Məlumatların Mühafizəsi Reqlamentinə (Reqlament (AI) 2016/679, "GDPR") uyğun necə emal edildiyini izah edir.

1. Nəzarətçi
Məlumat nəzarətçisi Elnur Ahmadzada tərəfindən təsis edilən Horizon şirkətidir. Bütün məxfilik sualları, məlumat subyekti tələbləri və ya şikayətlər üçün bizimlə əlaqə: support@rubai.app.

2. Topladığımız məlumatlar və məqsəd
Yalnız rubai-nin işləməsi üçün lazım olan məlumatları emal edirik və 6-cı Bölmədə təsvir olunan razılıq modelinə hörmət edirik.

a) Hesab məlumatları — Supabase vasitəsilə idarə olunan identifikator və email ünvanınız. Hüquqi əsas: müqavilənin icrası (GDPR Mad. 6(1)(b)).

b) Tətbiq vəziyyəti — hədəfləriniz, intake cavablarınız, yaradılan yol xəritələri, günlük planlar, refleksiyalar, davranış profili, abunə səviyyəsi və hesab seçimləri. PostgreSQL bazamızda saxlanır. Hüquqi əsas: müqavilənin icrası.

c) AI məzmunu — yol xəritəsi, günlük plan və koç cavabları yaratmaq üçün OpenAI-yə göndərdiyimiz promptlar və kontekst. Bu məzmunu öz model təlimimiz üçün istifadə etmirik. Hüquqi əsas: müqavilənin icrası.

d) Təqvim məlumatları (opsional, açıq razılıqla) — cihaz və ya Google təqvimini qoşub "hadisələri oxu" və ya "tapşırıqları yaz" seçimlərini açıq şəkildə aktivləşdirdikdə, bugünkü hadisələri oxuyuruq və/və ya seçdiyiniz təqvimdə hadisələr yaradırıq. Təqvim məzmununu serverdə saxlamırıq — yalnız tək AI sorğusu zamanı istifadə olunur. Hüquqi əsas: açıq razılıq (GDPR Mad. 6(1)(a)).

e) Push bildiriş məlumatları — Expo push token, cihaz saat qurşağı offseti və günə bir səhər bildirişi qaydasını izləyən bayraq. Hüquqi əsas: qoşulduğunuz xidməti çatdırmaqda qanuni maraq (Mad. 6(1)(f)) — cihaz tənzimləmələrindən söndürə bilərsiniz.

f) Əməliyyat logları — sorğu metadata-sı (vaxt damğaları, status kodları, yollar, hash-lənmiş IP) təhlükəsizlik, sui-istifadənin qarşısının alınması və debugging üçün. 30 gün saxlanır. Hüquqi əsas: qanuni maraq.

g) Hüquqi razılıq audit izi — Məxfilik Siyasəti və İstifadə Şərtlərinin hər qəbulu üçün versiya, vaxt damğası, dil, hash-lənmiş IP və user agent. Hüquqi əsas: GDPR Mad. 7(1)-ə əsasən razılığı sübut etmək qanuni öhdəliyi (Mad. 6(1)(c)).

3. Alt-prosessorlar
- Supabase — autentifikasiya.
- OpenAI — AI inferensiya.
- Google (Calendar API) — yalnız siz açıq şəkildə qoşduqda.
- Replit — hosting, baza və konnektor infrastrukturu.
- Expo — push bildiriş çatdırılması.

Bəzi provayderlər EEA xaricində fəaliyyət göstərir; belə hallarda Avropa Komissiyasının Standart Müqavilə Bəndləri (SCC) və ya ekvivalent mexanizmlərə əsaslanırıq.

4. Saxlama müddəti
Hesabınız aktiv olduqca məlumatları saxlayırıq. Account ekranından və ya support@rubai.app ünvanına yazaraq hesabınızı istənilən vaxt silə bilərsiniz; şəxsi məlumatlarınız 30 gün ərzində silinəcək (qanunla saxlanması tələb olunan yazılar istisna olmaqla).

5. GDPR çərçivəsində hüquqlarınız
(a) məlumatlarınıza giriş, (b) düzəliş, (c) silinmə ("unudulmaq hüququ"), (d) emalın məhdudlaşdırılması, (e) qanuni marağa əsaslanan emala etiraz, (f) struktur formatda portativlik, (g) razılığı geri çəkmək, (h) öz AI üzv ölkənizin nəzarət orqanına şikayət vermək hüququnuz var.

Bu hüquqları həyata keçirmək üçün hesabınızla əlaqəli email ünvanından support@rubai.app-a yazın.

6. Həssas məlumatlar üçün razılıq modeli
Təqvim məlumatları — və gələcəkdə email kimi hər hansı şəxsi data inteqrasiyası — rubai-yə günü anlamağa kömək edən xammal kimi qəbul edilir. Heç bir belə məlumat sizin açıq, granular razılığınız olmadan hərəkət etmir. Provayderi qoşmaq yalnız giriş icazəsi verir; AI-nin hadisələri oxuması və tapşırıqların təqvimə yazılması iki ayrıca açar/bağladır və default olaraq sönülüdür. Bağlantını kəsmək bütün məlumat axınlarını dərhal dayandırır.

7. Təhlükəsizlik
Ötürmədə TLS, sakit rejimdə şifrəli baza yaddaşı, audit loglarında hash-lənmiş IP-lər və minimum-imtiyaz girişindən istifadə edirik. Heç bir sistem mükəmməl təhlükəsiz deyil; insident şübhəsi varsa support@rubai.app ünvanına dərhal məlumat verin.

8. Uşaqlar
rubai 16 yaşdan kiçik uşaqlar üçün nəzərdə tutulmayıb. Uşağın hesab yaratdığını düşünürsünüzsə bizimlə əlaqə saxlayın.

9. Dəyişikliklər
Bu Siyasətdə material dəyişikliklər barədə sizə bildiriş verəcəyik və rubai-dən istifadəni davam etdirməzdən əvvəl yenidən qəbul etməyi tələb edəcəyik. Cari versiya sənədin yuxarısında göstərilir.`,
};

const ru: LocalizedDocument = {
  title: "Политика конфиденциальности",
  body: `Последнее обновление: 03 мая 2026 · Версия 1.0.0

Настоящая Политика конфиденциальности описывает, как Horizon («мы», «нас»), оператор мобильного приложения rubai («rubai», «Приложение»), обрабатывает персональные данные пользователей в соответствии с Общим регламентом ЕС о защите данных (Регламент (ЕС) 2016/679, «GDPR»).

1. Контролёр данных
Контролёром данных является Horizon, основанный Эльнуром Ахмедзаде. По всем вопросам конфиденциальности, запросам субъекта данных и жалобам обращайтесь: support@rubai.app.

2. Какие данные мы собираем и зачем
Мы обрабатываем только данные, необходимые для работы rubai, и соблюдаем модель согласия из раздела 6.

а) Данные аккаунта — идентификатор Supabase и email. Правовое основание: исполнение договора (ст. 6(1)(b) GDPR).
б) Состояние приложения — цели, ответы анкеты, дорожные карты, ежедневные планы, рефлексии, поведенческий профиль, тариф и настройки. Хранится в PostgreSQL. Основание: исполнение договора.
в) Содержимое AI-запросов — промпты и контекст, отправляемые в OpenAI. Мы не используем их для обучения собственных моделей. Основание: исполнение договора.
г) Данные календаря (опционально, по согласию) — при подключении устройства или Google-календаря и явном включении переключателей «читать события» или «записывать задачи». Содержимое календаря на сервере не сохраняется дольше одного AI-запроса. Основание: явное согласие (ст. 6(1)(a)).
д) Push-уведомления — токен Expo, смещение часового пояса, флаг последнего утреннего напоминания. Основание: законный интерес (ст. 6(1)(f)).
е) Операционные логи — метаданные запросов (время, коды, пути, хеш IP) для безопасности и отладки. Хранятся 30 дней.
ж) Аудит согласий — версия, время, локаль, хеш IP и user agent каждого принятия Политики и Условий. Основание: юридическая обязанность (ст. 6(1)(c)) подтверждать согласие по ст. 7(1).

3. Субпроцессоры
Supabase (аутентификация), OpenAI (AI), Google Calendar (только при подключении), Replit (хостинг и БД), Expo (push). Некоторые работают за пределами ЕЭП — мы используем стандартные договорные положения ЕС или эквивалентные механизмы передачи.

4. Сроки хранения
Данные хранятся, пока активен аккаунт. Удалить аккаунт можно из экрана Account или письмом на support@rubai.app — персональные данные удаляются в течение 30 дней (за исключением записей, требуемых законом).

5. Ваши права по GDPR
Доступ, исправление, удаление, ограничение, возражение, переносимость, отзыв согласия и подача жалобы в надзорный орган вашей страны ЕС. Письмо на support@rubai.app с email аккаунта.

6. Модель согласия для чувствительных данных
Календарь — и любые будущие интеграции с персональными данными вроде почты — рассматриваются как сырой сигнал. Никакие данные не передаются без явного согласия. Подключение даёт только доступ; чтение событий AI и запись задач — два независимых переключателя, выключенных по умолчанию. Отключение мгновенно останавливает все потоки.

7. Безопасность
TLS при передаче, шифрование БД в покое, хешированные IP, минимальные привилегии. О подозрениях на инцидент пишите на support@rubai.app.

8. Дети
rubai не предназначен для детей младше 16. Если ребёнок создал аккаунт — сообщите нам.

9. Изменения
О существенных изменениях мы сообщим в приложении и потребуем повторного принятия.`,
};

const ar: LocalizedDocument = {
  title: "سياسة الخصوصية",
  body: `آخر تحديث: 03 مايو 2026 · الإصدار 1.0.0

توضح سياسة الخصوصية هذه كيف تعالج Horizon ("نحن")، مشغل تطبيق rubai للهاتف المحمول ("rubai"، "التطبيق")، البيانات الشخصية للمستخدمين وفقًا للائحة العامة لحماية البيانات في الاتحاد الأوروبي (اللائحة (الاتحاد الأوروبي) 2016/679، "GDPR").

1. المراقب
المراقب هو Horizon، التي أسسها إلنور أحمد زاده. للاستفسارات وطلبات أصحاب البيانات والشكاوى: support@rubai.app.

2. البيانات التي نجمعها ولماذا
نعالج فقط البيانات اللازمة لتشغيل rubai، ونحترم نموذج الموافقة في القسم 6.

(أ) بيانات الحساب — معرف Supabase وعنوان البريد الإلكتروني. الأساس القانوني: تنفيذ العقد (المادة 6(1)(ب)).
(ب) حالة التطبيق — أهدافك، إجابات الاستبيان، خرائط الطريق، الخطط اليومية، التأملات، الملف السلوكي، فئة الاشتراك، التفضيلات. مخزّنة في PostgreSQL. الأساس: تنفيذ العقد.
(ج) محتوى الذكاء الاصطناعي — التوجيهات والسياق المُرسلة إلى OpenAI. لا نستخدمها لتدريب نماذجنا. الأساس: تنفيذ العقد.
(د) بيانات التقويم (اختياري، بموافقة صريحة) — عند ربط جهازك أو Google Calendar وتفعيل المفاتيح بشكل صريح. لا نخزن محتوى التقويم على الخادم بعد طلب الذكاء الاصطناعي. الأساس: الموافقة الصريحة (المادة 6(1)(أ)).
(هـ) إشعارات Push — رمز Expo، إزاحة المنطقة الزمنية، علامة التذكير الصباحي. الأساس: المصلحة المشروعة (المادة 6(1)(و)).
(و) سجلات التشغيل — بيانات الطلبات (الأوقات، الرموز، المسارات، تجزئة IP) للأمن والتصحيح. تُحفظ 30 يومًا.
(ز) سجل قبول الوثائق القانونية — الإصدار، الوقت، اللغة، تجزئة IP، وكيل المستخدم لكل قبول. الأساس: التزام قانوني (المادة 6(1)(ج)) بإثبات الموافقة وفق المادة 7(1).

3. المعالجون الفرعيون
Supabase (المصادقة)، OpenAI (الذكاء الاصطناعي)، Google Calendar (فقط عند الربط الصريح)، Replit (الاستضافة وقاعدة البيانات)، Expo (الإشعارات). بعضها يعمل خارج المنطقة الاقتصادية الأوروبية — نعتمد على البنود التعاقدية القياسية للاتحاد الأوروبي أو آليات نقل مكافئة.

4. مدة الاحتفاظ
نحتفظ بالبيانات طالما الحساب نشط. يمكنك حذف الحساب من شاشة Account أو عبر البريد إلى support@rubai.app — تُمحى البيانات الشخصية خلال 30 يومًا (ما لم يُلزم القانون بالاحتفاظ).

5. حقوقك بموجب GDPR
الوصول، التصحيح، المحو، التقييد، الاعتراض، النقل، سحب الموافقة، وتقديم شكوى إلى السلطة الإشرافية في دولتك الأوروبية. اكتب من بريد حسابك إلى support@rubai.app.

6. نموذج الموافقة للبيانات الحساسة
يُعامل التقويم — وأي تكاملات بيانات شخصية مستقبلية مثل البريد — كإشارة خام لفهم يومك. لا تتدفق أي بيانات دون موافقة صريحة وحبيبية. الربط يمنح الوصول فقط؛ قراءة الأحداث وكتابة المهام مفتاحان مستقلان معطّلان افتراضيًا. فصل الاتصال يوقف كل المسارات فورًا.

7. الأمن
TLS أثناء النقل، تشفير قاعدة البيانات، تجزئة IP، أقل الصلاحيات. للإبلاغ عن حادث: support@rubai.app.

8. الأطفال
rubai غير موجه للأطفال دون 16 سنة.

9. التغييرات
سنُبلغ عن التغييرات الجوهرية ونطلب إعادة القبول.`,
};

const zh: LocalizedDocument = {
  title: "隐私政策",
  body: `最后更新：2026年5月3日 · 版本 1.0.0

本隐私政策说明 rubai 移动应用（"rubai"、"本应用"）的运营方 Horizon（"我们"）如何按照欧盟《通用数据保护条例》（EU 2016/679，简称"GDPR"）处理用户的个人数据。

1. 数据控制者
数据控制者为 Horizon，由 Elnur Ahmadzada 创立。隐私问题、数据主体请求或投诉：support@rubai.app。

2. 我们收集的数据及目的
我们只处理运营 rubai 所必需的数据，并遵守第 6 节的同意模型。

a) 账户数据 — Supabase 身份标识和电子邮件。法律依据：合同履行（第 6(1)(b) 条）。
b) 应用状态 — 您的目标、问卷答案、生成的路线图、每日计划、反思、行为档案、订阅等级和偏好。存储在 PostgreSQL。依据：合同履行。
c) AI 推理内容 — 发送给 OpenAI 的提示和上下文。我们不将其用于自有模型训练。依据：合同履行。
d) 日历数据（可选，明示同意） — 当您连接设备或 Google 日历并明确开启相关开关时。日历内容不会在服务器端保存超过单次 AI 请求的时长。依据：明示同意（第 6(1)(a) 条）。
e) 推送通知数据 — Expo 推送令牌、时区偏移、每日早晨提醒标记。依据：合法利益（第 6(1)(f) 条）。
f) 运营日志 — 请求元数据（时间戳、状态码、路径、IP 哈希），用于安全和调试，保留 30 天。
g) 法律接受审计记录 — 版本、时间、语言、IP 哈希、用户代理。依据：第 6(1)(c) 条的法律义务，证明第 7(1) 条要求的同意。

3. 子处理方
Supabase（身份验证）、OpenAI（AI）、Google Calendar（仅在您明示连接时）、Replit（托管和数据库）、Expo（推送）。部分位于欧洲经济区之外 — 我们依赖欧盟标准合同条款或等效转移机制。

4. 保留期限
账户活跃期间保留。您可在 Account 屏幕或写信至 support@rubai.app 删除账户 — 30 天内删除个人数据（法律要求保留的记录除外）。

5. GDPR 下的权利
访问、更正、删除、限制处理、反对、可携带、撤回同意、向欧盟成员国监督机构投诉。请使用账户邮箱写信至 support@rubai.app。

6. 敏感数据的同意模型
日历数据 — 以及未来的邮件等任何个人数据集成 — 被视为帮助 rubai 理解您一天的原始信号。未经您明确、细粒度的同意，任何此类数据都不会流动。连接提供方仅授予访问权限；让 AI 读取事件和写入任务是两个独立的开关，默认关闭。断开连接立即停止所有数据路径。

7. 安全
传输 TLS、静态加密、IP 哈希、最小权限。如怀疑事件，请联系 support@rubai.app。

8. 儿童
rubai 不面向 16 岁以下儿童。

9. 变更
重大变更将在应用内通知，并要求重新接受。`,
};

const es: LocalizedDocument = {
  title: "Política de Privacidad",
  body: `Última actualización: 03 de mayo de 2026 · Versión 1.0.0

Esta Política de Privacidad explica cómo Horizon ("nosotros"), operador de la aplicación móvil rubai ("rubai", la "Aplicación"), procesa los datos personales de los usuarios de conformidad con el Reglamento General de Protección de Datos de la UE (Reglamento (UE) 2016/679, "RGPD").

1. Responsable del tratamiento
El responsable del tratamiento es Horizon, fundada por Elnur Ahmadzada. Para preguntas de privacidad, solicitudes del interesado o reclamaciones: support@rubai.app.

2. Qué datos recopilamos y por qué
Procesamos solo los datos necesarios para operar rubai y respetamos el modelo de consentimiento de la Sección 6.

a) Datos de cuenta — identificador de Supabase y dirección de correo. Base legal: ejecución del contrato (Art. 6(1)(b) RGPD).
b) Estado de la aplicación — objetivos, respuestas del cuestionario, hojas de ruta, planes diarios, reflexiones, perfil conductual, nivel de suscripción y preferencias. Almacenado en PostgreSQL. Base: ejecución del contrato.
c) Contenido de inferencia AI — los prompts y contexto enviados a OpenAI. No los usamos para entrenar nuestros propios modelos. Base: ejecución del contrato.
d) Datos de calendario (opcional, con consentimiento) — cuando conectas un calendario de dispositivo o de Google y activas explícitamente los interruptores. No almacenamos el contenido del calendario en el servidor más allá de la duración de una sola solicitud AI. Base: consentimiento explícito (Art. 6(1)(a)).
e) Datos de notificaciones push — token de Expo, desplazamiento de zona horaria, marca diaria del recordatorio matutino. Base: interés legítimo (Art. 6(1)(f)).
f) Registros operativos — metadatos de solicitud (marcas temporales, códigos, rutas, hash de IP) para seguridad y depuración. Conservados 30 días.
g) Registro de auditoría de aceptación legal — versión, marca temporal, idioma, hash de IP, agente de usuario. Base: obligación legal (Art. 6(1)(c)) de demostrar el consentimiento conforme al Art. 7(1).

3. Subencargados
Supabase (autenticación), OpenAI (AI), Google Calendar (solo cuando conectas explícitamente), Replit (alojamiento y base de datos), Expo (push). Algunos operan fuera del EEE — utilizamos las Cláusulas Contractuales Tipo de la UE u otros mecanismos equivalentes.

4. Conservación
Conservamos los datos mientras la cuenta esté activa. Puedes eliminar la cuenta desde la pantalla Account o escribiendo a support@rubai.app — los datos personales se eliminan en 30 días (excepto registros que la ley exija conservar).

5. Tus derechos bajo RGPD
Acceso, rectificación, supresión, limitación, oposición, portabilidad, retirada del consentimiento y reclamación ante la autoridad de control de tu Estado miembro. Escribe desde el correo de tu cuenta a support@rubai.app.

6. Modelo de consentimiento para datos sensibles
El calendario — y cualquier futura integración de datos personales como el correo — se tratan como señal en bruto que ayuda a rubai a entender tu día. Ningún dato fluye sin tu consentimiento explícito y granular. Conectar un proveedor solo otorga acceso; leer eventos y escribir tareas son dos interruptores independientes, desactivados por defecto. Desconectar detiene todas las rutas de inmediato.

7. Seguridad
TLS en tránsito, cifrado en reposo, hash de IP, mínimo privilegio. Para incidentes: support@rubai.app.

8. Menores
rubai no está dirigido a menores de 16 años.

9. Cambios
Notificaremos cambios sustanciales en la aplicación y exigiremos una nueva aceptación.`,
};

export const privacyPolicy: Record<Locale, LocalizedDocument> = {
  en,
  az,
  ru,
  ar,
  zh,
  es,
};

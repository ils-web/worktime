import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  CheckCircle2,
  MapPin,
  Smartphone,
  ShieldCheck,
  Share2,
  CalendarCheck,
  Sparkles,
  ArrowLeft,
  Loader2,
  Video,
  Lock,
} from 'lucide-react';

type PresLang = 'ru' | 'he' | 'en';

interface SlideItem {
  id: number;
  badge: string;
  title: string;
  subtitle: string;
  bullets: string[];
  highlightTitle: string;
  highlightValue: string;
  highlightDesc: string;
  accentColor: 'emerald' | 'cyan' | 'amber' | 'purple' | 'rose' | 'indigo';
  mockupType:
    | 'overview'
    | 'sites'
    | 'whatsapp'
    | 'worker_pwa'
    | 'gps_modes'
    | 'labor_law'
    | 'global_norm'
    | 'reports'
    | 'security';
}

const SLIDES_DATA: Record<PresLang, SlideItem[]> = {
  ru: [
    {
      id: 1,
      badge: 'ОБЗОР СИСТЕМЫ • TICKWORK.CC',
      title: 'Умный учёт рабочего времени и GPS-контроль в Израиле',
      subtitle:
        'Автоматизируйте табели, контроль объектов и расчёт зарплаты без дорогого оборудования и сложных установок.',
      bullets: [
        'Работает мгновенно на любом смартфоне (iPhone / Android) и компьютере',
        '100% соответствие израильскому трудовому праву (Шаббат, 125% / 150%, обед)',
        'Полная мультиязычность интерфейса и отчётов: Иврит (עברית), Русский, English, العربية',
        'Прозрачный контроль в реальном времени для владельца бизнеса и бригадиров',
      ],
      highlightTitle: 'Экономия времени руководителя',
      highlightValue: 'до 90%',
      highlightDesc: 'Никаких бумажных табелей и споров о часах в конце месяца',
      accentColor: 'emerald',
      mockupType: 'overview',
    },
    {
      id: 2,
      badge: 'ШАГ 1 • НАСТРОЙКА КОМПАНИИ И ОБЪЕКТОВ',
      title: 'Добавление рабочих объектов на карте за 1 минуту',
      subtitle:
        'Укажите точки объектов на интерактивной карте и задайте допустимый радиус входа для работников.',
      bullets: [
        'Поиск адреса на карте Израиля или выбор точки одним кликом мыши',
        'Гибкий радиус геозоны для каждого объекта (например: 100 м, 150 м, 300 м)',
        'Настройка границ утренней, вечерней и ночной смены компании',
        'Привязка сотрудников сразу к одному или нескольким объектам',
      ],
      highlightTitle: 'Точность геозоны',
      highlightValue: 'GPS ±10м',
      highlightDesc: 'Система мгновенно вычисляет расстояние работника до объекта',
      accentColor: 'cyan',
      mockupType: 'sites',
    },
    {
      id: 3,
      badge: 'ШАГ 2 • ПОДКЛЮЧЕНИЕ ПЕРСОНАЛА',
      title: 'Мгновенный вход работников по ссылке в WhatsApp или QR-коду',
      subtitle:
        'Сотрудникам не нужно запоминать логины и пароли — вход происходит в 1 касание.',
      bullets: [
        'Кнопка «Отправить в WhatsApp» прямо в списке сотрудников админ-панели',
        'Персональный QR-код для сканирования камерой телефона на объекте',
        'Установка иконки приложения на главный экран телефона (PWA) в 1 клик',
        'Назначение должности, типа ставки и ответственного бригадира',
      ],
      highlightTitle: 'Подключение работника',
      highlightValue: '10 сек',
      highlightDesc: 'Открыл ссылку в WhatsApp — и сразу готов отметить начало смены',
      accentColor: 'emerald',
      mockupType: 'whatsapp',
    },
    {
      id: 4,
      badge: 'ШАГ 3 • МОБИЛЬНОЕ ПРИЛОЖЕНИЕ РАБОТНИКА',
      title: 'Защита от случайных нажатий и работа даже без интернета',
      subtitle:
        'Удобный интерфейс на родном языке работника с защитой от ошибок.',
      bullets: [
        'Слайдер подтверждения (Slide-to-Confirm) защищает от нажатий в кармане',
        'Живой секундомер активной смены и индикатор нахождения на объекте',
        'Офлайн-режим: если в подвале или на парковке нет сети, отметка сохранится и синхронизируется автоматически',
        'Отправка дневных заметок и чеков расходов прямо со смартфона',
      ],
      highlightTitle: 'Надёжность фиксации',
      highlightValue: '24/7 Офлайн',
      highlightDesc: 'Ни одна смена не потеряется даже при плохом мобильном интернете',
      accentColor: 'indigo',
      mockupType: 'worker_pwa',
    },
    {
      id: 5,
      badge: 'ШАГ 4 • УМНЫЕ РЕЖИМЫ ГЕОЛОКАЦИИ',
      title: '3 режима GPS-контроля под любую специфику работы',
      subtitle:
        'Настройте правила индивидуально для каждого сотрудника в зависимости от его задач.',
      bullets: [
        '1. Мобильный сотрудник: вход из любой точки с записью GPS-координат',
        '2. Строгий GPS на объекте: вход только внутри радиуса; при выезде с объекта смена закрывается автоматически',
        '3. Перемещение между объектами (Транзит): при переезде с Объекта А на Объект Б система автоматически начисляет нормативное время дороги и продолжает смену',
        'Защита от личных поездок: сверхнормативные остановки не оплачиваются как рабочее время',
      ],
      highlightTitle: 'Авто-контроль выезда',
      highlightValue: 'Строгий GPS',
      highlightDesc: 'Счётчик остановится сам, как только работник покинет объект',
      accentColor: 'amber',
      mockupType: 'gps_modes',
    },
    {
      id: 6,
      badge: 'ШАГ 5 • ИЗРАИЛЬСКОЕ ТРУДОВОЕ ПРАВО',
      title: 'Автоматический расчёт 125% / 150%, Шаббата, ночных и обеда',
      subtitle:
        'Все формулы работают строго по часовому поясу Иерусалима (Asia/Jerusalem).',
      bullets: [
        'Сверхурочные (שעות נוספות): первые 2 часа сверх дневной нормы — 125%, последующие часы — 150%',
        'Настраиваемый порог дневной нормы: 9.0 ч (стандарт) или 8.6 ч / 8.5 ч (5-дневка)',
        'Пятница (כניסת שבת) и Суббота: часы после времени входа Шаббата в пятницу и вся суббота идут в субботний тариф (150%)',
        'Авто-вычет обеда 30 минут при смене от 6 часов (если не было перерыва ≥ 30 мин)',
      ],
      highlightTitle: 'Расчёт сверхурочных',
      highlightValue: '125% • 150%',
      highlightDesc: 'Полная разбивка по колонкам в экране часов, PDF и Excel (CSV)',
      accentColor: 'rose',
      mockupType: 'labor_law',
    },
    {
      id: 7,
      badge: 'ШАГ 6 • ГЛОБАЛЬНЫЕ СОТРУДНИКИ И ГРАФИК',
      title: 'Контроль месячной нормы часов и матрица расписания',
      subtitle:
        'Для работников на глобальной месячной ставке система сама следит за выполнением плана.',
      bullets: [
        'Индивидуальная норма часов в месяц (например, 182 ч) со шкалой прогресса',
        'Умное оповещение за 3 рабочих дня до конца месяца при недоработке или переработке',
        'Наглядная матрица смен по дням недели (Утро, Вечер, Ночь, Двойная смена, Выходной)',
        'Опция автоматического закрытия смены ровно по окончании графика',
      ],
      highlightTitle: 'Предупреждение за',
      highlightValue: '3 дня',
      highlightDesc: 'И работник, и руководитель заранее видят остаток часов до нормы',
      accentColor: 'purple',
      mockupType: 'global_norm',
    },
    {
      id: 8,
      badge: 'ШАГ 7 • ИНТЕГРАЦИИ С БУХГАЛТЕРИЕЙ И ОТЧЁТЫ',
      title: 'Интеграция с программами зарплаты (מיכפל, שיקלולית, Priority, ריווחית, חילן) в 1 клик!',
      subtitle:
        'Прямая выгрузка для роэ-хешбона: 9 встроенных форматов зарплатных программ Израиля + PDF и Excel.',
      bullets: [
        'Готовые файлы для: מיכפל (Michpal), שיקלולית (ט.מ.ל), Priority ERP, ריווחית (Rivhit), חילן (Hilan), הר-גל, עוקץ',
        'Автоматическая разбивка по кодам начислений (סמלי שכר): 100%, 125%, 150%, Шаббат, ночные и расходы',
        'Мгновенное скачивание PDF и Excel на иврите (עב), русском (RU) или английском (EN) + отправка бухгалтеру в WhatsApp',
        'Прямой REST API для синхронизации с ERP, 1С, Make и внешними системами учёта',
      ],
      highlightTitle: 'Интеграции с зарплатой',
      highlightValue: '9 систем + PDF',
      highlightDesc: 'מיכפל • שיקלולית • Priority • ריווחית • חילן • הר-גל • עוקץ • Excel • API',
      accentColor: 'emerald',
      mockupType: 'reports',
    },
    {
      id: 9,
      badge: 'БЕЗОПАСНОСТЬ И КОНФИДЕНЦИАЛЬНОСТЬ • AES-256',
      title: 'Все данные зашифрованы и ни при каких условиях никому не передаются',
      subtitle:
        'Максимальная защита персональных данных работников и коммерческой тайны вашей компании.',
      bullets: [
        'Банковское шифрование AES-256-GCM: табельные ID и номера телефонов хранятся в базе данных только в зашифрованном виде',
        'Строгое соглашение: данные никогда и ни при каких обстоятельствах не передаются третьим лицам или внешним сервисам',
        'Юридическая фиксация: при первом входе работник подтверждает согласие на обработку данных для расчёта зарплаты с записью времени',
        'Полная конфиденциальность: доступ к данным есть исключительно у авторизованного руководства компании',
      ],
      highlightTitle: 'Стандарт шифрования',
      highlightValue: 'AES-256',
      highlightDesc: '100% конфиденциальность • Данные защищены и никому не передаются',
      accentColor: 'emerald',
      mockupType: 'security',
    },
  ],
  he: [
    {
      id: 1,
      badge: 'סקירת מערכת • TICKWORK.CC',
      title: 'מערכת חכמה לניהול שעות עבודה ובקרת GPS בישראל',
      subtitle:
        'אוטומציה מלאה של דוחות נוכחות, שליטה באתרי עבודה וחישוב שכר מדויק ללא צורך בחומרה יקרה.',
      bullets: [
        'פועל מיד בכל סמארטפון (iPhone / Android) ומחשב ללא התקנה מסובכת',
        'מותאם ב-100% לחוק שעות עבודה ומנוחה בישראל (שבת, 125% / 150%, הפסקות)',
        'תמיכה מלאה ב-4 שפות בממשק ובדוחות: עברית, רוסית, אנגלית וערבית',
        'בקרה בזמן אמת לבעלי החברה ולמנהלי עבודה בשטח',
      ],
      highlightTitle: 'חיסכון בזמן ניהול',
      highlightValue: 'עד 90%',
      highlightDesc: 'ללא כרטיסי נייר וללא ויכוחים על שעות בסוף החודש',
      accentColor: 'emerald',
      mockupType: 'overview',
    },
    {
      id: 2,
      badge: 'שלב 1 • הגדרת חברה ואתרי עבודה',
      title: 'הקמת אתרי עבודה על המפה תוך דקה אחת',
      subtitle:
        'סמנו את מיקום האתר על המפה וקבעו רדיוס כניסה מותר לעובדים במטרים.',
      bullets: [
        'חיפוש כתובת בישראל או בחירת נקודה ישירות על המפה האינטראקטיבית',
        'הגדרת רדיוס גיאופנס גמיש לכל אתר (למשל: 100 מ׳, 150 מ׳, 300 מ׳)',
        'הגדרת שעות משמרת בוקר, ערב ולילה לבחירת החברה',
        'שיוך עובדים לאתר אחד או למספר אתרי עבודה במקביל',
      ],
      highlightTitle: 'דיוק מיקום GPS',
      highlightValue: '±10 מ׳',
      highlightDesc: 'המערכת מחשבת בזמן אמת את מרחק העובד מאתר העבודה',
      accentColor: 'cyan',
      mockupType: 'sites',
    },
    {
      id: 3,
      badge: 'שלב 2 • חיבור עובדים בקליק',
      title: 'כניסת עובדים מהירה דרך קישור בוואטסאפ או קוד QR',
      subtitle:
        'העובדים לא צריכים לזכור סיסמאות — כניסה ישירה לפרופיל האישי בלחיצה אחת.',
      bullets: [
        'כפתור "שלח קישור בוואטסאפ" ישירות מרשימת העובדים בפאנל הניהול',
        'קוד QR אישי לסריקה מהירה באמצעות מצלמת הטלפון באתר',
        'התקנת אפליקציית PWA על מסך הבית של הטלפון בלחיצה אחת',
        'שיוך תפקיד, סוג משרה וראש צוות לכל עובד',
      ],
      highlightTitle: 'זמן חיבור עובד',
      highlightValue: '10 שניות',
      highlightDesc: 'לחיצה על הקישור בוואטסאפ — והעובד מוכן להחתים כניסה',
      accentColor: 'emerald',
      mockupType: 'whatsapp',
    },
    {
      id: 4,
      badge: 'שלב 3 • אפליקציית העובד בנייד',
      title: 'הגנה מפני לחיצה אקראית ועבודה גם ללא קליטת אינטרנט',
      subtitle:
        'ממשק נוח וברור בשפת העובד עם מנגנוני אבטחה מתקדמים.',
      bullets: [
        'החלקה לאישור (Slide-to-Confirm) למניעת החתמה בטעות בכיס',
        'טיימר משמרת חי וחיווי מרחק מדויק מאתר העבודה',
        'מצב אופליין (Offline): גם בחניון או במקלט ללא קליטה, ההחתמה נשמרת ומסתנכרנת אוטומטית',
        'שליחת הערות יומיות ודיווח הוצאות ישירות מהנייד',
      ],
      highlightTitle: 'אמינות שמירת נתונים',
      highlightValue: '24/7 אופליין',
      highlightDesc: 'אף משמרת לא הולכת לאיבוד גם כשאין קליטה סלולרית',
      accentColor: 'indigo',
      mockupType: 'worker_pwa',
    },
    {
      id: 5,
      badge: 'שלב 4 • בקרת GPS חכמה',
      title: '3 מצבי GPS מותאמים לכל סוגי העובדים',
      subtitle:
        'הגדירו לכל עובד את רמת הבקרה המתאימה לאופי העבודה שלו.',
      bullets: [
        '1. עובד נייד: החתמת כניסה ויציאה מכל מקום עם תיעוד קואורדינטות GPS',
        '2. GPS קפדני באתר: כניסה רק בתוך הרדיוס; בעת עזיבת האתר המשמרת נסגרת אוטומטית',
        '3. מעבר בין אתרים (Transit): בעת נסיעה מאתר א׳ לאתר ב׳ המערכת מזכה אוטומטית את זמן הנסיעה התקני וממשיכה את המשמרת',
        'סינון עצירות פרטיות: עצירה ארוכה מעבר לזמן הנסיעה התקני אינה משולמת כזמן עבודה',
      ],
      highlightTitle: 'סגירה אוטומטית ביציאה',
      highlightValue: 'GPS קפדני',
      highlightDesc: 'המונה נעצר אוטומטית ברגע שהעובד עוזב את שטח האתר',
      accentColor: 'amber',
      mockupType: 'gps_modes',
    },
    {
      id: 6,
      badge: 'שלב 5 • חוקי עבודה בישראל',
      title: 'חישוב אוטומטי של 125% / 150%, כניסת שבת, לילה והפסקות',
      subtitle:
        'כל החישובים מתבצעים לפי שעון ישראל (Asia/Jerusalem) בדיוק של דקה.',
      bullets: [
        'שעות נוספות: שעתיים ראשונות מעבר לתקן היומי — 125%, והיתרה — 150%',
        'סף שעות נוספות יומי ניתן להגדרה: 9.0 שעות (רגיל) או 8.6 / 8.5 שעות',
        'כניסת שבת ביום שישי ושבת: שעות עבודה ביום ו׳ לאחר שעת כניסת שבת וכל יום שבת נספרות כשעות שבת (150%)',
        'ניכוי הפסקת אוכל אוטומטי (30 דק׳) במשמרת של 6 שעות ומעלה ללא הפסקה',
      ],
      highlightTitle: 'פירוט שעות נוספות',
      highlightValue: '125% • 150%',
      highlightDesc: 'הפרדה מלאה בעמודות הדוח, ב-PDF ובקובץ ה-Excel (CSV)',
      accentColor: 'rose',
      mockupType: 'labor_law',
    },
    {
      id: 7,
      badge: 'שלב 6 • עובדים גלובליים וסידור עבודה',
      title: 'מעקב תקן שעות חודשי והתראות חכמות',
      subtitle:
        'לעובדים במשכורת גלובלית המערכת עוקבת אחר השלמת מכסת השעות החודשית.',
      bullets: [
        'הגדרת תקן שעות חודשי אישי (למשל 182 שעות) עם מד התקדמות',
        'התראה אוטומטית 3 ימי עבודה לפני סוף החודש במקרה של חוסר או חריגה בשעות',
        'טבלת סידור עבודה שבועית (בוקר, ערב, לילה, משמרת כפולה, חופש)',
        'אפשרות לסגירת משמרת אוטומטית בסיום שעת המשמרת המתוכננת',
      ],
      highlightTitle: 'התראה מראש',
      highlightValue: '3 ימים',
      highlightDesc: 'גם העובד וגם המנהל מקבלים התראה ברורה לפני סגירת החודש',
      accentColor: 'purple',
      mockupType: 'global_norm',
    },
    {
      id: 8,
      badge: 'שלב 7 • ממשקי שכר ודוחות לרואה חשבון',
      title: 'מתממשקת לתוכנת השכר ולכל מערכת בקליק אחד! (מיכפל, שיקלולית, Priority, ריווחית, חילן)',
      subtitle:
        'הפיקו קבצי קליטה תקניים לרואה החשבון או דוחות PDF ו-Excel בעברית בלחיצה אחת.',
      bullets: [
        '9 ממשקי שכר מובנים: מיכפל, שיקלולית (ט.מ.ל), Priority, ריווחית, חילן, הר-גל, עוקץ, Excel ו-API',
        'חלוקה אוטומטית לסמלי שכר מותאמים (100%, 125%, 150%, שבת, לילה והחזר הוצאות)',
        'הורדה מיידית של דוח PDF מעוצב ו-Excel בעברית + שליחה ישירה לרואה החשבון ב-WhatsApp',
        'חיבור REST API ישיר למערכות ERP ואוטומציה ארגונית',
      ],
      highlightTitle: 'ממשקי שכר מובנים',
      highlightValue: '9 מערכות + PDF',
      highlightDesc: 'מיכפל • שיקלולית • Priority • ריווחית • חילן • הר-גל • עוקץ • Excel • API',
      accentColor: 'emerald',
      mockupType: 'reports',
    },
    {
      id: 9,
      badge: 'אבטחת מידע והגנת פרטיות • AES-256',
      title: 'כל הנתונים מוצפנים ולעולם אינם מועברים לאף גורם חיצוני',
      subtitle:
        'הגנה מקסימלית על המידע האישי של העובדים ועל הסודיות המסחרית של החברה שלך.',
      bullets: [
        'הצפנה מתקדמת בתקן בנקאי AES-256-GCM: תעודות זהות ומספרי טלפון נשמרים במסד הנתונים אך ורק בצורה מוצפנת',
        'אי-העברת נתונים: המידע אינו נמכר, אינו משותף ואינו מועבר לצדדים שלישיים בשום פנים ואופן',
        'הסכמת פרטיות מתועדת: בכניסה הראשונה העובד מאשר את עיבוד הנתונים לצורך שכר בלבד עם חותמת זמן מדויקת',
        'סודיות מוחלטת: גישה לדוחות ולשעות מורשית אך ורק למנהלים המוסמכים של החברה',
      ],
      highlightTitle: 'תקן הצפנה מאובטח',
      highlightValue: 'AES-256',
      highlightDesc: '100% סודיות ואבטחה • המידע נשמר מוצפן ולעולם אינו מועבר לצד ג׳',
      accentColor: 'emerald',
      mockupType: 'security',
    },
  ],
  en: [
    {
      id: 1,
      badge: 'SYSTEM OVERVIEW • TICKWORK.CC',
      title: 'Smart Time Tracking & GPS Workforce Control in Israel',
      subtitle:
        'Automate timesheets, job-site geofencing, and Israeli payroll rules without expensive hardware.',
      bullets: [
        'Works instantly on any smartphone (iPhone / Android) and desktop browser',
        '100% compliant with Israeli labor regulations (Shabbat, 125% / 150% OT, breaks)',
        'Full multilingual interface & reports: Hebrew (עברית), Russian, English, Arabic',
        'Real-time visibility for company owners, managers, and site foremen',
      ],
      highlightTitle: 'Admin Time Saved',
      highlightValue: 'Up to 90%',
      highlightDesc: 'Zero paper timesheets or end-of-month hour disputes',
      accentColor: 'emerald',
      mockupType: 'overview',
    },
    {
      id: 2,
      badge: 'STEP 1 • COMPANY & WORK SITES SETUP',
      title: 'Add Geofenced Job Sites on the Map in 1 Minute',
      subtitle:
        'Pin your locations on the interactive map and set allowed clock-in radius in meters.',
      bullets: [
        'Search any address in Israel or click directly on the interactive map',
        'Custom geofence radius per work site (e.g., 100m, 150m, 300m)',
        'Configure Morning, Evening, and Night shift windows',
        'Assign employees to one or multiple active work sites',
      ],
      highlightTitle: 'Geofence Precision',
      highlightValue: 'GPS ±10m',
      highlightDesc: 'Real-time distance verification before allowing clock-in',
      accentColor: 'cyan',
      mockupType: 'sites',
    },
    {
      id: 3,
      badge: 'STEP 2 • INSTANT WORKER ONBOARDING',
      title: 'One-Tap Worker Login via WhatsApp Link or QR Code',
      subtitle:
        'No passwords to remember or forget — workers open their personal link and start.',
      bullets: [
        'Direct "Send via WhatsApp" button in the Employees table',
        'Personal QR code for instant camera scanning on site',
        '1-click PWA installation onto the phone home screen',
        'Assign job position, contract type, and responsible foreman',
      ],
      highlightTitle: 'Worker Setup Time',
      highlightValue: '10 sec',
      highlightDesc: 'Tap the WhatsApp link and clock in immediately',
      accentColor: 'emerald',
      mockupType: 'whatsapp',
    },
    {
      id: 4,
      badge: 'STEP 3 • WORKER MOBILE PWA APP',
      title: 'Pocket-Touch Protection & Full Offline Mode',
      subtitle:
        'Clean mobile interface in the worker’s native language with built-in safeguards.',
      bullets: [
        'Slide-to-Confirm gesture prevents accidental pocket clock-ins/outs',
        'Live shift timer and real-time geofence distance badge',
        'Offline Queue: clock-ins without cellular reception are saved locally and synced automatically',
        'Submit daily shift notes and expense receipts from the phone',
      ],
      highlightTitle: 'Reliability',
      highlightValue: '24/7 Offline',
      highlightDesc: 'Every punch is recorded even in underground parking or basements',
      accentColor: 'indigo',
      mockupType: 'worker_pwa',
    },
    {
      id: 5,
      badge: 'STEP 4 • INTELLIGENT GPS MODES',
      title: '3 GPS Enforcement Modes for Every Workflow',
      subtitle:
        'Choose the right GPS policy per employee with a single checkbox.',
      bullets: [
        '1. Mobile Worker: clock in/out from anywhere with GPS coordinate logging',
        '2. Strict Site GPS: clock in only inside site radius; leaving the site automatically stops the shift',
        '3. Multi-Site Transit: driving from Site A to Site B automatically credits normative road travel time and continues the shift',
        'Personal stop protection: excessive personal gaps are excluded from paid hours',
      ],
      highlightTitle: 'Auto Exit Control',
      highlightValue: 'Strict GPS',
      highlightDesc: 'Timer stops automatically when leaving the job site',
      accentColor: 'amber',
      mockupType: 'gps_modes',
    },
    {
      id: 6,
      badge: 'STEP 5 • ISRAELI LABOR LAW ENGINE',
      title: 'Automatic 125% / 150% Overtime, Shabbat, Night & Breaks',
      subtitle:
        'All calculations run in the Asia/Jerusalem timezone down to the exact minute.',
      bullets: [
        'Overtime Tiers: first 2 hours above daily threshold at 125%, remaining hours at 150%',
        'Configurable daily overtime threshold: 9.0h (standard) or 8.6h / 8.5h',
        'Friday Shabbat Entrance & Saturday: Friday hours after Shabbat entrance and all Saturday hours count at Shabbat rate (150%)',
        'Automatic 30-min lunch break deduction on shifts ≥ 6h without a 30m break',
      ],
      highlightTitle: 'Overtime Breakdown',
      highlightValue: '125% • 150%',
      highlightDesc: 'Separate columns in the dashboard, PDF, and Excel (CSV)',
      accentColor: 'rose',
      mockupType: 'labor_law',
    },
    {
      id: 7,
      badge: 'STEP 6 • GLOBAL EMPLOYEES & SCHEDULES',
      title: 'Monthly Contract Norm Tracking & Weekly Shift Matrix',
      subtitle:
        'Monitor monthly hour targets for global-salary employees automatically.',
      bullets: [
        'Custom monthly target (e.g., 182 hours) with visual progress bar',
        'Automatic alert 3 working days before month-end for underwork or overwork',
        'Weekly schedule matrix (Morning, Evening, Night, Double Shift, Day Off)',
        'Optional automatic shift closing at scheduled shift end time',
      ],
      highlightTitle: 'Early Warning Window',
      highlightValue: '3 Days',
      highlightDesc: 'Both worker and manager are alerted before the month closes',
      accentColor: 'purple',
      mockupType: 'global_norm',
    },
    {
      id: 8,
      badge: 'STEP 7 • PAYROLL INTEGRATIONS & REPORTS',
      title: '1-Click Integrations with Israeli Payroll (Michpal, Shiklolit, Priority, Rivhit, Hilan)',
      subtitle:
        'Direct export for accountants & ERPs: 9 native Israeli payroll connectors + PDF and Excel.',
      bullets: [
        'Native export files for: Michpal, Shiklolit (TML), Priority ERP, Rivhit, Hilan, Har-Gal, Okez',
        'Automatic salary component breakdown: 100%, 125%, 150%, Shabbat, Night hours & Expenses',
        'Instant PDF & Excel downloads + 1-click summary share to your accountant via WhatsApp',
        'Direct REST API endpoint to pull live monthly payroll into custom ERP, 1C or Make/Zapier',
      ],
      highlightTitle: 'Payroll Connectors',
      highlightValue: '9 Systems + PDF',
      highlightDesc: 'Michpal • Shiklolit • Priority • Rivhit • Hilan • Har-Gal • Okez • Excel • API',
      accentColor: 'emerald',
      mockupType: 'reports',
    },
    {
      id: 9,
      badge: 'SECURITY & PRIVACY • AES-256',
      title: 'All Data is Encrypted & Strictly Never Shared with Anyone',
      subtitle:
        'Bank-grade privacy protection for employee personal information and company records.',
      bullets: [
        'AES-256-GCM Encryption: personal IDs and phone numbers are stored encrypted at rest in the database',
        'Strict Privacy Guarantee: employee data is never sold, disclosed, or transferred to any third party under any circumstances',
        'Verified Employee Consent: workers explicitly review and accept data processing terms on first launch with timestamp audit',
        'Confidential & Compliant: only authorized company administrators have access to your shift and payroll reports',
      ],
      highlightTitle: 'Encryption Standard',
      highlightValue: 'AES-256',
      highlightDesc: '100% Confidential • Data is encrypted and never shared with 3rd parties',
      accentColor: 'emerald',
      mockupType: 'security',
    },
  ],
};

const UI_LABELS: Record<
  PresLang,
  {
    topBadge: string;
    backToApp: string;
    playBtn: string;
    pauseBtn: string;
    voiceOn: string;
    voiceOff: string;
    downloadVideoBtn: string;
    recordingVideo: string;
    slideOf: string;
    tryNowBtn: string;
  }
> = {
  ru: {
    topBadge: 'Видео-презентация и инструкция',
    backToApp: 'Назад на главную',
    playBtn: 'Авто-показ (Видео)',
    pauseBtn: 'Пауза',
    voiceOn: 'Озвучка ВКЛ',
    voiceOff: 'Озвучить слайды',
    downloadVideoBtn: 'Скачать видео (.WEBM)',
    recordingVideo: 'Генерация видео-файла...',
    slideOf: 'Карточка',
    tryNowBtn: 'Войти в систему',
  },
  he: {
    topBadge: 'מצגת וידאו ומדריך למשתמש',
    backToApp: 'חזרה לדף הבית',
    playBtn: 'ניגון אוטומטי (וידאו)',
    pauseBtn: 'השהה',
    voiceOn: 'קריינות פעילה',
    voiceOff: 'הפעל קריינות',
    downloadVideoBtn: 'הורד סרטון מצגת (.WEBM)',
    recordingVideo: 'מייצר קובץ וידאו...',
    slideOf: 'כרטיסייה',
    tryNowBtn: 'כניסה למערכת',
  },
  en: {
    topBadge: 'Video Presentation & User Guide',
    backToApp: 'Back to Home',
    playBtn: 'Auto-Play (Video)',
    pauseBtn: 'Pause',
    voiceOn: 'Voiceover ON',
    voiceOff: 'Enable Voiceover',
    downloadVideoBtn: 'Download Video (.WEBM)',
    recordingVideo: 'Rendering Video File...',
    slideOf: 'Card',
    tryNowBtn: 'Open System',
  },
};

export function PresentationPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<PresLang>('ru');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [slideProgress, setSlideProgress] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);

  const slides = SLIDES_DATA[lang];
  const currentSlide = slides[currentIdx] || slides[0]!;
  const labels = UI_LABELS[lang];
  const isRtl = lang === 'he';

  const SLIDE_DURATION_MS = 13000; // 13 seconds per slide allows comfortable reading
  const progressIntervalRef = useRef<number | null>(null);

  const speakSlide = useCallback(
    (slide: SlideItem, targetLang: PresLang) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const textToSpeak = `${slide.title}. ${slide.subtitle}. ${slide.bullets.join('. ')}`;
      const utter = new SpeechSynthesisUtterance(textToSpeak);
      utter.lang = targetLang === 'he' ? 'he-IL' : targetLang === 'ru' ? 'ru-RU' : 'en-US';
      utter.rate = 1.02;
      window.speechSynthesis.speak(utter);
    },
    []
  );

  useEffect(() => {
    if (voiceEnabled && currentSlide) {
      speakSlide(currentSlide, lang);
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [currentIdx, lang, voiceEnabled, currentSlide, speakSlide]);

  useEffect(() => {
    if (!isPlaying) {
      if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
      return;
    }

    const stepMs = 50;
    const increment = (stepMs / SLIDE_DURATION_MS) * 100;

    progressIntervalRef.current = window.setInterval(() => {
      setSlideProgress((prev) => {
        if (prev + increment >= 100) {
          setCurrentIdx((idx) => (idx + 1) % slides.length);
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => {
      if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, slides.length]);

  const handleSelectSlide = (idx: number) => {
    setCurrentIdx(idx);
    setSlideProgress(0);
  };

  const handlePrev = () => {
    setCurrentIdx((idx) => (idx - 1 + slides.length) % slides.length);
    setSlideProgress(0);
  };

  const handleNext = () => {
    setCurrentIdx((idx) => (idx + 1) % slides.length);
    setSlideProgress(0);
  };

  /**
   * Generates a real downloadable HD video (.webm) from all presentation cards using HTML5 Canvas + MediaRecorder
   */
  const handleDownloadVideo = async () => {
    if (isRecordingVideo) return;
    setIsRecordingVideo(true);
    setRecordingProgress(0);
    const wasPlaying = isPlaying;
    setIsPlaying(false);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      const stream = canvas.captureStream(30);
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
      ];
      const supportedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const recorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime, videoBitsPerSecond: 4_000_000 })
        : new MediaRecorder(stream);

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const stoppedPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: supportedMime || 'video/webm' }));
        };
      });

      recorder.start(100);

      const wrapText = (
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
        rtl: boolean
      ): number => {
        const words = text.split(' ');
        let line = '';
        let curY = y;
        ctx.textAlign = rtl ? 'right' : 'left';
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line.trim(), x, curY);
            line = words[n] + ' ';
            curY += lineHeight;
          } else {
            line = testLine;
          }
        }
        if (line.trim()) {
          ctx.fillText(line.trim(), x, curY);
          curY += lineHeight;
        }
        return curY;
      };

      const framesPerSlide = 180; // 6 seconds per slide in the video at 30fps
      const totalFrames = slides.length * framesPerSlide;

      for (let sIdx = 0; sIdx < slides.length; sIdx++) {
        const s = slides[sIdx]!;
        for (let f = 0; f < framesPerSlide; f++) {
          const globalFrame = sIdx * framesPerSlide + f;
          setRecordingProgress(Math.round((globalFrame / totalFrames) * 100));

          const slidePct = f / framesPerSlide;

          // 1. Background gradient
          const grad = ctx.createLinearGradient(0, 0, 1280, 720);
          grad.addColorStop(0, '#020617');
          grad.addColorStop(0.5, '#0f172a');
          grad.addColorStop(1, '#022c22');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 1280, 720);

          // 2. Top Brand Header
          ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
          ctx.fillRect(0, 0, 1280, 64);
          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('TickWork • Smart Time & GPS Attendance SaaS', 48, 40);

          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`${sIdx + 1} / ${slides.length}  |  tickwork.cc`, 1232, 40);

          // 3. Main Card Container
          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(48, 92, 1184, 560, 24);
          ctx.fill();
          ctx.stroke();

          const textStartX = isRtl ? 1184 : 96;
          const maxTextW = 740;

          // 4. Slide Badge
          ctx.fillStyle = '#34d399';
          ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
          ctx.textAlign = isRtl ? 'right' : 'left';
          ctx.fillText(s.badge, textStartX, 145);

          // 5. Title
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
          const afterTitleY = wrapText(s.title, textStartX, 195, maxTextW, 42, isRtl);

          // 6. Subtitle
          ctx.fillStyle = '#94a3b8';
          ctx.font = '20px system-ui, -apple-system, sans-serif';
          const afterSubY = wrapText(s.subtitle, textStartX, afterTitleY + 12, maxTextW, 28, isRtl);

          // 7. Bullets
          let bulletY = afterSubY + 26;
          ctx.font = '20px system-ui, -apple-system, sans-serif';
          for (let bIdx = 0; bIdx < s.bullets.length; bIdx++) {
            const bulletText = `✓  ${s.bullets[bIdx]}`;
            ctx.fillStyle = '#e2e8f0';
            bulletY = wrapText(bulletText, textStartX, bulletY, maxTextW, 28, isRtl) + 12;
          }

          // 8. Highlight KPI Box on the opposite side
          const boxX = isRtl ? 96 : 870;
          const boxY = 175;
          const boxW = 315;
          const boxH = 260;

          ctx.fillStyle = 'rgba(6, 78, 59, 0.45)';
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 20);
          ctx.fill();
          ctx.stroke();

          ctx.textAlign = 'center';
          ctx.fillStyle = '#a7f3d0';
          ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
          ctx.fillText(s.highlightTitle, boxX + boxW / 2, boxY + 55);

          ctx.fillStyle = '#34d399';
          ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
          ctx.fillText(s.highlightValue, boxX + boxW / 2, boxY + 125);

          ctx.fillStyle = '#cbd5e1';
          ctx.font = '16px system-ui, -apple-system, sans-serif';
          wrapText(s.highlightDesc, boxX + 24, boxY + 175, boxW - 48, 22, false);

          // 8b. For Slide 8 (Payroll & ERP Integrations), draw the 9 logos box in the video
          if (sIdx === 7) {
            const intX = boxX;
            const intY = boxY + boxH + 16;
            const intW = boxW;
            const intH = 165;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(intX, intY, intW, intH, 16);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#34d399';
            ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
              isRtl ? '9 ממשקי שכר ו-ERP מובנים' : '9 Native Payroll & ERP Connectors',
              intX + intW / 2,
              intY + 22
            );

            const sysNames = [
              'מיכפל',
              'שיקלולית',
              'Priority',
              'ריווחית',
              'חילן',
              'הר-גל',
              'עוקץ',
              'Excel',
              'API',
            ];
            const cols = 3;
            const cellW = (intW - 24) / cols;
            const cellH = 34;
            for (let i = 0; i < sysNames.length; i++) {
              const r = Math.floor(i / cols);
              const c = i % cols;
              const cx = intX + 12 + c * cellW;
              const cy = intY + 34 + r * (cellH + 6);
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.roundRect(cx + 2, cy, cellW - 4, cellH, 6);
              ctx.fill();
              ctx.fillStyle = '#0f172a';
              ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
              ctx.fillText(sysNames[i]!, cx + cellW / 2, cy + 21);
            }
          }

          // 9. Bottom Slide Progress Bar
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(48, 675, 1184, 10);
          ctx.fillStyle = '#10b981';
          const totalPct = (sIdx + slidePct) / slides.length;
          ctx.fillRect(48, 675, 1184 * totalPct, 10);

          await new Promise((r) => setTimeout(r, 25));
        }
      }

      recorder.stop();
      const videoBlob = await stoppedPromise;
      const ext = supportedMime.includes('mp4') ? 'mp4' : 'webm';
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TickWork_Presentation_${lang.toUpperCase()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Video export error:', err);
    } finally {
      setIsRecordingVideo(false);
      setRecordingProgress(0);
      setIsPlaying(wasPlaying);
    }
  };

  const renderVisualMockup = (type: SlideItem['mockupType']) => {
    switch (type) {
      case 'overview':
        return (
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white">Live Dashboard • Asia/Jerusalem</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                tickwork.cc
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">На смене сейчас / במשמרת</div>
                <div className="text-xl font-black text-emerald-400 mt-0.5">18 / 22</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">Активных объектов / אתרים</div>
                <div className="text-xl font-black text-cyan-400 mt-0.5">6 GPS</div>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs">
              <span className="text-emerald-200 font-medium">✓ Авто-расчёт 125% / 150% и Шаббат</span>
              <span className="font-mono font-bold text-emerald-400">100%</span>
            </div>
          </div>
        );

      case 'sites':
        return (
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
            <div className="relative h-28 rounded-xl bg-gradient-to-br from-slate-900 via-teal-950/50 to-slate-900 border border-cyan-500/30 flex items-center justify-center overflow-hidden">
              <div className="w-24 h-24 rounded-full bg-emerald-500/15 border-2 border-dashed border-emerald-400/70 flex items-center justify-center animate-pulse">
                <div className="w-9 h-9 rounded-full bg-emerald-500/30 flex items-center justify-center text-emerald-300 shadow-lg">
                  <MapPin className="w-4 h-4" />
                </div>
              </div>
              <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[11px] bg-slate-950/90 px-2 py-0.5 rounded-lg border border-slate-800">
                <span className="text-white font-semibold truncate">📍 נאות התיכון / Объект Центр</span>
                <span className="text-emerald-400 font-mono font-bold shrink-0">R = 150m</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              <span>Статус геозоны:</span>
              <span className="text-emerald-400 font-bold">Внутри зоны (12м) ✓</span>
            </div>
          </div>
        );

      case 'whatsapp':
        return (
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-emerald-300 font-bold">
                <span className="flex items-center gap-1">
                  <Share2 className="w-3.5 h-3.5" /> WhatsApp приглашение
                </span>
                <span>10:15 ✓✓</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                שלום! הנה הקישור האישי שלך לדיווח שעות:
                <br />
                <span className="text-emerald-400 underline font-mono">
                  https://tickwork.cc/w/E4821
                </span>
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-400" /> Без паролей и App Store
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[11px]">
                1 клик
              </span>
            </div>
          </div>
        );

      case 'worker_pwa':
        return (
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="text-center py-2 bg-slate-900 rounded-xl border border-slate-800">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Таймер активной смены</div>
              <div className="text-2xl font-mono font-black text-emerald-400 mt-0.5">06:42:19</div>
            </div>
            <div className="h-11 rounded-xl bg-emerald-950/80 border border-emerald-500/40 p-1 flex items-center relative">
              <div className="w-9 h-9 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shadow">
                »
              </div>
              <span className="w-full text-center text-xs font-bold text-emerald-200 pr-6">
                Проведите для входа / החלק לכניסה
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>🛡️ Защита от нажатия в кармане</span>
              <span className="text-emerald-400">⚡ Офлайн-очередь</span>
            </div>
          </div>
        );

      case 'gps_modes':
        return (
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-blue-500/30 flex items-center justify-between">
              <span className="font-semibold text-blue-300">1. Мобильный (נייד)</span>
              <span className="text-[11px] text-slate-400">Любая точка + GPS</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center justify-between">
              <span className="font-semibold text-amber-300">2. Строгий GPS (GPS קפדני)</span>
              <span className="text-[11px] text-amber-200">Авто-стоп при выезде</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-cyan-500/40 flex items-center justify-between">
              <span className="font-semibold text-cyan-300">3. Между объектами (מעבר אתרים)</span>
              <span className="text-[11px] text-cyan-200">Объект А ➔ Дорога ➔ Объект Б</span>
            </div>
          </div>
        );

      case 'labor_law':
        return (
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-300">Обычные часы (100%)</span>
              <span className="font-mono font-bold text-emerald-400">09.00 ч</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <span className="text-amber-200 font-semibold">Сверхурочные 125% (первые 2ч)</span>
              <span className="font-mono font-bold text-amber-300">02.00 ч</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-rose-500/10 border border-rose-500/30">
              <span className="text-rose-200 font-semibold">Сверхурочные 150% + Шаббат</span>
              <span className="font-mono font-bold text-rose-300">01.50 ч</span>
            </div>
          </div>
        );

      case 'global_norm':
        return (
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-indigo-300 font-bold flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4" /> Глобальная норма месяца
              </span>
              <span className="font-mono font-bold text-white">164 / 182 ч (90%)</span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: '90%' }} />
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
              ⚠️ До конца месяца осталось 3 рабочих дня (недоработка 18 ч до нормы 182 ч)
            </div>
          </div>
        );

      case 'reports':
        return (
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {lang === 'he'
                    ? 'מתממשקת לתוכנת השכר בקליק אחד!'
                    : lang === 'en'
                      ? '1-Click Payroll & ERP Integrations'
                      : 'Интеграция с программами зарплаты в 1 клик'}
                </span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                9 систем
              </span>
            </div>

            {/* 9 System Visual Badges Grid */}
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-white rounded-lg p-1.5 shadow-sm border border-slate-200 flex flex-col items-center justify-center">
                <div className="text-[11px] font-black text-sky-900 leading-none">מיכפל</div>
                <div className="h-0.5 w-6 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 mt-0.5" />
              </div>
              <div className="bg-white rounded-lg p-1.5 shadow-sm border border-slate-200 flex flex-col items-center justify-center">
                <div className="text-[9px] font-black text-blue-700 leading-none">ט.מ.ל שיקלולית</div>
              </div>
              <div className="bg-white rounded-lg p-1.5 shadow-sm border border-slate-200 flex items-center justify-center gap-1">
                <span className="w-2 h-2 rounded bg-indigo-600 inline-block" />
                <span className="text-[10px] font-extrabold text-slate-900 leading-none">Priority</span>
              </div>
              <div className="bg-white rounded-lg p-1.5 shadow-sm border border-slate-200 flex items-center justify-center gap-1">
                <span className="text-[10px] font-black text-slate-900 leading-none">ריווחית</span>
                <span className="w-2 h-2 rounded bg-amber-500 inline-block" />
              </div>
              <div className="bg-white rounded-lg p-1.5 shadow-sm border border-slate-200 flex flex-col items-center justify-center">
                <div className="text-[10px] font-black text-emerald-800 leading-none">חילן HILAN</div>
              </div>
              <div className="bg-white rounded-lg p-1.5 shadow-sm border border-slate-200 flex items-center justify-center gap-1">
                <span className="text-[10px] font-black text-slate-800 leading-none">הר-גל</span>
                <span className="w-2 h-2 rounded-full border border-orange-500 inline-block" />
              </div>
              <div className="bg-white rounded-lg p-1.5 shadow-sm border border-slate-200 flex flex-col items-center justify-center">
                <div className="text-[10px] font-black text-rose-700 leading-none">עוקץ</div>
              </div>
              <div className="bg-white rounded-lg p-1.5 shadow-sm border border-slate-200 flex items-center justify-center gap-1">
                <span className="w-3.5 h-3.5 rounded bg-emerald-700 text-white font-black text-[8px] flex items-center justify-center">
                  X
                </span>
                <span className="text-[10px] font-black text-emerald-900 leading-none">Excel</span>
              </div>
              <div className="bg-white rounded-lg p-1.5 shadow-sm border border-slate-200 flex items-center justify-center gap-1">
                <span className="w-3.5 h-3.5 rounded-full bg-sky-600 text-white font-mono text-[7px] font-black flex items-center justify-center">
                  {'</>'}
                </span>
                <span className="text-[10px] font-black text-slate-900 leading-none">API</span>
              </div>
            </div>

            <div className="flex gap-1.5 pt-1">
              <div className="flex-1 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-center text-[10px] font-bold">
                ✓ סמלי שכר (100%, 125%, 150%, שבת)
              </div>
              <div className="flex-1 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-center text-[10px] font-bold">
                📲 שליחה לרו״ח בוואטסאפ
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="bg-slate-950/90 border border-emerald-500/40 rounded-2xl p-4 space-y-3 shadow-lg shadow-emerald-950/30">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-white">AES-256-GCM Vault</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ENCRYPTED
              </span>
            </div>

            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Employee ID:</span>
                <span className="text-emerald-400 font-semibold truncate max-w-[190px]">
                  enc:v1:9a8f...4e21 (AES)
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Phone:</span>
                <span className="text-emerald-400 font-semibold truncate max-w-[190px]">
                  enc:v1:7f3b...11a9 (AES)
                </span>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-200">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Никакой передачи третьим лицам</span>
              </span>
              <span className="font-bold text-emerald-400">100% Защита</span>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-slate-950 text-white flex flex-col justify-between relative overflow-hidden"
    >
      {/* Background ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      {/* 1. Top Control Bar */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-900/75 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>{labels.backToApp}</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{labels.topBadge}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs font-bold">
              {(
                [
                  { code: 'ru', label: 'RU' },
                  { code: 'he', label: 'עברית' },
                  { code: 'en', label: 'EN' },
                ] as const
              ).map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setLang(item.code);
                    setSlideProgress(0);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    lang === item.code
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Voiceover Toggle */}
            <button
              type="button"
              onClick={() => setVoiceEnabled((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                voiceEnabled
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">
                {voiceEnabled ? labels.voiceOn : labels.voiceOff}
              </span>
            </button>

            {/* Play / Pause Button */}
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                isPlaying
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? labels.pauseBtn : labels.playBtn}</span>
            </button>

            {/* Download Real Video File (.WEBM / .MP4) */}
            <button
              type="button"
              disabled={isRecordingVideo}
              onClick={handleDownloadVideo}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950 transition"
            >
              {isRecordingVideo ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {labels.recordingVideo} ({recordingProgress}%)
                  </span>
                </>
              ) : (
                <>
                  <Video className="w-3.5 h-3.5" />
                  <span>{labels.downloadVideoBtn}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Animated Video Card Stage */}
      <main className="relative z-10 flex-1 flex flex-col justify-start pt-3 sm:pt-5 pb-6 max-w-6xl w-full mx-auto px-4 sm:px-8">
        {/* Top Segmented Video Story Progress Bar */}
        <div className="grid grid-cols-9 gap-1.5 mb-5 shrink-0" dir="ltr">
          {slides.map((s, idx) => {
            const pct =
              idx < currentIdx ? 100 : idx === currentIdx ? slideProgress : 0;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectSlide(idx)}
                className="group text-left focus:outline-none"
              >
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700/60">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-75"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div
                  className={`text-[10px] font-mono mt-1 truncate ${
                    idx === currentIdx ? 'text-emerald-400 font-bold' : 'text-slate-500'
                  }`}
                >
                  0{idx + 1}
                </div>
              </button>
            );
          })}
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden min-h-[580px] lg:min-h-[610px] flex flex-col justify-between transition-all duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1">
            {/* Left / Main Text Column */}
            <div className="lg:col-span-7 flex flex-col space-y-3.5">
              <div className="h-7 flex items-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold tracking-wider uppercase">
                  <span>{currentSlide.badge}</span>
                </div>
              </div>

              <div className="min-h-[4.25rem] sm:min-h-[5rem] flex items-center">
                <h1 className="text-2xl sm:text-3xl lg:text-3xl font-black text-white leading-tight">
                  {currentSlide.title}
                </h1>
              </div>

              <div className="min-h-[2.5rem] sm:min-h-[3rem] flex items-center">
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  {currentSlide.subtitle}
                </p>
              </div>

              <ul className="space-y-2.5 pt-1 min-h-[210px] sm:min-h-[230px] flex flex-col justify-start">
                {currentSlide.bullets.map((b, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 bg-slate-950/60 border border-slate-800/80 p-2.5 sm:p-3 rounded-2xl"
                  >
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right / Visual Card & KPI Highlight */}
            <div className="lg:col-span-5 flex flex-col space-y-4">
              {/* Interactive UI Mockup Container */}
              <div className="h-[210px] flex flex-col justify-center">
                {renderVisualMockup(currentSlide.mockupType)}
              </div>

              {/* Key Metric Highlight Card */}
              <div className="h-[155px] p-5 rounded-2xl bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/30 text-center shadow-lg flex flex-col justify-center items-center">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  {currentSlide.highlightTitle}
                </div>
                <div className="text-3xl sm:text-4xl font-black text-white my-1.5 font-mono">
                  {currentSlide.highlightValue}
                </div>
                <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed line-clamp-2">
                  {currentSlide.highlightDesc}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Card Navigation Controls */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition"
                title="Previous"
              >
                <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
              </button>
              <span className="text-xs font-mono font-bold text-slate-300 px-3">
                {labels.slideOf} {currentIdx + 1} / {slides.length}
              </span>
              <button
                type="button"
                onClick={handleNext}
                className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition shadow"
                title="Next"
              >
                <ChevronRight className="w-5 h-5 rtl:rotate-180" />
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-950 transition active:scale-95"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{labels.tryNowBtn}</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

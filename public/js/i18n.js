/**
 * i18n Module — Internationalization for Luach Vestot.
 * Supports Hebrew (he) and English (en).
 * Hebrew uses neutral/masculine forms (not feminine).
 */
var I18n = (function() {
  'use strict';

  var currentLang = localStorage.getItem('lang') || 'he';

  var translations = {
    he: {
      // App / Nav
      app_title: 'לוח וסתות',
      nav_calendar: 'לוח',
      nav_history: 'היסטוריה',
      nav_settings: 'הגדרות',
      nav_admin: 'ניהול',
      nav_logout: 'יציאה',
      // Auth
      auth_login_title: 'כניסה',
      auth_email: 'דוא"ל',
      auth_password: 'סיסמה',
      auth_login_btn: 'כניסה',
      auth_forgot: 'שכחתי סיסמה',
      auth_no_account: 'אין לך חשבון?',
      auth_register_link: 'הרשמה',
      auth_register_title: 'הרשמה',
      auth_confirm_password: 'אימות סיסמה',
      auth_register_btn: 'הרשמה',
      auth_has_account: 'יש לך חשבון?',
      auth_login_link: 'כניסה',
      auth_terms_agree: 'קראתי ואני מסכים ל',
      auth_terms_link: 'תנאי השימוש ומדיניות הפרטיות',
      // Calendar
      cal_showing_hebrew: 'מציג: עברי',
      cal_showing_greg: 'מציג: לועזי',
      cal_reiyah: 'ראיה',
      cal_nekiim: 'נקיים',
      cal_tevilah: 'טבילה',
      cal_greg_months: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
      cal_day_names: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
      // URLs
      url_terms: '/terms.html',
      url_api_docs: '#api-docs',
      // History
      hist_title: 'היסטוריית וסתות',
      hist_add_title: 'הוספת וסת',
      hist_edit_title: 'עריכת וסת',
      hist_date_onah: 'תאריך ועונה',
      hist_pick_date: 'בחירת תאריך',
      hist_sunset_label: 'שקיעה ביום זה',
      hist_add_btn: 'הוסף',
      hist_update_btn: 'עדכן',
      hist_cancel_btn: 'ביטול',
      hist_col_heb_date: 'תאריך עברי',
      hist_col_greg_date: 'תאריך לועזי',
      hist_col_onah: 'עונה',
      hist_col_interval: 'הפלגה (ימים)',
      hist_col_actions: 'פעולות',
      hist_table_nav: 'טבלת וסתות',
      hist_empty: 'אין וסתות רשומות עדיין.',
      hist_edit: 'עריכה',
      hist_delete: 'מחיקה',
      hist_delete_confirm: 'האם למחוק וסת זו?',
      hist_delete_btn: 'מחק',
      hist_export: '📥 ייצוא נתונים (JSON)',
      hist_import_title: 'ייבוא וסתות קודמות',
      hist_import_desc: 'הוסף שורות עם תאריך עברי ועונה. לחץ + להוספת שורה נוספת.',
      hist_import_add_row: '+ הוסף שורה',
      hist_import_btn: 'ייבוא',
      hist_onah_day: 'יום ☀️',
      hist_onah_night: 'לילה 🌙',
      // Nekiim
      nekiim_title: 'שבעה נקיים',
      nekiim_desc: 'ספירת שבעה נקיים לאחר הפסק טהרה.',
      nekiim_empty: 'אין ספירות פעילות. לחץ על 7️⃣ ליד וסת להתחיל ספירה.',
      nekiim_hefsek: 'הפסק טהרה',
      nekiim_tevilah: 'טבילה: ליל',
      nekiim_delete_btn: '✕ מחיקה',
      nekiim_delete_confirm: 'למחוק את הספירה?',
      nekiim_checks: 'בדיקות',
      nekiim_pick_hefsek: 'בחירת תאריך הפסק טהרה',
      nekiim_pick_desc: '7 הנקיים מתחילים למחרת יום ההפסק.',
      nekiim_start_btn: 'התחל ספירה',
      // Datepicker
      dp_pick_onah: 'בחירת עונה:',
      dp_day: '☀️ יום',
      dp_night: '🌙 לילה',
      // Settings
      settings_title: 'הגדרות',
      settings_posek_title: 'בחירת פוסק',
      settings_posek_desc: 'הבחירה בפוסק משפיעה על אופן חישוב הווסתות ועל הימים שבהם יש לפרוש.',
      settings_rama: 'רמ״א',
      settings_rama_desc: 'מנהג אשכנז — מחמיר יותר בחישוב הווסתות',
      settings_mechaber: 'מחבר',
      settings_mechaber_desc: 'מנהג ספרד — פוסק לפי השולחן ערוך',
      settings_advanced: 'הגדרות מתקדמות',
      settings_beinonit31: 'עונה בינונית 31 — פרישה גם ביום ה-31',
      settings_orzarua: 'עונת אור זרוע — פרישה גם בעונה ההפוכה',
      settings_haflagah3: 'הפלגה שלישית — זכירת שלוש הפלגות אחרונות',
      settings_hachodesh: 'וסת החודש בל\' מלא לפני חסר — פרישה בא\' של החודש הבא',
      settings_encryption: 'מצב הצפנה',
      settings_reminders: 'תזכורות באימייל',
      settings_reminders_desc: 'קבל תזכורת יומית לפני ימי פרישה (נשלח ב-16:00). ניתן להוסיף כתובות נוספות.',
      settings_reminders_enable: 'הפעל תזכורות באימייל',
      settings_email_list: 'כתובות מייל לתזכורות:',
      settings_email_add: 'הוסף ואמת',
      settings_nekiim_title: 'שבעה נקיים',
      settings_nekiim_desc: 'הגדרות הקשורות לספירת שבעה נקיים.',
      settings_nekiim_reminder: 'תזכורת מייל לבדיקות — פעמיים ביום: לפני השקיעה ובבוקר',
      settings_nekiim_calendar: 'הצגת ימי נקיים בלוח — סימון ימי ספירה בלוח השנה',
      settings_location: 'מיקום (לחישוב שקיעה/זריחה)',
      settings_location_desc: 'הזן מיקום לקבלת זמני שקיעה וזריחה מדויקים לאזורך.',
      settings_city: 'עיר',
      settings_city_placeholder: 'בחר עיר',
      settings_apikey: 'מפתח API',
      settings_apikey_desc: 'מפתח API מאפשר גישה תכנותית למערכת (לכלי AI, אוטומציות וכו\').',
      settings_apikey_reveal: 'צפה ב-API Key',
      settings_apikey_hide: 'הסתר',
      settings_apikey_copy: 'העתק',
      settings_apikey_generate: 'צור מפתח חדש',
      settings_saved: 'ההגדרות נשמרו בהצלחה ✓',
      settings_nekiim_saved: 'הגדרות 7 נקיים נשמרו ✓',
      hist_import_row_error: 'שורה {num}: נא לבחור תאריך',
      hist_import_success: 'יובאו {count} וסתות',
      hist_import_skipped: '({count} דולגו)',
      hist_mechitza: '✂️ מחיצה — איפוס ספירת הפלגות',
      hist_mechitza_remove: 'הסר',
      hist_mechitza_title: 'הוסף מחיצה אחרי וסת זו',
      hist_nekiim_btn_title: 'התחל שבעה נקיים',
      hist_nekiim_delete_title: 'מחיקת ספירה',
      settings_key_created: 'מפתח חדש נוצר ✓',
      settings_key_not_created: 'לא נוצר עדיין',
      settings_reminder_saved: 'הגדרות תזכורת נשמרו ✓',
      settings_location_saved: 'מיקום נשמר ✓',
      settings_lang: 'שפה',
      settings_verified: '✓ מאומת',
      settings_pending: 'ממתין לאימות',
      settings_apikey_docs_link: 'תיעוד API →',
      // Encryption
      enc_e2e_title: '🔒 מצב E2E (הצפנה מקצה לקצה)',
      enc_e2e_desc: 'הנתונים מוצפנים באופן מוחלט. רק סיסמתך יכולה לפענח אותם. תזכורות באימייל, API ו-MCP אינם זמינים במצב זה.',
      enc_enable_extended: 'הפעל גישה מורחבת (API + תזכורות)',
      enc_extended_title: '🔔 מצב מורחב (API + תזכורות)',
      enc_extended_desc: 'תזכורות באימייל, API ו-MCP פעילים. המערכת מסוגלת לעבד את הנתונים באופן אוטומטי.',
      enc_disable_extended: 'חזרה למצב E2E (ביטול גישה מורחבת)',
      enc_disable_confirm: 'חזרה למצב E2E תבטל תזכורות באימייל וגישת API. להמשיך?',
      enc_confirm_title: 'שינוי מצב הצפנה',
      enc_confirm_p1: 'הנתונים שלך מוצפנים כעת בשיטת הצפנה מקצה לקצה (E2E) — המערכת אינה יכולה לגשת אליהם ללא סיסמתך.',
      enc_confirm_p2: 'הפעלת תזכורות ו/או גישת API דורשת מעבר לשיטת הצפנה שבה המערכת מסוגלת לעבד את הנתונים באופן אוטומטי. האימייל אינו נשמר במערכת ושום אדם אינו רואה אותו מלבדך.',
      enc_confirm_p3: 'המערכת אינה נושאת באחריות למקרה של פגיעה בסודיות הנתונים בשל הפעלת שירות זה.',
      enc_confirm_p4: 'ניתן לבטל בכל עת — ביטול מחזיר את ההצפנה למצב E2E.',
      enc_confirm_yes: 'אני מאשר',
      enc_confirm_no: 'ביטול',
      enc_enabled_msg: 'גישה מורחבת הופעלה ✓',
      // Cities
      city_jerusalem: 'ירושלים',
      city_tel_aviv: 'תל אביב',
      city_haifa: 'חיפה',
      city_beer_sheva: 'באר שבע',
      city_tzfat: 'צפת',
      city_ashdod: 'אשדוד',
      city_eilat: 'אילת',
      city_netanya: 'נתניה',
      city_bet_shemesh: 'בית שמש',
      city_maale_adumim: 'מעלה אדומים',
      city_select: 'בחר עיר',
      // Admin
      admin_title: 'ניהול מערכת',
      admin_stats: 'סטטיסטיקות',
      admin_registration: 'הרשמה',
      admin_registration_open: 'הרשמה פתוחה — משתמשים חדשים יכולים להירשם',
      admin_users: 'משתמשים',
      admin_col_id: '#',
      admin_col_email: 'דוא"ל',
      admin_col_registered: 'הרשמה',
      admin_col_actions: 'פעולות',
      admin_delete: 'מחיקה',
      admin_delete_confirm: 'למחוק את {email}?\nכל הנתונים יימחקו לצמיתות.',
      admin_grant_admin: '+ admin',
      admin_revoke_admin: '- admin',
      admin_stat_users: 'משתמשים',
      admin_stat_with_data: 'עם נתונים',
      admin_stat_new_7d: 'חדשים (7 ימים)',
      admin_stat_db_size: 'גודל DB',
      // Legend
      legend_beinonit: 'עונה בינונית',
      legend_haflagah: 'הפלגה',
      legend_hachodesh: 'וסת החודש',
      legend_az: 'א״ז (אור זרוע)',
      legend_kavua: 'וסת קבועה',
      // Footer
      footer_terms: 'תנאי שימוש ומדיניות פרטיות מלאה →',
      footer_api_docs: 'תיעוד API',
      footer_privacy: 'מדיניות פרטיות',
      // API Docs
      api_docs_title: 'תיעוד API',
      api_docs_desc: 'ה-API מאפשר גישה תכנותית לכל הפונקציות של לוח וסתות.',
      // Misc
      confirm_cancel: 'ביטול',
      dark_mode: 'מצב כהה/בהיר',
      error_generic: 'שגיאה',
      error_save: 'שגיאה בשמירה',
      error_export: 'שגיאה בייצוא',
      error_import: 'שגיאה בייבוא',
      error_update: 'שגיאה בעדכון',
      error_add: 'שגיאה בהוספה',
      error_unknown: 'שגיאה לא ידועה',
      error_enter_email: 'נא להזין כתובת מייל',
      error_enter_valid_email: 'נא להזין כתובת מייל תקינה',
      error_enter_cycle: 'נא להזין לפחות וסת אחת',
      error_fill_fields: 'נא למלא את כל השדות',
      error_login: 'שגיאה בכניסה',
      error_register: 'שגיאה בהרשמה',
      error_passwords_mismatch: 'הסיסמאות אינן תואמות',
      error_password_short: 'הסיסמה חייבת להכיל לפחות 6 תווים',
      error_accept_terms: 'יש לאשר את תנאי השימוש',
      error_pick_date: 'נא לבחור תאריך',
      msg_copied: 'הועתק ✓',
      msg_email_sent: 'מייל אימות נשלח ✓',
      msg_reset_sent: 'נשלח קישור לאיפוס',
      msg_no_emails: 'לא הוגדרו כתובות. הוסף כתובת מייל למטה.',
      confirm_new_key: 'ייווצר מפתח חדש. המפתח הישן יפסיק לעבוד. להמשיך?',
      confirm_delete_user: 'למחוק את {email}?\nכל הנתונים יימחקו לצמיתות.',
      confirm_grant_admin: 'להפוך את {email} לאדמין?',
      confirm_revoke_admin: 'להסיר הרשאות אדמין מ-{email}?'
    },

    en: {
      // App / Nav
      app_title: 'Luach Vestot',
      nav_calendar: 'Calendar',
      nav_history: 'History',
      nav_settings: 'Settings',
      nav_admin: 'Admin',
      nav_logout: 'Logout',
      // Auth
      auth_login_title: 'Login',
      auth_email: 'Email',
      auth_password: 'Password',
      auth_login_btn: 'Login',
      auth_forgot: 'Forgot password',
      auth_no_account: 'No account?',
      auth_register_link: 'Register',
      auth_register_title: 'Register',
      auth_confirm_password: 'Confirm password',
      auth_register_btn: 'Register',
      auth_has_account: 'Have an account?',
      auth_login_link: 'Login',
      auth_terms_agree: 'I agree to the ',
      auth_terms_link: 'Terms of Service & Privacy Policy',
      // Calendar
      cal_showing_hebrew: 'Showing: Hebrew',
      cal_showing_greg: 'Showing: Gregorian',
      cal_reiyah: 'Sighting',
      cal_nekiim: 'Clean',
      cal_tevilah: 'Tevilah',
      cal_greg_months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      cal_day_names: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      // URLs
      url_terms: '/terms-en.html',
      url_api_docs: '#api-docs',
      // History
      hist_title: 'Cycle History',
      hist_add_title: 'Add Cycle',
      hist_edit_title: 'Edit Cycle',
      hist_date_onah: 'Date & Period',
      hist_pick_date: 'Pick a date',
      hist_sunset_label: 'Sunset today',
      hist_add_btn: 'Add',
      hist_update_btn: 'Update',
      hist_cancel_btn: 'Cancel',
      hist_col_heb_date: 'Hebrew Date',
      hist_col_greg_date: 'Gregorian Date',
      hist_col_onah: 'Period',
      hist_col_interval: 'Interval (days)',
      hist_col_actions: 'Actions',
      hist_table_nav: 'Cycles',
      hist_empty: 'No cycles recorded yet.',
      hist_edit: 'Edit',
      hist_delete: 'Delete',
      hist_delete_confirm: 'Delete this cycle?',
      hist_delete_btn: 'Delete',
      hist_export: '📥 Export Data (JSON)',
      hist_import_title: 'Import Past Cycles',
      hist_import_desc: 'Add rows with Hebrew date and period. Press + to add a row.',
      hist_import_add_row: '+ Add Row',
      hist_import_btn: 'Import',
      hist_onah_day: 'Day ☀️',
      hist_onah_night: 'Night 🌙',
      // Nekiim
      nekiim_title: 'Seven Clean Days',
      nekiim_desc: 'Counting seven clean days after Hefsek Taharah.',
      nekiim_empty: 'No active counts. Press 7️⃣ next to a cycle to start counting.',
      nekiim_hefsek: 'Hefsek Taharah',
      nekiim_tevilah: 'Tevilah: Night of',
      nekiim_delete_btn: '✕ Delete',
      nekiim_delete_confirm: 'Delete this count?',
      nekiim_checks: 'checks',
      nekiim_pick_hefsek: 'Pick Hefsek Taharah Date',
      nekiim_pick_desc: 'The 7 clean days start the day after the Hefsek.',
      nekiim_start_btn: 'Start Counting',
      // Datepicker
      dp_pick_onah: 'Pick period:',
      dp_day: '☀️ Day',
      dp_night: '🌙 Night',
      // Settings
      settings_title: 'Settings',
      settings_posek_title: 'Posek Selection',
      settings_posek_desc: 'The posek choice affects how vestot are calculated and which days require separation.',
      settings_rama: 'רמ״א (Rama)',
      settings_rama_desc: 'Ashkenazi custom — stricter veset calculations',
      settings_mechaber: 'מחבר (Mechaber)',
      settings_mechaber_desc: 'Sephardi custom — rules per Shulchan Aruch',
      settings_advanced: 'Advanced Settings',
      settings_beinonit31: 'Onah Beinonit 31 — also separate on day 31',
      settings_orzarua: 'Or Zarua — also separate on opposite period',
      settings_haflagah3: 'Third Haflagah — remember three most recent intervals',
      settings_hachodesh: 'Hachodesh overflow — separate on 1st of next month when 30-day month precedes 29-day',
      settings_encryption: 'Encryption Mode',
      settings_reminders: 'Email Reminders',
      settings_reminders_desc: 'Get a daily reminder before separation days (sent at 16:00). You can add additional addresses.',
      settings_reminders_enable: 'Enable email reminders',
      settings_email_list: 'Reminder email addresses:',
      settings_email_add: 'Add & Verify',
      settings_nekiim_title: 'Seven Clean Days',
      settings_nekiim_desc: 'Settings related to the seven clean days count.',
      settings_nekiim_reminder: 'Email reminder for checks — twice daily: before sunset & morning',
      settings_nekiim_calendar: 'Show clean days on calendar — mark counting days on the calendar',
      settings_location: 'Location (sunset/sunrise)',
      settings_location_desc: 'Enter your location for accurate sunset and sunrise times.',
      settings_city: 'City',
      settings_city_placeholder: 'Select city',
      settings_apikey: 'API Key',
      settings_apikey_desc: 'API key enables programmatic access to the system (AI tools, automations, etc.).',
      settings_apikey_reveal: 'Show API Key',
      settings_apikey_hide: 'Hide',
      settings_apikey_copy: 'Copy',
      settings_apikey_generate: 'Generate New Key',
      settings_saved: 'Settings saved ✓',
      settings_nekiim_saved: '7 Nekiim settings saved ✓',
      hist_import_row_error: 'Row {num}: please pick a date',
      hist_import_success: '{count} cycles imported',
      hist_import_skipped: '({count} skipped)',
      hist_mechitza: '✂️ Mechitza — haflagah reset',
      hist_mechitza_remove: 'Remove',
      hist_mechitza_title: 'Add mechitza after this cycle',
      hist_nekiim_btn_title: 'Start seven clean days',
      hist_nekiim_delete_title: 'Delete count',
      settings_key_created: 'New key created ✓',
      settings_key_not_created: 'Not created yet',
      settings_reminder_saved: 'Reminder settings saved ✓',
      settings_location_saved: 'Location saved ✓',
      settings_lang: 'Language',
      settings_verified: '✓ Verified',
      settings_pending: 'Pending verification',
      settings_apikey_docs_link: 'API Docs →',
      // Encryption
      enc_e2e_title: '🔒 E2E Mode (End-to-End Encryption)',
      enc_e2e_desc: 'Data is fully encrypted. Only your password can decrypt it. Email reminders, API, and MCP are not available in this mode.',
      enc_enable_extended: 'Enable Extended Access (API + Reminders)',
      enc_extended_title: '🔔 Extended Mode (API + Reminders)',
      enc_extended_desc: 'Email reminders, API, and MCP are active. The system can process data automatically.',
      enc_disable_extended: 'Return to E2E (Disable Extended Access)',
      enc_disable_confirm: 'Returning to E2E will disable email reminders and API access. Continue?',
      enc_confirm_title: 'Change Encryption Mode',
      enc_confirm_p1: 'Your data is currently encrypted with end-to-end encryption (E2E) — the system cannot access it without your password.',
      enc_confirm_p2: 'Enabling reminders and/or API access requires switching to a mode where the system can process data automatically. Your email is not stored and no one can see it except you.',
      enc_confirm_p3: 'The system bears no responsibility for any data breach resulting from enabling this service.',
      enc_confirm_p4: 'You can disable at any time — disabling returns encryption to E2E mode.',
      enc_confirm_yes: 'I confirm',
      enc_confirm_no: 'Cancel',
      enc_enabled_msg: 'Extended access enabled ✓',
      // Cities
      city_jerusalem: 'Jerusalem',
      city_tel_aviv: 'Tel Aviv',
      city_haifa: 'Haifa',
      city_beer_sheva: 'Beer Sheva',
      city_tzfat: 'Tzfat',
      city_ashdod: 'Ashdod',
      city_eilat: 'Eilat',
      city_netanya: 'Netanya',
      city_bet_shemesh: 'Bet Shemesh',
      city_maale_adumim: 'Maale Adumim',
      city_select: 'Select city',
      // Admin
      admin_title: 'System Administration',
      admin_stats: 'Statistics',
      admin_registration: 'Registration',
      admin_registration_open: 'Registration open — new users can sign up',
      admin_users: 'Users',
      admin_col_id: '#',
      admin_col_email: 'Email',
      admin_col_registered: 'Registered',
      admin_col_actions: 'Actions',
      admin_delete: 'Delete',
      admin_delete_confirm: 'Delete {email}?\nAll data will be permanently deleted.',
      admin_grant_admin: '+ admin',
      admin_revoke_admin: '- admin',
      admin_stat_users: 'Users',
      admin_stat_with_data: 'With Data',
      admin_stat_new_7d: 'New (7 days)',
      admin_stat_db_size: 'DB Size',
      // Legend
      legend_beinonit: 'Onah Beinonit',
      legend_haflagah: 'Haflagah',
      legend_hachodesh: 'Hachodesh',
      legend_az: 'Or Zarua',
      legend_kavua: 'Kavua',
      // Footer
      footer_terms: 'Terms of Service & Privacy Policy →',
      footer_api_docs: 'API Docs',
      footer_privacy: 'Privacy Policy',
      // API Docs
      api_docs_title: 'API Documentation',
      api_docs_desc: 'The API provides programmatic access to all Luach Vestot features.',
      // Misc
      confirm_cancel: 'Cancel',
      dark_mode: 'Dark/Light mode',
      error_generic: 'Error',
      error_save: 'Error saving',
      error_export: 'Error exporting',
      error_import: 'Error importing',
      error_update: 'Error updating',
      error_add: 'Error adding',
      error_unknown: 'Unknown error',
      error_enter_email: 'Please enter an email address',
      error_enter_valid_email: 'Please enter a valid email address',
      error_enter_cycle: 'Please enter at least one cycle',
      error_fill_fields: 'Please fill in all fields',
      error_login: 'Login error',
      error_register: 'Registration error',
      error_passwords_mismatch: 'Passwords do not match',
      error_password_short: 'Password must be at least 6 characters',
      error_accept_terms: 'You must accept the terms of service',
      error_pick_date: 'Please pick a date',
      msg_copied: 'Copied ✓',
      msg_email_sent: 'Verification email sent ✓',
      msg_reset_sent: 'Reset link sent',
      msg_no_emails: 'No addresses configured. Add an email address below.',
      confirm_new_key: 'A new key will be generated. The old key will stop working. Continue?',
      confirm_delete_user: 'Delete {email}?\nAll data will be permanently deleted.',
      confirm_grant_admin: 'Make {email} an admin?',
      confirm_revoke_admin: 'Remove admin from {email}?'
    }
  };

  function t(key, params) {
    var str = (translations[currentLang] && translations[currentLang][key]) || (translations.he[key]) || key;
    if (params) {
      Object.keys(params).forEach(function(k) {
        str = str.replace('{' + k + '}', params[k]);
      });
    }
    return str;
  }

  function setLang(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('lang', lang);
    applyDirection();
    applyTranslations();
  }

  function getLang() {
    return currentLang;
  }

  function applyDirection() {
    if (currentLang === 'he') {
      document.documentElement.setAttribute('dir', 'rtl');
      document.documentElement.setAttribute('lang', 'he');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
      document.documentElement.setAttribute('lang', 'en');
    }
    // Ensure cards and containers align text properly
    var textEls = document.querySelectorAll('.card, .settings-container, .history-container, .auth-container, .calendar-container, .docs-container, h2, h3, p, label, .form-group, .toggle-option, .radio-option, .form-actions, .confirm-dialog, .table-wrapper, th, td');
    textEls.forEach(function(el) {
      el.style.textAlign = '';
      el.style.direction = '';
    });
  }

  function applyTranslations() {
    // Apply to all elements with data-i18n attribute
    var els = document.querySelectorAll('[data-i18n]');
    els.forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      var val = t(key);
      if (Array.isArray(val)) return; // Skip arrays (like months)
      if (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio') {
        el.placeholder = val;
      } else if (el.tagName === 'OPTION') {
        el.textContent = val;
      } else {
        el.textContent = val;
      }
    });
    // Apply to elements with data-i18n-placeholder
    var placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    placeholders.forEach(function(el) {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    // Apply to elements with data-i18n-title
    var titles = document.querySelectorAll('[data-i18n-title]');
    titles.forEach(function(el) {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
    // Apply URL-based translations
    var termsLink = document.getElementById('terms-link');
    if (termsLink) termsLink.href = t('url_terms');
    // Update calendar day names if visible
    var dayNames = document.querySelectorAll('.calendar-day-name');
    var dayNamesArr = t('cal_day_names');
    if (dayNames.length === 7 && Array.isArray(dayNamesArr)) {
      for (var i = 0; i < 7; i++) {
        dayNames[i].textContent = dayNamesArr[i];
      }
    }
  }

  function init() {
    applyDirection();
    applyTranslations();
  }

  return {
    t: t,
    setLang: setLang,
    getLang: getLang,
    init: init,
    applyTranslations: applyTranslations
  };
})();

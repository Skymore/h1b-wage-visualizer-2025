
import { getRequestConfig } from 'next-intl/server';

// Can be imported from a shared config
const locales = ['en', 'zh', 'ko', 'ja', 'es', 'hi', 'fr', 'de'] as const;
type AppLocale = (typeof locales)[number];

export default getRequestConfig(async ({ locale }: { locale?: string }) => {
    const normalizedLocale: AppLocale = locales.includes(locale as AppLocale)
        ? (locale as AppLocale)
        : 'en';

    return {
        messages: (await import(`../../messages/${normalizedLocale}.json`)).default,
        locale: normalizedLocale
    };
});

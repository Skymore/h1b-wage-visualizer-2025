
import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

// Can be imported from a shared config
const locales = ['en', 'zh', 'ko', 'ja', 'es'];

export default getRequestConfig(async ({ locale }) => {
    // Validate that the incoming `locale` parameter is valid
    // Validate that the incoming `locale` parameter is valid
    if (!locale || !locales.includes(locale as any)) {
        locale = 'en';
    }

    return {
        messages: (await import(`../../messages/${locale}.json`)).default,
        locale: locale as string
    };
});

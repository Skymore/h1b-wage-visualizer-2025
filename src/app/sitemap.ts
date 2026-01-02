import { MetadataRoute } from 'next';
import { readPublicDataJson } from '@/lib/chat/data';
import { toSlug } from '@/lib/utils';
import type { OccupationRecord, AreaRecord } from '@/lib/chat/types';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://h1b.ruit.me';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [occupations, areas] = await Promise.all([
    readPublicDataJson<OccupationRecord[]>('occupations.json'),
    readPublicDataJson<AreaRecord[]>('areas.json')
  ]);

  if (!occupations || !areas) {
    return [];
  }

  // Strategy: Generate sitemap for Popular Occupations x Tier 1-3 Areas
  // This matches our programmatic SEO strategy
  const popularOccupations = occupations.filter(o => o.isPopular);
  const targetAreas = areas.filter(a => a.tier && a.tier <= 3);

  const entries: MetadataRoute.Sitemap = [];

  // 1. Static Routes
  entries.push({
    url: `${BASE_URL}/en`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1,
  });

  // 2. Metrics Page
  entries.push({
    url: `${BASE_URL}/en/metrics`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.5,
  });

  // 3. Programmatic SEO Pages
  for (const occupation of popularOccupations) {
    for (const area of targetAreas) {
      const occupationSlug = toSlug(occupation.title);
      const areaSlug = toSlug(`${area.name} ${area.state}`);
      
      entries.push({
        url: `${BASE_URL}/en/salary/${occupationSlug}/${areaSlug}`,
        lastModified: new Date(), // Could be the data update date
        changeFrequency: 'monthly',
        priority: 0.8,
      });
    }
  }

  // Note: We are currently generating only 'en' links to keep sitemap size manageable.
  // Ideally, we should use a sitemap index or multiple sitemaps for all locales
  // if we want to cover all 8 languages (8 * 7800 = ~62k URLs, exceeding the 50k limit per file).
  // For now, English is the priority.

  return entries;
}


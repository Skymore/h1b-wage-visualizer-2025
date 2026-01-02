import { readPublicDataJson } from '@/lib/chat/data';
import { toSlug } from '@/lib/utils';
import type { OccupationRecord, AreaRecord, WageFile } from '@/lib/chat/types';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowLeft, MapPin, Briefcase, DollarSign, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTranslations } from 'next-intl/server';

// Allow dynamic generation for other locales/combinations
export const dynamicParams = true;
export const revalidate = false; // Cache forever since data is static JSON

interface Props {
  params: Promise<{
    locale: string;
    occupation: string;
    area: string;
  }>;
}

// Helper to match slug back to data
async function getData(occupationSlug: string, areaSlug: string) {
  const [occupations, areas] = await Promise.all([
    readPublicDataJson<OccupationRecord[]>('occupations.json'),
    readPublicDataJson<AreaRecord[]>('areas.json')
  ]);

  if (!occupations || !areas) return null;

  const occupation = occupations.find(o => toSlug(o.title) === occupationSlug);
  
  // Area slug strategy: "new-york-ny" -> name: "New York", state: "NY"
  // Since we construct slugs as `toSlug(name + ' ' + state)`, we try to match that.
  const area = areas.find(a => toSlug(`${a.name} ${a.state}`) === areaSlug);

  if (!occupation || !area) return null;

  // Fetch wages
  const wageData = await readPublicDataJson<WageFile>(`wages/${occupation.code}.json`);
  const wage = wageData?.wages?.find(w => w.area_id === area.id);

  return { occupation, area, wage, allAreas: areas };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, occupation: occupationSlug, area: areaSlug } = await params;
  const data = await getData(occupationSlug, areaSlug);
  const t = await getTranslations('SalaryPage');

  if (!data) return { title: 'Not Found' };

  const { occupation, area, wage } = data;
  const salary = wage ? `$${Math.round(wage.l2 * 2080).toLocaleString()}` : 'Unknown';
  
  return {
    title: t('title', { occupation: occupation.title, area: `${area.name}, ${area.state}` }),
    description: `Current H1B prevailing wage for ${occupation.title} in ${area.name}, ${area.state}. Level 2 median salary is ${salary}. Explore hourly rates and wage levels for FY 2025-2026.`,
    alternates: {
      canonical: `/${locale}/salary/${occupationSlug}/${areaSlug}`,
    }
  };
}

export async function generateStaticParams() {
  const [occupations, areas] = await Promise.all([
    readPublicDataJson<OccupationRecord[]>('occupations.json'),
    readPublicDataJson<AreaRecord[]>('areas.json')
  ]);

  if (!occupations || !areas) return [];

  // Filter for Popular Occupations AND Tier 1-2 Areas (Optimization for build time)
  // Tier 3 areas will be generated on-demand via ISR (dynamicParams = true)
  const popularOccupations = occupations.filter(o => o.isPopular);
  const targetAreas = areas.filter(a => a.tier && a.tier <= 2);

  const params = [];
  
  // Generating params for ALL combinations would be huge:
  // ~50 occupations * ~400 areas * 8 locales = 160,000 pages
  // This is too many for a build.
  // 
  // Let's optimize: 
  // 1. Only 'en' for now to save build time (user can switch locale on client)
  // 2. Or limit to Tier 1 only for all locales?
  //
  // Strategy: 
  // - Top 20 popular occupations
  // - Top 50 Tier 1/2 areas
  // - 'en' only for pre-build (others can be dynamic if we switch to ISR, but for static export we need to pick)
  // 
  // Since user asked for "Tier 3 + Popular", that's potentially 50 * 500 = 25,000 pages per locale.
  // We should limit locales to just 'en' for the static generation demonstration to avoid timeout.
  
  // Let's generate for 'en' only initially to be safe.
  
  for (const occupation of popularOccupations) {
    for (const area of targetAreas) {
      params.push({
        locale: 'en',
        occupation: toSlug(occupation.title),
        area: toSlug(`${area.name} ${area.state}`),
      });
    }
  }

  return params;
}

export default async function SalaryPage({ params }: Props) {
  const { locale, occupation: occupationSlug, area: areaSlug } = await params;
  const data = await getData(occupationSlug, areaSlug);

  if (!data) {
    notFound();
  }

  const { occupation, area, wage } = data;
  const t = await getTranslations('SalaryPage');
  const tHome = await getTranslations('HomePage');

  const formatMoney = (amount: number) => `$${amount.toLocaleString()}`;
  const formatAnnual = (hourly: number) => formatMoney(Math.round(hourly * 2080));

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
        
        {/* Breadcrumb / Back */}
        <div className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Link href={`/${locale}`} className="flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            {t('back_to_search')}
          </Link>
        </div>

        {/* Header */}
        <div className="space-y-4">
          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80">
            {t('fy_data')}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">
            {t('title', { occupation: occupation.title, area: `${area.name}, ${area.state}` })
              .split(`${area.name}, ${area.state}`).map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && <span className="text-primary">{area.name}, {area.state}</span>}
                </span>
              ))}
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
             {t('description', { occupation: occupation.title, code: occupation.code, area: area.name })}
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('median_wage')}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{wage ? formatAnnual(wage.l2) : 'N/A'}</div>
              <p className="text-xs text-muted-foreground">{t('most_common')}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('entry_level')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{wage ? formatAnnual(wage.l1) : 'N/A'}</div>
              <p className="text-xs text-muted-foreground">{t('junior_positions')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('location_tier')}</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{t('tier_label', { tier: area.tier || 3 })}</div>
              <p className="text-xs text-muted-foreground">
                {area.tier === 1 ? t('tier_1_desc') : area.tier === 2 ? t('tier_2_desc') : t('tier_3_desc')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Wage Table */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50">
            <CardTitle>{t('detailed_wages')}</CardTitle>
            <CardDescription>
              {t('detailed_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {wage ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('level_header')}</TableHead>
                    <TableHead>{t('exp_header')}</TableHead>
                    <TableHead>{t('hourly_header')}</TableHead>
                    <TableHead className="text-right">{t('annual_header')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">{tHome('level_1')}</TableCell>
                    <TableCell className="text-muted-foreground">{t('l1_desc')}</TableCell>
                    <TableCell>{formatMoney(wage.l1)}/hr</TableCell>
                    <TableCell className="text-right font-bold">{formatAnnual(wage.l1)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-primary/5">
                    <TableCell className="font-medium">{tHome('level_2')}</TableCell>
                    <TableCell className="text-muted-foreground">{t('l2_desc')}</TableCell>
                    <TableCell>{formatMoney(wage.l2)}/hr</TableCell>
                    <TableCell className="text-right font-bold text-primary">{formatAnnual(wage.l2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">{tHome('level_3')}</TableCell>
                    <TableCell className="text-muted-foreground">{t('l3_desc')}</TableCell>
                    <TableCell>{formatMoney(wage.l3)}/hr</TableCell>
                    <TableCell className="text-right font-bold">{formatAnnual(wage.l3)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">{tHome('level_4')}</TableCell>
                    <TableCell className="text-muted-foreground">{t('l4_desc')}</TableCell>
                    <TableCell>{formatMoney(wage.l4)}/hr</TableCell>
                    <TableCell className="text-right font-bold">{formatAnnual(wage.l4)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                {t('no_data')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Context / Footer */}
        <div className="rounded-lg bg-muted p-6 md:p-8 text-center space-y-4">
          <h3 className="text-lg font-semibold">{t('footer_title')}</h3>
          <p className="text-muted-foreground">
            {t('footer_desc')}
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Button asChild size="lg">
              <Link href={`/${locale}?soc=${occupation.code}&q=${encodeURIComponent(area.name)}`}>
                <Briefcase className="mr-2 h-4 w-4" />
                {t('view_map')}
              </Link>
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}

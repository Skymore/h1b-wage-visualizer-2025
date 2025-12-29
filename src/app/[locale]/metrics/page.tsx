import { getMetricsSummary } from "@/lib/metrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Activity } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function MetricsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const summary = await getMetricsSummary();
  const locale = resolvedParams?.locale ?? "en";
  const t = await getTranslations({ locale, namespace: "Metrics" });
  const numberFormatter = new Intl.NumberFormat("en-US");
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const statCards = [
    {
      label: t("stat_total_visits"),
      value: numberFormatter.format(summary.totalVisits),
    },
    {
      label: t("stat_unique_visitors"),
      value: numberFormatter.format(summary.uniqueVisitors),
    },
    {
      label: t("stat_chat_messages"),
      value: numberFormatter.format(summary.chatMessages),
    },
    {
      label: t("stat_token_cost"),
      value: currencyFormatter.format(summary.chatTokens.costUSD ?? 0),
    },
  ];

  const visitorRows = [...summary.visitors].sort(
    (a, b) => b.chatMessages - a.chatMessages
  );

  const kvConfigured = Boolean(
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  );

  return (
    <main className="flex min-h-screen flex-col items-center bg-background p-4 md:p-8">
      <div className="flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              {t("badge_title")}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {t("page_title")}
            </h1>
            <p className="text-muted-foreground">
              {t("page_subtitle")}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/${locale}`}>
              <ArrowLeft className="mr-2 h-4 w-4" /> {t("back_button")}
            </Link>
          </Button>
        </header>

        {!kvConfigured && (
          <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-4 py-3 text-sm text-amber-900">
            {t("kv_warning")}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <Card key={card.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xl font-semibold">
                {t("table_title")}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("table_subtitle")}
              </p>
            </div>
            <div className="rounded-full bg-muted px-4 py-1 text-xs font-medium text-muted-foreground">
              <Activity className="mr-2 inline h-3 w-3" />
              {t("table_tracked", { count: visitorRows.length })}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("col_visitor")}</TableHead>
                  <TableHead className="text-right">{t("col_visits")}</TableHead>
                  <TableHead className="text-right">{t("col_chats")}</TableHead>
                  <TableHead className="text-right">{t("col_prompt")}</TableHead>
                  <TableHead className="text-right">{t("col_completion")}</TableHead>
                  <TableHead className="text-right">{t("col_total")}</TableHead>
                  <TableHead className="text-right">{t("col_cost")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitorRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      {t("empty_state")}
                    </TableCell>
                  </TableRow>
                ) : (
                  visitorRows.map((visitor) => {
                    const hashed = visitor.id ?? "";
                    const displayId =
                      hashed.length > 12
                        ? `${hashed.slice(0, 6)}…${hashed.slice(-4)}`
                        : hashed || "—";
                    return (
                      <TableRow key={visitor.id}>
                        <TableCell className="font-mono text-sm">{displayId}</TableCell>
                        <TableCell className="text-right">
                          {numberFormatter.format(visitor.visits)}
                        </TableCell>
                        <TableCell className="text-right">
                          {numberFormatter.format(visitor.chatMessages)}
                        </TableCell>
                        <TableCell className="text-right">
                          {numberFormatter.format(visitor.tokens.prompt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {numberFormatter.format(visitor.tokens.completion)}
                        </TableCell>
                        <TableCell className="text-right">
                          {numberFormatter.format(visitor.tokens.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          {currencyFormatter.format(visitor.tokens.costUSD ?? 0)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Download, Loader2, Copy, Check } from 'lucide-react';

interface WageRecord {
    area_id: string;
    l1: number;
    l2: number;
    l3: number;
    l4: number;
}

interface Area {
    id: string;
    name: string;
    state: string;
}

interface ShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedData: WageRecord[];
    areas: Area[];
    socCode: string;
    socTitle?: string;
}

export function ShareDialog({ open, onOpenChange, selectedData, areas, socCode, socTitle }: ShareDialogProps) {
    const t = useTranslations('HomePage');
    const [isCopied, setIsCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [imageUrl, setImageUrl] = useState<string>("");

    const { resolvedTheme } = useTheme();

    // Create a map for area details
    const areaMap = new Map(areas.map(a => [a.id, a]));

    useEffect(() => {
        if (open && selectedData.length > 0) {
            // Construct payload
            const records = selectedData.map(r => {
                const area = areaMap.get(r.area_id);
                // logic to format name safely
                let name = r.area_id;
                if (area) {
                    name = area.name;
                    if (!name.includes(area.state)) {
                        name = `${name}, ${area.state}`;
                    }
                }
                return {
                    area_id: r.area_id,
                    name,
                    l1: r.l1,
                    l2: r.l2,
                    l3: r.l3,
                    l4: r.l4
                };
            });

            const payload = {
                socCode,
                socTitle: socTitle || socCode,
                records
            };

            const jsonStr = JSON.stringify(payload);
            const encoded = encodeURIComponent(jsonStr);
            const url = `/api/og?data=${encoded}&theme=${resolvedTheme}`;
            setImageUrl(url);
            setIsLoading(true); // Image loading state handled by onLoad
        }
    }, [open, selectedData, areas, socCode, socTitle, resolvedTheme]);

    const handleDownload = async () => {
        if (!imageUrl) return;
        try {
            const res = await fetch(imageUrl);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `h1b-wage-compare-${socCode}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
        }
    };

    const handleCopy = async () => {
        if (!imageUrl) return;
        try {
            const res = await fetch(imageUrl);
            const blob = await res.blob();
            const item = new ClipboardItem({ [blob.type]: blob });
            await navigator.clipboard.write([item]);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (e) {
            console.error("Copy failed", e);
            alert(t('copy_not_supported'));
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] flex flex-col items-center bg-background border-border text-foreground">
                <DialogHeader>
                    <DialogTitle>{t('share_dialog_title')}</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {t('share_dialog_desc')}
                    </DialogDescription>
                </DialogHeader>

                <div className="relative my-4 w-full flex justify-center min-h-[400px] bg-muted/50 rounded-xl overflow-hidden border border-border">
                    {imageUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={imageUrl}
                            alt="Wage Comparison"
                            className={`max-h-[60vh] object-contain transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'} shadow-lg rounded-md`}
                            onLoad={() => setIsLoading(false)}
                        />
                    )}

                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                            <span className="text-sm text-muted-foreground">{t('generating_preview')}</span>
                        </div>
                    )}
                </div>

                <DialogFooter className="w-full grid grid-cols-2 gap-2 sm:gap-4">
                    <Button variant="secondary" onClick={handleCopy} disabled={isLoading} className="w-full">
                        {isCopied ? (
                            <><Check className="mr-2 h-4 w-4 text-green-500" /> {t('copied')}</>
                        ) : (
                            <><Copy className="mr-2 h-4 w-4" /> {t('copy_image')}</>
                        )}
                    </Button>
                    <Button onClick={handleDownload} disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
                        <Download className="mr-2 h-4 w-4" /> {t('download_png')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

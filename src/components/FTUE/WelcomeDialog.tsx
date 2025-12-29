
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface WelcomeDialogProps {
    onStartTour: () => void;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WelcomeDialog({ onStartTour, isOpen, onOpenChange }: WelcomeDialogProps) {
    const t = useTranslations('Welcome');

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center pb-2">
                        {t('title')}
                    </DialogTitle>
                    <DialogDescription className="text-center text-lg pt-2">
                        {t('description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-6 items-center">
                    {/* We can add a hero image here later if needed */}
                    <div className="text-4xl">👋</div>
                </div>

                <DialogFooter className="flex-col sm:flex-col gap-2 sm:space-x-0">
                    <Button
                        className="w-full text-lg py-6"
                        onClick={() => {
                            onStartTour();
                        }}
                    >
                        {t('start_tour')}
                    </Button>
                    <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('skip')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

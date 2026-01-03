'use client';

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ChatTriggerButtonProps {
    children: ReactNode;
    className?: string;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export function ChatTriggerButton({ children, className, variant = "outline" }: ChatTriggerButtonProps) {
    return (
        <Button
            variant={variant}
            className={cn(className)}
            onClick={() => {
                const trigger = document.getElementById('chat-widget-trigger');
                if (trigger) {
                    trigger.click();
                } else {
                    console.warn('Chat widget trigger not found');
                }
            }}
        >
            {children}
        </Button>
    );
}

"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const searchParams = useSearchParams()
    const [mounted, setMounted] = useState(false)

    // Wait until mounted to avoid hydration mismatch
    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        const themeParam = searchParams.get('theme')
        if (themeParam && ['light', 'dark', 'system'].includes(themeParam)) {
            setTheme(themeParam)
        }
    }, [searchParams, setTheme])

    if (!mounted) {
        return (
            <Button variant="outline" size="icon">
                <Sun className="h-[1.2rem] w-[1.2rem]" />
            </Button>
        )
    }

    const currentIcon = () => {
        if (theme === 'system') return <Monitor className="h-[1.2rem] w-[1.2rem]" />
        if (theme === 'dark') return <Moon className="h-[1.2rem] w-[1.2rem]" />
        return <Sun className="h-[1.2rem] w-[1.2rem]" />
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon">
                    {currentIcon()}
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-36 p-1">
                <div className="grid gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`justify-start font-normal ${theme === "light" ? "bg-muted" : ""}`}
                        onClick={() => setTheme("light")}
                    >
                        <Sun className="mr-2 h-4 w-4" />
                        Light
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`justify-start font-normal ${theme === "dark" ? "bg-muted" : ""}`}
                        onClick={() => setTheme("dark")}
                    >
                        <Moon className="mr-2 h-4 w-4" />
                        Dark
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`justify-start font-normal ${theme === "system" ? "bg-muted" : ""}`}
                        onClick={() => setTheme("system")}
                    >
                        <Monitor className="mr-2 h-4 w-4" />
                        System
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}

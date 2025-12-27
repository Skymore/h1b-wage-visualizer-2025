"use client"

import * as React from "react"
import { Check, ChevronDown, Globe } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

const languages = [
    { code: "en", label: "English" },
    { code: "zh", label: "中文" },
    { code: "ko", label: "한국어" },
    { code: "ja", label: "日本語" },
    { code: "es", label: "Español" },
]

export function LanguageSelector() {
    const router = useRouter()
    const pathname = usePathname()
    const [open, setOpen] = React.useState(false)

    // Current locale is the first segment of the pathname
    // e.g. /en/some/path -> en
    const currentLocale = pathname.split("/")[1]

    const handleLanguageChange = (code: string) => {
        if (!currentLocale) {
            // Fallback if something is weird, though middleware ensures locale
            router.push(`/${code}`)
            return
        }
        // Replace the locale in the pathname
        // We replace the first occurrence of /currentLocale with /newLocale
        const newPathname = pathname.replace(`/${currentLocale}`, `/${code}`)
        router.push(newPathname)
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-[140px] justify-between">
                    <Globe className="mr-2 h-4 w-4" />
                    {languages.find((lang) => lang.code === currentLocale)?.label || "English"}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[140px] p-0">
                <div className="grid gap-1 p-1">
                    {languages.map((lang) => (
                        <Button
                            key={lang.code}
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "justify-start font-normal",
                                currentLocale === lang.code && "bg-accent text-accent-foreground font-medium"
                            )}
                            onClick={() => handleLanguageChange(lang.code)}
                        >
                            <Check
                                className={cn(
                                    "mr-2 h-4 w-4",
                                    currentLocale === lang.code ? "opacity-100" : "opacity-0"
                                )}
                            />
                            {lang.label}
                        </Button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}

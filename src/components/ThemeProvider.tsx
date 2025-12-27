"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// Since we installed next-themes, we can use its types if available, 
// or just standard React props. 
// Note: next-themes types might need to be imported specifically or inferred.
// Standard shadcn implementation:

export function ThemeProvider({
    children,
    ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
    return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

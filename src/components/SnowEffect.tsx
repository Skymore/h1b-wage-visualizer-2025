'use client';

import { useEffect, useRef, useState } from 'react';
import { useSnow } from './SnowContext';
import { useTheme } from 'next-themes';

// Game-like particle system for smoother "floating" feel

interface Particle {
    x: number;
    y: number;
    radius: number;
    alpha: number;      // Opacity for depth effect
    vy: number;         // Vertical velocity (falling speed)
    sway: number;       // Sway offset
    swaySpeed: number;  // How fast it sways
    angle: number;      // Current angle for sine wave
    color: string;      // Particle color (White for snow, Pink for sakura)
}

export function SnowEffect() {
    const { isSnowing } = useSnow();
    const { resolvedTheme } = useTheme();

    // Canvas & State Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    const previousTimeRef = useRef<number>(0);

    // Memory Optimization: Pre-allocate particles (Object Pooling)
    const particles = useRef<Particle[]>([]);

    // Configuration
    const BASE_SPEED = 25;      // Base falling speed

    // Effect Type based on Theme
    // Use resolvedTheme to correctly handle 'system' preference
    const isDark = resolvedTheme === 'dark';
    const isSakura = !isDark;

    // Only render if snowing is active. Now we support BOTH modes.
    const shouldRender = isSnowing;

    // Initialize/Reset a single particle
    const resetParticle = (p: Particle, width: number, height: number, initial = false) => {
        p.x = Math.random() * width;
        p.y = initial ? Math.random() * height : -10; // Start random on screen, or just above

        // Visuals: 
        // Snow: 0.2px - 1.7px
        // Sakura: Slightly larger, 1.5px - 4px (petals are bigger)
        if (isSakura) {
            p.radius = Math.random() * 2.5 + 1.5;
            // Light Pink to Hot Pink variations for Sakura
            // Random tint between #ffb7c5 (classic sakura) and #fd79a8
            const variant = Math.random();
            if (variant > 0.6) p.color = 'rgba(255, 183, 197, '; // Classic
            else if (variant > 0.3) p.color = 'rgba(253, 121, 168, '; // Darker pink
            else p.color = 'rgba(255, 230, 230, '; // Very light
        } else {
            p.radius = Math.random() * 1.5 + 0.2;
            p.color = 'rgba(255, 255, 255, ';
        }

        // Depth: Smaller particles are more transparent and fall slower
        const depth = Math.random();
        p.alpha = 0.5 + (depth * 0.5); // 0.5 to 1.0 opacity

        // Physics:
        // Sakura flutters more (slower fall, more sway)
        const flutterFactor = isSakura ? 0.7 : 1.0;
        p.vy = (BASE_SPEED + (depth * 30)) * (0.8 + Math.random() * 0.4) * flutterFactor;

        // Swaying:
        p.angle = Math.random() * Math.PI * 2;
        // Sakura sways MORE
        p.sway = (20 + Math.random() * 40) * (isSakura ? 1.5 : 1.0);
        p.swaySpeed = (1 + Math.random() * 2) * (isSakura ? 0.8 : 1.0);

        return p;
    };

    useEffect(() => {
        if (!shouldRender) {
            // Cleanup if stopped
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
                requestRef.current = 0;
            }
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
            // Clear particles so they re-init with correct color/physics on next toggle
            particles.current = [];
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resize & Density Calculation
        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            // Re-calculate target particle count based on screen area
            // Standard: 1920x1080 (2M pixels) -> ~800 particles
            // Denom: 2500 pixels per particle
            const pixelCount = canvas.width * canvas.height;
            const targetCount = Math.floor(pixelCount / 2500);

            // Adjust array size
            // If we need more, we'll add them in the loop. 
            // If we have too many, we could slice, or just let them fade out. 
            // For simplicity, we just keep the current array and let the loop handle 'upto' targetCount
            // But we need to update the ref to know the limit in the loop.
            // We'll calculate 'targetCount' inside the loop or store in ref.
        };
        handleResize();
        window.addEventListener('resize', handleResize);

        // Game Loop
        const animate = (time: number) => {
            if (previousTimeRef.current === undefined) {
                previousTimeRef.current = time;
            }
            const dt = Math.min((time - previousTimeRef.current) / 1000, 0.1);
            previousTimeRef.current = time;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Calculate Target Count dynamically per frame (or cached on resize)
            // Doing it here handles resize naturally
            const targetCount = Math.floor((canvas.width * canvas.height) / 2500);

            // Fill pool if needed
            while (particles.current.length < targetCount) {
                particles.current.push(resetParticle({} as Particle, canvas.width, canvas.height, true));
            }
            // Trim pool if too many (optional, but good for heavy resize down)
            if (particles.current.length > targetCount) {
                particles.current.length = targetCount;
            }

            // Draw & Update
            for (let i = 0; i < particles.current.length; i++) {
                const p = particles.current[i];

                // Update Physics
                p.angle += p.swaySpeed * dt;

                const windOffset = dt * 10;
                const swayOffset = Math.cos(p.angle) * p.sway * dt;

                p.x += windOffset + swayOffset;
                p.y += p.vy * dt;

                // Boundary Checks
                if (p.y > canvas.height + 10) {
                    resetParticle(p, canvas.width, canvas.height);
                }
                if (p.x > canvas.width + 10) {
                    p.x = -10;
                } else if (p.x < -10) {
                    p.x = canvas.width + 10;
                }

                // Draw
                // Use the pre-calculated color string which includes "rgba(..., "
                ctx.fillStyle = p.color + p.alpha + ')';

                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2, true);
                ctx.fill();
            }

            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            particles.current = [];
        };
    }, [shouldRender, isSakura]); // Re-run if theme changes (snow <-> sakura)

    if (!shouldRender) return null;

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-50"
            aria-hidden="true"
        />
    );
}

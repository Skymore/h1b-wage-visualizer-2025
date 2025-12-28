import { ImageResponse } from 'next/og';
import QRCode from 'qrcode';

// Switch to Node.js runtime to ensure qrcode library compatibility
export const runtime = 'nodejs';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dataParam = searchParams.get('data');
        const theme = searchParams.get('theme') || 'dark';
        const isLight = theme === 'light';

        // Colors
        const bg = isLight ? '#ffffff' : '#0f172a'; // white vs slate-900
        const textMain = isLight ? '#0f172a' : '#ffffff'; // slate-900 vs white
        const textSub = isLight ? '#64748b' : '#94a3b8'; // slate-500 vs slate-400
        const cardBg = isLight ? '#f1f5f9' : '#1e293b'; // slate-100 vs slate-800
        const cardBorder = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
        const headerBorder = isLight ? '2px solid rgba(0,0,0,0.1)' : '2px solid rgba(255,255,255,0.1)';
        const barBg = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(15, 23, 42, 0.6)';
        const lineBg = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)';

        if (!dataParam) {
            return new ImageResponse(
                (
                    <div
                        style={{
                            display: 'flex',
                            fontSize: 40,
                            color: textMain,
                            background: bg,
                            width: '100%',
                            height: '100%',
                            textAlign: 'center',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        Missing Data
                    </div>
                ),
                {
                    width: 1080,
                    height: 1350,
                },
            );
        }

        const { socCode, socTitle, records } = JSON.parse(decodeURIComponent(dataParam));

        // Generate QR Code
        const qrUrl = `https://h1b.ruit.me/?soc=${socCode}`;
        const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
            margin: 1,
            color: {
                dark: '#000000',
                light: '#ffffff'
            },
            width: 150
        });


        // Helper to format wage
        const formatWageK = (hourly: number) => {
            const annual = Math.round(hourly * 2080);
            return `$${Math.round(annual / 1000)}k`;
        };

        // Calculate max wage for scaling
        // @ts-ignore
        const allWages = records.flatMap(r => [r.l1, r.l2, r.l3, r.l4]);
        const maxWage = Math.max(...allWages);

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: bg,
                        padding: '60px', // Increased padding for 1080p
                        fontFamily: 'sans-serif',
                    }}
                >
                    {/* Background Gradient Simulation */}
                    {!isLight && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'linear-gradient(to bottom right, #1e293b, #0f172a)',
                            zIndex: -1,
                        }} />
                    )}

                    {/* Header */}
                    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '40px', borderBottom: headerBorder, paddingBottom: '30px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(59, 130, 246, 0.9)', // Higher opacity blue
                            borderRadius: '9999px',
                            padding: '8px 20px',
                            width: '260px', // Larger pill
                            marginBottom: '20px',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
                        }}>
                            <span style={{ color: 'white', fontSize: '18px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                2026 H1B Insights
                            </span>
                        </div>
                        <div style={{ fontSize: '56px', fontWeight: 900, color: textMain, lineHeight: 1.1, marginBottom: '12px' }}>
                            {socTitle || socCode}
                        </div>
                        <div style={{ fontSize: '24px', color: textSub, fontFamily: 'monospace' }}>
                            {socCode}
                        </div>
                    </div>

                    {/* List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
                        {/* @ts-ignore */}
                        {records.map((record) => (
                            <div
                                key={record.area_id}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    backgroundColor: cardBg,
                                    borderRadius: '24px',
                                    padding: '36px',
                                    border: `2px solid ${cardBorder}`,
                                    boxShadow: '0 8px 16px -2px rgba(0, 0, 0, 0.1)',
                                }}
                            >
                                {/* City Name Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', maxWidth: '75%' }}>
                                        <div style={{ width: '8px', height: '32px', backgroundColor: '#3b82f6', borderRadius: '4px', marginRight: '20px' }}></div>
                                        <span style={{ fontSize: '32px', fontWeight: 700, color: textMain, lineHeight: 1.2 }}>
                                            {record.name}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <span style={{ fontSize: '16px', color: textSub, fontWeight: 700, letterSpacing: '0.05em', marginBottom: '4px' }}>L2 WAGE</span>
                                        <span style={{ fontSize: '42px', fontWeight: 800, color: '#3b82f6' }}>{formatWageK(record.l2)}</span>
                                    </div>
                                </div>

                                {/* Chart Area */}
                                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                    {/* Timeline Bar */}
                                    <div style={{
                                        position: 'relative',
                                        height: '32px',
                                        width: '100%',
                                        backgroundColor: barBg,
                                        borderRadius: '999px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        paddingLeft: '8px',
                                        paddingRight: '8px'
                                    }}>
                                        {/* Line */}
                                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '3px', backgroundColor: lineBg }}></div>

                                        {/* Points */}
                                        {[
                                            { l: 'L1', v: record.l1, c: '#94a3b8' },
                                            { l: 'L2', v: record.l2, c: '#3b82f6' },
                                            { l: 'L3', v: record.l3, c: '#818cf8' },
                                            { l: 'L4', v: record.l4, c: '#c084fc' }
                                        ].map((item) => (
                                            <div
                                                key={item.l}
                                                style={{
                                                    position: 'absolute',
                                                    left: `${(item.v / maxWage) * 94}%`,
                                                    transform: 'translateX(-50%)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: item.c, border: `3px solid ${isLight ? '#ffffff' : 'rgba(30,41,59,1)'}`, zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>
                                                <div style={{ position: 'absolute', top: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '14px', color: textSub, marginBottom: '2px', fontWeight: 500 }}>{item.l}</span>
                                                    <span style={{ fontSize: '18px', fontWeight: 700, color: textMain }}>{formatWageK(item.v)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ height: '50px' }}></div> {/* Increased spacer for labels */}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '30px', marginTop: 'auto' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                            <span style={{ color: textSub, fontSize: '20px', marginBottom: '8px' }}>Data Source: OFLC 2025-26</span>
                            <span style={{ color: '#3b82f6', fontSize: '28px', fontWeight: 800 }}>h1b.ruit.me</span>
                        </div>

                        <div style={{
                            display: 'flex',
                            padding: '12px',
                            borderRadius: '16px',
                            backgroundColor: 'white', // always white for QR
                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                            border: isLight ? '1px solid #e2e8f0' : 'none'
                        }}>
                            <img src={qrCodeDataUrl} width="120" height="120" style={{ borderRadius: '4px' }} alt="QR Code" />
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1080, // Higher resolution
                height: 1350, // Higher resolution
            },
        );
    } catch (e: any) {
        console.log(`${e.message}`);
        return new Response(`Failed to generate the image`, {
            status: 500,
        });
    }
}

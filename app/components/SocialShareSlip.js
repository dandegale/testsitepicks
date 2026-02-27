'use client';

import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';

export default function SocialShareSlip({ picks, username, eventName }) {
    const printRef = useRef();
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownload = async () => {
        setIsGenerating(true);
        try {
            const element = printRef.current;
            
            // html2canvas will now target the off-screen element perfectly
            const canvas = await html2canvas(element, {
                backgroundColor: '#000000',
                scale: 3, // High-res for Retina displays
                useCORS: true,
                logging: false
            });

            // Create download link
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `FightIQ-${username || 'Roster'}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error("Error generating image:", error);
            alert("Oops! Something went wrong saving the image.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="relative">
            {/* The Button the user actually clicks */}
            <button 
                onClick={handleDownload}
                disabled={isGenerating || !picks || picks.length === 0}
                className="w-full mt-4 bg-gradient-to-r from-pink-600 to-pink-500 text-white p-3 rounded-xl font-black uppercase tracking-widest text-xs flex justify-center items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(219,39,119,0.3)]"
            >
                {isGenerating ? 'Generating...' : 'Save Graphic To Share'}
            </button>

            {/* THE FIX: Shoved 9999px off-screen instead of using display: none */}
            <div className="absolute -left-[9999px] -top-[9999px]">
                <div 
                    ref={printRef} 
                    className="w-[400px] bg-black p-8 relative overflow-hidden"
                    style={{ fontFamily: 'system-ui, sans-serif' }}
                >
                    {/* Background Glow */}
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 to-teal-400"></div>
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-pink-600 rounded-full blur-[80px] opacity-30"></div>
                    
                    {/* Header */}
                    <div className="mb-6 border-b border-gray-800 pb-4 relative z-10">
                        <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter mb-1">
                            FIGHT<span className="text-pink-600">IQ</span>
                        </h1>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Official Roster Lock</p>
                    </div>

                    {/* Meta Info */}
                    <div className="flex justify-between items-end mb-6 relative z-10">
                        <div>
                            <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Manager</p>
                            <p className="text-lg font-black text-white">{username || 'Anonymous'}</p>
                        </div>
                        <div className="text-right max-w-[150px]">
                            <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Event</p>
                            <p className="text-xs font-bold text-teal-400 uppercase truncate">{eventName || 'Upcoming Event'}</p>
                        </div>
                    </div>

                    {/* The Picks */}
                    <div className="space-y-3 mb-8 relative z-10">
                        {picks && picks.map((pick, index) => (
                            <div key={index} className="bg-gray-900 border border-gray-800 p-3 flex items-center justify-between rounded">
                                <div className="flex items-center gap-3">
                                    <div className="text-[10px] font-black text-pink-500">0{index + 1}</div>
                                    <div className="text-sm font-black text-white uppercase truncate">{pick.selected_fighter || pick.fighterName}</div>
                                </div>
                                <div className="text-teal-400 text-lg leading-none">⚔️</div>
                            </div>
                        ))}
                    </div>

                    {/* Footer / Barcode */}
                    <div className="pt-4 border-t border-gray-800 flex justify-between items-center opacity-70 relative z-10">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Play at fightiq.app</p>
                        {/* Fake CSS Barcode */}
                        <div className="flex h-6 gap-[2px]">
                            {[1,3,1,2,4,1,1,3,2,1,2].map((w, i) => (
                                <div key={i} className="bg-gray-500 h-full" style={{ width: `${w * 2}px` }}></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
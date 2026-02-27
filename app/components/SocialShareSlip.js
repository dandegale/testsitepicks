'use client';

import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';

function dataURLtoFile(dataurl, filename) {
    let arr = dataurl.split(','),
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), 
        n = bstr.length, 
        u8arr = new Uint8Array(n);
        
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

export default function SocialShareSlip({ picks, username, eventName }) {
    const printRef = useRef();
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownload = async () => {
        setIsGenerating(true);
        try {
            const element = printRef.current;
            const originalOpacity = element.style.opacity;
            element.style.opacity = '1';

            const canvas = await html2canvas(element, {
                backgroundColor: '#000000',
                scale: 3, 
                useCORS: true,
                logging: false
            });

            element.style.opacity = originalOpacity;

            const dataUrl = canvas.toDataURL('image/png');
            const filename = `FightIQ-${username || 'Roster'}.png`;
            const imageFile = dataURLtoFile(dataUrl, filename);

            if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
                try {
                    await navigator.share({
                        title: 'My Fight IQ Roster',
                        text: 'Locking in my 5-man roster for this weekend!',
                        files: [imageFile]
                    });
                } catch (shareError) {
                    console.log('Share sheet closed:', shareError);
                }
            } else {
                const link = document.createElement('a');
                link.download = filename;
                link.href = dataUrl;
                link.click();
            }

        } catch (error) {
            console.error("CRITICAL ERROR:", error);
            alert("Oops! Something went wrong saving the image.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="relative w-full">
            <button 
                onClick={handleDownload}
                disabled={isGenerating || !picks || picks.length === 0}
                className="w-full mt-4 bg-gradient-to-r from-pink-600 to-pink-500 text-white p-3 rounded-xl font-black uppercase tracking-widest text-xs flex justify-center items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(219,39,119,0.3)]"
            >
                {isGenerating ? 'Generating...' : 'Save Graphic To Share'}
            </button>

            {/* Hidden Container */}
            <div className="absolute top-0 left-0 w-0 h-0 overflow-visible pointer-events-none -z-50 opacity-0">
                <div 
                    ref={printRef} 
                    className="w-[400px] p-8 relative overflow-hidden"
                    style={{ backgroundColor: '#000000', fontFamily: 'system-ui, sans-serif' }}
                >
                    {/* 🎯 HARDCODED HEX GRADIENT TO BYPASS LAB() ERRORS */}
                    <div className="absolute top-0 left-0 w-full h-2" style={{ background: 'linear-gradient(to right, #ec4899, #2dd4bf)' }}></div>
                    <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full" style={{ backgroundColor: '#db2777', filter: 'blur(80px)', opacity: 0.2 }}></div>
                    
                    <div className="mb-6 pb-4 relative z-10" style={{ borderBottom: '1px solid #1f2937' }}>
                        <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-1" style={{ color: '#ffffff' }}>
                            FIGHT<span style={{ color: '#db2777' }}>IQ</span>
                        </h1>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: '#6b7280' }}>Official Roster Lock</p>
                    </div>

                    <div className="flex justify-between items-end mb-6 relative z-10">
                        <div>
                            <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#6b7280' }}>Manager</p>
                            <p className="text-lg font-black" style={{ color: '#ffffff' }}>{username || 'Anonymous'}</p>
                        </div>
                        <div className="text-right max-w-[150px]">
                            <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#6b7280' }}>Event</p>
                            <p className="text-xs font-bold uppercase truncate" style={{ color: '#2dd4bf' }}>{eventName || 'Upcoming Event'}</p>
                        </div>
                    </div>

                    <div className="space-y-3 mb-8 relative z-10">
                        {picks && picks.map((pick, index) => (
                            <div key={index} className="p-3 flex items-center justify-between rounded" style={{ backgroundColor: '#111827', border: '1px solid #1f2937' }}>
                                <div className="flex items-center gap-3">
                                    <div className="text-[10px] font-black" style={{ color: '#ec4899' }}>0{index + 1}</div>
                                    <div className="text-sm font-black uppercase truncate" style={{ color: '#ffffff' }}>{pick.selected_fighter || pick.fighterName}</div>
                                </div>
                                <div className="text-lg leading-none" style={{ color: '#2dd4bf' }}>⚔️</div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 flex justify-between items-center relative z-10" style={{ borderTop: '1px solid #1f2937', opacity: 0.7 }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#6b7280' }}>Play at fightiq.app</p>
                        {/* Fake CSS Barcode */}
                        <div className="flex h-6 gap-[2px]">
                            {[1,3,1,2,4,1,1,3,2,1,2].map((w, i) => (
                                <div key={i} className="h-full" style={{ width: `${w * 2}px`, backgroundColor: '#6b7280' }}></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
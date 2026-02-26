'use client';

import { useState, useEffect } from 'react';

export default function OnboardingModal() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Check if they are a new user when the component loads
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setIsVisible(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setIsVisible(false);
  };

  const nextStep = () => {
    if (currentStep < 2) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  if (!isVisible) return null;

  const steps = [
    {
      icon: "🌍",
      title: "Climb The Ranks",
      subtitle: "Global Picks",
      description: "Select your fighters for the upcoming card. Every strike, takedown, and finish earns you fantasy points to boost your Global Ranking.",
      accent: "text-pink-500",
      border: "border-pink-500/50",
      glow: "bg-pink-600/20"
    },
    {
      icon: "⚔️",
      title: "Draft Your Squad",
      subtitle: "Private Leagues",
      description: "Invite your friends to a private league and build a team of fighters. Outscore your rivals week after week to secure the ultimate bragging rights.",
      accent: "text-teal-500",
      border: "border-teal-500/50",
      glow: "bg-teal-600/20"
    },
    {
      icon: "🏆",
      title: "Build Your Legacy",
      subtitle: "Earn The Trophies",
      description: "Rack up massive point totals, hit crazy win streaks, and dominate your friends to unlock exclusive profile badges and showcase your Fight IQ.",
      accent: "text-yellow-500",
      border: "border-yellow-500/50",
      glow: "bg-yellow-600/20"
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-500 font-sans">
      
      {/* The Modal Card */}
      <div className="relative w-full max-w-md bg-[#050505] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300">
        
        {/* Dynamic Background Glow based on the current step */}
        <div className={`absolute top-[-20%] left-[-20%] w-[300px] h-[300px] blur-[100px] rounded-full pointer-events-none transition-colors duration-700 ${steps[currentStep].glow}`}></div>

        <div className="relative z-10 p-8 flex flex-col items-center text-center">
            
            {/* Icon */}
            <div className={`text-6xl mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] transform transition-transform duration-500 hover:scale-110`}>
                {steps[currentStep].icon}
            </div>

            {/* Text Content */}
            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${steps[currentStep].accent}`}>
                {steps[currentStep].subtitle}
            </h3>
            <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter mb-4">
                {steps[currentStep].title}
            </h2>
            <p className="text-sm text-gray-400 font-medium leading-relaxed mb-8">
                {steps[currentStep].description}
            </p>

            {/* Pagination Dots */}
            <div className="flex gap-2 mb-8">
                {[0, 1, 2].map((index) => (
                    <div 
                        key={index} 
                        className={`h-1.5 rounded-full transition-all duration-500 ${currentStep === index ? `w-6 ${steps[currentStep].glow.replace('/20', '')}` : 'w-2 bg-gray-800'}`}
                    ></div>
                ))}
            </div>

            {/* Actions */}
            <div className="w-full flex flex-col gap-3">
                <button 
                    onClick={nextStep}
                    className={`w-full py-4 rounded-xl text-[11px] font-black uppercase tracking-widest text-white transition-all active:scale-95 border ${steps[currentStep].border} ${steps[currentStep].glow.replace('/20', '/40')} hover:bg-white/10`}
                >
                    {currentStep === 2 ? "Let's Go" : "Next"}
                </button>
                
                {currentStep < 2 && (
                    <button 
                        onClick={handleClose}
                        className="text-[10px] font-bold uppercase tracking-widest text-gray-600 hover:text-gray-300 transition-colors"
                    >
                        Skip Tutorial
                    </button>
                )}
            </div>

        </div>
      </div>
    </div>
  );
}
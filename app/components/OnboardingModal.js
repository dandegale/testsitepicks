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
      description: "You're currently on the Global Fight Card. Select your winners for every matchup to earn points and rank up the Global Leaderboard.",
      accent: "text-pink-500",
      border: "border-pink-500/50",
      glow: "bg-pink-600/20"
    },
    {
      icon: "💎",
      title: "Draft & Unlock",
      subtitle: "Leagues & The Store",
      description: "Create private leagues or join public ones. Remember: Leagues are the ONLY way to gain levels and earn coins to spend on exclusive items in the Store!",
      accent: "text-teal-500",
      border: "border-teal-500/50",
      glow: "bg-teal-600/20"
    },
    {
      icon: "⚔️",
      title: "Head-To-Head",
      subtitle: "1v1 Showdowns",
      description: "Think your Fight IQ is unmatched? Challenge other managers directly in 1v1 Showdowns to put your prediction skills to the ultimate test.",
      accent: "text-yellow-500",
      border: "border-yellow-500/50",
      glow: "bg-yellow-600/20"
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans">
      
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-500"></div>

      {/* The Modal Card */}
      <div className="relative w-full max-w-md bg-[#050505] border border-gray-800 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-all duration-300 z-10 animate-in zoom-in-95 duration-300">
          
          {/* Dynamic Background Glow */}
          <div className={`absolute top-[-20%] left-[-20%] w-[300px] h-[300px] blur-[100px] rounded-full pointer-events-none transition-colors duration-700 ${steps[currentStep].glow}`}></div>

          <div className="relative z-10 p-8 flex flex-col items-center text-center">
              
              <div className={`text-6xl mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] transform transition-transform duration-500 hover:scale-110`}>
                  {steps[currentStep].icon}
              </div>

              <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${steps[currentStep].accent}`}>
                  {steps[currentStep].subtitle}
              </h3>
              <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter mb-4">
                  {steps[currentStep].title}
              </h2>
              <p className="text-sm text-gray-400 font-medium leading-relaxed mb-8 h-20">
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
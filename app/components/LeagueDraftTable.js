'use client';

import { useState } from 'react';

export default function LeagueDraftTable({ fighters, onDraft, draftedFighterNames = [], isDrafting = false }) {
    // 🎯 DEFAULT SORT: Fight Order (Main Event at top)
    const [sortConfig, setSortConfig] = useState({ key: 'start_time', direction: 'desc' });

    // 🎯 SORTING ENGINE
    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const sortedFighters = [...fighters].sort((a, b) => {
        // Handle Matchup sorting via start_time
        if (sortConfig.key === 'start_time') {
            const timeA = new Date(a.start_time || 0).getTime();
            const timeB = new Date(b.start_time || 0).getTime();
            
            if (timeA === timeB) {
                return a.fighter_name.localeCompare(b.fighter_name);
            }
            return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
        }

        // Handle text sorting
        if (typeof a[sortConfig.key] === 'string') {
            return sortConfig.direction === 'asc' 
                ? a[sortConfig.key].localeCompare(b[sortConfig.key])
                : b[sortConfig.key].localeCompare(a[sortConfig.key]);
        }
        
        // Handle number sorting
        return sortConfig.direction === 'asc'
            ? Number(a[sortConfig.key] || 0) - Number(b[sortConfig.key] || 0)
            : Number(b[sortConfig.key] || 0) - Number(a[sortConfig.key] || 0);
    });

    // Helper for table headers (with optional className for responsive hiding)
    const HeaderCell = ({ label, sortKey, align = 'left', className = '' }) => (
        <th 
            onClick={() => handleSort(sortKey)}
            className={`px-3 md:px-4 py-4 cursor-pointer hover:text-white hover:bg-gray-800/50 transition-colors select-none ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
        >
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
                {label}
                {sortConfig.key === sortKey && (
                    <span className="text-pink-500 text-[10px]">
                        {sortConfig.direction === 'asc' ? '▲' : '▼'}
                    </span>
                )}
            </div>
        </th>
    );

    return (
        <div className="w-full bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
            
            {/* TABLE HEADER */}
            <div className="p-4 md:p-5 border-b border-gray-800 bg-black/40 flex justify-between items-center z-30 relative">
                <div>
                    <h2 className="text-lg md:text-xl font-black italic uppercase tracking-tighter text-white">Draft Board</h2>
                    <p className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Sort by stats to find the best fantasy picks</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg shrink-0">
                    <span className="text-[10px] font-black uppercase text-pink-500 tracking-widest">{fighters.length} Available</span>
                </div>
            </div>

            {/* SCROLLABLE TABLE CONTAINER */}
            <div className="overflow-x-auto custom-scrollbar relative">
                <table className="w-full text-sm whitespace-nowrap">
                    <thead className="bg-gray-900/90 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-800">
                        <tr>
                            <HeaderCell label="Matchup" sortKey="start_time" />
                            <HeaderCell label="Record" sortKey="record" className="hidden sm:table-cell" />
                            <HeaderCell label="Avg PTS" sortKey="fantasy_points" align="right" />
                            <HeaderCell label="SLpM" sortKey="slpm" align="right" />
                            <HeaderCell label="TD Avg" sortKey="td_avg" align="right" />
                            <HeaderCell label="Sub Avg" sortKey="sub_avg" align="right" className="hidden md:table-cell" />
                            
                            {/* 🎯 THE STICKY HEADER */}
                            <th className="px-3 md:px-4 py-4 text-right sticky right-0 bg-[#11141a] shadow-[-10px_0_15px_rgba(0,0,0,0.5)] z-20">
                                Action
                            </th>
                        </tr>
                    </thead>
                    
                    <tbody className="divide-y divide-gray-800/50">
                        {sortedFighters.map((fighter, index) => {
                            const isDrafted = draftedFighterNames.includes(fighter.fighter_name);
                            
                            return (
                                <tr 
                                    key={fighter.id || index} 
                                    className={`group transition-colors hover:bg-gray-800/40 ${isDrafted ? 'opacity-50 grayscale' : ''}`}
                                >
                                    <td className="px-3 md:px-4 py-3 md:py-4">
                                        <div className="flex flex-col min-w-[140px] whitespace-normal">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-white text-xs md:text-sm leading-tight">{fighter.fighter_name}</span>
                                                {fighter.nickname && fighter.nickname !== 'null' && (
                                                    <span className="text-[9px] text-gray-500 font-black italic uppercase tracking-widest hidden sm:inline">
                                                        "{fighter.nickname.replace(/['"]/g, '')}"
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-pink-600 mt-0.5 leading-tight">
                                                vs. <span className="text-gray-400">{fighter.opponent}</span>
                                            </span>
                                        </div>
                                    </td>
                                    
                                    <td className="px-3 md:px-4 py-3 md:py-4 text-gray-400 font-medium hidden sm:table-cell">
                                        {fighter.record || '0-0-0'}
                                    </td>
                                    
                                    <td className="px-3 md:px-4 py-3 md:py-4 text-right text-pink-500 font-black italic font-mono text-sm md:text-base drop-shadow-md">
                                        {fighter.fantasy_points ? parseFloat(fighter.fantasy_points).toFixed(1) : '0.0'}
                                    </td>
                                    
                                    <td className="px-3 md:px-4 py-3 md:py-4 text-right text-gray-300 font-mono text-xs md:text-sm">
                                        {fighter.slpm ? parseFloat(fighter.slpm).toFixed(2) : '0.00'}
                                    </td>
                                    <td className="px-3 md:px-4 py-3 md:py-4 text-right text-gray-300 font-mono text-xs md:text-sm">
                                        {fighter.td_avg ? parseFloat(fighter.td_avg).toFixed(2) : '0.00'}
                                    </td>
                                    <td className="px-3 md:px-4 py-3 md:py-4 text-right text-gray-300 font-mono text-xs md:text-sm hidden md:table-cell">
                                        {fighter.sub_avg ? parseFloat(fighter.sub_avg).toFixed(1) : '0.0'}
                                    </td>

                                    {/* 🎯 THE STICKY BUTTON CELL */}
                                    <td className={`px-2 md:px-4 py-3 md:py-4 text-right sticky right-0 z-10 shadow-[-10px_0_15px_rgba(0,0,0,0.3)] transition-colors ${isDrafted ? 'bg-[#0a0c10] group-hover:bg-[#11141a]' : 'bg-[#0a0c10] group-hover:bg-[#11141a]'}`}>
                                        <button
                                            onClick={() => onDraft(fighter)}
                                            disabled={isDrafted || isDrafting}
                                            className={`px-4 md:px-6 py-2.5 md:py-2 rounded-lg font-black italic uppercase text-[10px] tracking-widest transition-all ${
                                                isDrafted 
                                                ? 'bg-gray-900 text-gray-600 border border-gray-800 cursor-not-allowed'
                                                : 'bg-pink-600 hover:bg-pink-500 text-white border border-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.3)] hover:scale-105 active:scale-95'
                                            }`}
                                        >
                                            {isDrafted ? 'Drafted' : 'Draft'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {sortedFighters.length === 0 && (
                            <tr>
                                <td colSpan="7" className="px-4 py-8 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">
                                    No fighters available to draft.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
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
        // 🎯 Handle the Matchup sorting via start_time
        if (sortConfig.key === 'start_time') {
            const timeA = new Date(a.start_time || 0).getTime();
            const timeB = new Date(b.start_time || 0).getTime();
            
            // If they are fighting each other (same time), alphabetize so pairs stay together
            if (timeA === timeB) {
                return a.fighter_name.localeCompare(b.fighter_name);
            }
            return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
        }

        // Handle text sorting (like names)
        if (typeof a[sortConfig.key] === 'string') {
            return sortConfig.direction === 'asc' 
                ? a[sortConfig.key].localeCompare(b[sortConfig.key])
                : b[sortConfig.key].localeCompare(a[sortConfig.key]);
        }
        
        // Handle number sorting (stats)
        return sortConfig.direction === 'asc'
            ? Number(a[sortConfig.key] || 0) - Number(b[sortConfig.key] || 0)
            : Number(b[sortConfig.key] || 0) - Number(a[sortConfig.key] || 0);
    });

    // Helper for table headers
    const HeaderCell = ({ label, sortKey, align = 'left' }) => (
        <th 
            onClick={() => handleSort(sortKey)}
            className={`px-4 py-4 cursor-pointer hover:text-white hover:bg-gray-800/50 transition-colors select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
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
        <div className="w-full bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* TABLE HEADER */}
            <div className="p-5 border-b border-gray-800 bg-black/40 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Draft Board</h2>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sort by stats to find the best fantasy picks</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg">
                    <span className="text-[10px] font-black uppercase text-pink-500 tracking-widest">{fighters.length} Available</span>
                </div>
            </div>

            {/* SCROLLABLE TABLE */}
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm whitespace-nowrap">
                    <thead className="bg-gray-900/50 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-800">
                        <tr>
                            <HeaderCell label="Matchup" sortKey="start_time" />
                            <HeaderCell label="Record" sortKey="record" />
                            <HeaderCell label="Avg PTS" sortKey="fantasy_points" align="right" />
                            <HeaderCell label="SLpM" sortKey="slpm" align="right" />
                            <HeaderCell label="TD Avg" sortKey="td_avg" align="right" />
                            <HeaderCell label="Sub Avg" sortKey="sub_avg" align="right" />
                            <th className="px-4 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {sortedFighters.map((fighter, index) => {
                            const isDrafted = draftedFighterNames.includes(fighter.fighter_name);
                            
                            return (
                                <tr 
                                    key={fighter.id || index} 
                                    className={`transition-colors hover:bg-gray-800/20 ${isDrafted ? 'opacity-50 grayscale' : ''}`}
                                >
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-white text-sm">{fighter.fighter_name}</span>
                                                {fighter.nickname && fighter.nickname !== 'null' && (
                                                    <span className="text-[9px] text-gray-500 font-black italic uppercase tracking-widest">
                                                        "{fighter.nickname.replace(/['"]/g, '')}"
                                                    </span>
                                                )}
                                            </div>
                                            {/* 🎯 NEW: OPPONENT DISPLAY */}
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-pink-600 mt-1">
                                                vs. <span className="text-gray-400">{fighter.opponent}</span>
                                            </span>
                                        </div>
                                    </td>
                                    
                                    <td className="px-4 py-4 text-gray-400 font-medium">
                                        {fighter.record || '0-0-0'}
                                    </td>
                                    
                                    <td className="px-4 py-4 text-right text-pink-500 font-black italic font-mono text-base drop-shadow-md">
                                        {fighter.fantasy_points ? parseFloat(fighter.fantasy_points).toFixed(1) : '0.0'}
                                    </td>
                                    
                                    <td className="px-4 py-4 text-right text-gray-300 font-mono">
                                        {fighter.slpm ? parseFloat(fighter.slpm).toFixed(2) : '0.00'}
                                    </td>
                                    <td className="px-4 py-4 text-right text-gray-300 font-mono">
                                        {fighter.td_avg ? parseFloat(fighter.td_avg).toFixed(2) : '0.00'}
                                    </td>
                                    <td className="px-4 py-4 text-right text-gray-300 font-mono">
                                        {fighter.sub_avg ? parseFloat(fighter.sub_avg).toFixed(1) : '0.0'}
                                    </td>

                                    <td className="px-4 py-4 text-right">
                                        <button
                                            onClick={() => onDraft(fighter)}
                                            disabled={isDrafted || isDrafting}
                                            className={`px-6 py-2 rounded-lg font-black italic uppercase text-[10px] tracking-widest transition-all ${
                                                isDrafted 
                                                ? 'bg-gray-900 text-gray-600 border border-gray-800 cursor-not-allowed'
                                                : 'bg-pink-600 hover:bg-pink-500 text-white border border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.3)] hover:scale-105 active:scale-95'
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
export function calculateLevel(totalPoints) {
    let level = 1;
    let xpNeededForNext = 100;
    let currentXP = totalPoints || 0;

    while (currentXP >= xpNeededForNext) {
        currentXP -= xpNeededForNext;
        level++;
        xpNeededForNext += 10;
    }
    
    // Also export the percentage math so the Profile page can use it for the progress bar!
    const progressPercentage = Math.min(100, Math.max(0, (currentXP / xpNeededForNext) * 100));

    return {
        level,
        currentXP: Math.floor(currentXP),
        nextLevelXP: xpNeededForNext,
        progressPercentage
    };
}
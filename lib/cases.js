export const STORE_CASES = [
    {
        id: 'title_case_1',
        name: 'The Title Case',
        description: 'Unlock exclusive walkout profile tags. Zero duplicates.',
        price: 100,
        // Add the path to your new image here (starting with /)
        image: '/cases/title-case.png', 
        icon: '📦', // Keeping this as a fallback just in case the image fails to load
        theme: 'pink',
        visualItems: [
            { name: 'The Amateur', rarity: 'Common' }, { name: 'Prelim Fighter', rarity: 'Common' }, { name: 'Gatekeeper', rarity: 'Common' },
            { name: 'Submission Specialist', rarity: 'Rare' }, { name: 'Knockout Artist', rarity: 'Rare' }, { name: 'Bonus Winner', rarity: 'Rare' },
            { name: 'Main Eventer', rarity: 'Epic' }, { name: 'Title Contender', rarity: 'Epic' },
            { name: 'Pound-for-Pound', rarity: 'Legendary' }, { name: 'The BMF', rarity: 'Legendary' }
        ]
    }
];
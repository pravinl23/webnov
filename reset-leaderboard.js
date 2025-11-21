// Script to reset leaderboard and add pravin with score 67
// Run this with: node reset-leaderboard.js

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://credible-skunk-34440.upstash.io';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'AYaIAAIncDI1NjI0YzRjNDI5MDQ0YWY5YjcwNDFmODFlMTIwYThhOHAyMzQ0NDA';

async function redisCommand(command, ...args) {
    const url = `${REDIS_URL}/${command.toLowerCase()}/${args.join('/')}`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${REDIS_TOKEN}`
        }
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Redis API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data;
}

async function resetLeaderboard() {
    try {
        console.log('Clearing leaderboard...');
        await redisCommand('del', 'leaderboard');
        console.log('✓ Leaderboard cleared');
        
        console.log('Adding pravin with score 67...');
        const entryData = JSON.stringify({ 
            name: 'pravin', 
            date: new Date().toISOString() 
        });
        const member = `${entryData}:${Date.now()}`;
        
        await redisCommand('zadd', 'leaderboard', 67, member);
        console.log('✓ Added pravin with score 67');
        
        console.log('\nVerifying leaderboard...');
        const result = await redisCommand('zrevrange', 'leaderboard', 0, 4, 'WITHSCORES');
        console.log('Current leaderboard:', result.result);
        
        console.log('\n✅ Leaderboard reset complete!');
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

resetLeaderboard();

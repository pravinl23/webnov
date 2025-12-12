// Vercel Serverless Function for Leaderboard API
// Uses Upstash Redis REST API for GLOBAL cloud storage
// SECURED: Rate limiting, input validation, anti-cheat measures

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://credible-skunk-34440.upstash.io';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'AYaIAAIncDI1NjI0YzRjNDI5MDQ0YWY5YjcwNDFmODFlMTIwYThhOHAyMzQ0NDA';
const ADMIN_TOKEN = process.env.LEADERBOARD_ADMIN_TOKEN; // Required for DELETE operations

// Security constants
const MAX_REASONABLE_SCORE = 150; // Maximum score we'll accept (realistic game maximum)
const MAX_NAME_LENGTH = 20;
const RATE_LIMIT_WINDOW = 60; // seconds
const MAX_SUBMISSIONS_PER_WINDOW = 5; // max submissions per IP per minute
const SECRET_SALT = 'packet-run-secure-v1'; // Must match client-side salt (client can see this, but hash still required)
const MIN_MS_PER_SCORE = 150; // Minimum 0.15 seconds per point (reasonable for fast gameplay)
const MIN_DURATION_MS = 500; // Minimum game duration (0.5 seconds) - prevents instant submissions

// Helper function to call Upstash Redis REST API
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

// Get client IP address
function getClientIP(req) {
    // Vercel provides IP in headers
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           'unknown';
}

// Rate limiting using Redis
async function checkRateLimit(ip) {
    const rateLimitKey = `ratelimit:${ip}`;
    
    try {
        // Get current count
        const countResult = await redisCommand('get', rateLimitKey);
        const count = parseInt(countResult.result || '0', 10);
        
        if (count >= MAX_SUBMISSIONS_PER_WINDOW) {
            return { allowed: false, remaining: 0 };
        }
        
        // Increment counter
        if (count === 0) {
            // First request - set with expiration
            await redisCommand('setex', rateLimitKey, RATE_LIMIT_WINDOW, '1');
        } else {
            // Increment existing
            await redisCommand('incr', rateLimitKey);
        }
        
        return { allowed: true, remaining: MAX_SUBMISSIONS_PER_WINDOW - count - 1 };
    } catch (error) {
        console.error('Rate limit check error:', error);
        // On error, allow the request (fail open to avoid blocking legitimate users)
        return { allowed: true, remaining: MAX_SUBMISSIONS_PER_WINDOW };
    }
}

// Profanity filter - blocks inappropriate names
function containsProfanity(text) {
    if (!text || typeof text !== 'string') return false;
    
    // Normalize text: lowercase, remove spaces, replace common character substitutions
    const normalized = text.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[@4]/g, 'a')
        .replace(/[3]/g, 'e')
        .replace(/[1!|]/g, 'i')
        .replace(/[0]/g, 'o')
        .replace(/[5$]/g, 's')
        .replace(/[7]/g, 't')
        .replace(/[+]/g, 't');
    
    // Comprehensive profanity list (common inappropriate words)
    // Note: Character substitutions are normalized above (3→e, 1→i, 4→a, 0→o, 5/$/→s, etc.)
    // So "s3x" becomes "sex", "n1gg4" becomes "nigga", "a$$" becomes "ass", etc.
    const profanityList = [
        // F-word variations
        'fuck', 'fuk', 'fck', 'fuq', 'phuck', 'phuk', 'fuc', 'fuk',
        'fucked', 'fucker', 'fucking', 'fucks', 'motherfucker', 'mfer',
        
        // S-word variations
        'shit', 'sht', 'shyt', 'shite', 'shitty', 'bullshit', 'bs',
        
        // A-word variations
        'ass', 'azz', 'arse', 'asshole', 'asswipe', 'asshat', 'badass',
        
        // B-word variations
        'bitch', 'biatch', 'biotch', 'btch', 'bitches', 'bitchy',
        
        // C-word variations
        'cunt', 'cnt', 'cock', 'cok', 'kock', 'cocks', 'cocker',
        
        // D-word variations
        'dick', 'dik', 'dck', 'dickhead', 'dicks', 'damn', 'dammit',
        'damned', 'damnit',
        
        // Other profanity
        'bastard', 'bstrd', 'pussy', 'puss', 'psy', 'whore', 'hor',
        'slut', 'slt', 'piss', 'pissed', 'crap', 'crappy', 'douche',
        'douchebag', 'tits', 'titties', 'boobs', 'boobies', 'penis',
        'vagina', 'balls', 'testicle', 'scrotum', 'anus', 'anal',
        
        // Sexual content
        'sex', 'sexy', 'porn', 'pron', 'prn', 'porno', 'xxx', 'nsfw',
        'nude', 'naked', 'rape', 'raping', 'rapist', 'molest', 'pedophile',
        'pedo', 'milf', 'dilf', 'hentai', 'orgasm', 'masturbate', 'horny',
        
        // Slurs - racial
        'nigger', 'nigga', 'nig', 'negro', 'coon', 'chink', 'gook',
        'spic', 'wetback', 'beaner', 'kike', 'towelhead', 'sandnigger',
        'cracker', 'whitey', 'honkey', 'gringo',
        
        // Slurs - homophobic
        'fag', 'faggot', 'fgt', 'homo', 'queer', 'dyke', 'tranny',
        'trannie', 'shemale',
        
        // Slurs - ableist
        'retard', 'retarded', 'tard', 'autist', 'autistic', 'spaz',
        'cripple', 'gimp', 'midget',
        
        // Hate symbols/groups
        'nazi', 'nzi', 'hitler', 'kkk', 'isis', 'terrorist',
        
        // Drug references
        'cocaine', 'coke', 'heroin', 'meth', 'weed', 'marijuana', 'drug',
        'crack', 'ecstasy', 'lsd', 'shroom',
        
        // Violence
        'kill', 'murder', 'suicide', 'kys', 'die', 'death', 'dead',
        
        // Internet slang profanity
        'wtf', 'stfu', 'gtfo', 'fml', 'omfg', 'lmfao', 'lmao',
        
        // Creative spellings caught by normalization
        // (these are examples - normalization handles them automatically)
        // 'fuk', 'sht', 'azz', 'btch', etc. already covered above
    ];
    
    // Check if normalized text contains any profanity
    for (const word of profanityList) {
        if (normalized.includes(word)) {
            return true;
        }
    }
    
    return false;
}

// Validate and sanitize name
function sanitizeName(name) {
    if (typeof name !== 'string') return null;
    
    // Trim and limit length
    let sanitized = name.trim().slice(0, MAX_NAME_LENGTH);
    
    // Remove potentially harmful characters but allow unicode
    sanitized = sanitized.replace(/[<>\"'&]/g, '');
    
    // Must have at least 1 character
    if (sanitized.length === 0) return null;
    
    // Check for profanity
    if (containsProfanity(sanitized)) return null;
    
    return sanitized;
}

// Validate score
function validateScore(score) {
    // Must be a number
    if (typeof score !== 'number') return false;
    
    // Must be an integer (no decimals)
    if (!Number.isInteger(score)) return false;
    
    // Must be positive
    if (score < 0) return false;
    
    // Must not exceed reasonable maximum
    if (score > MAX_REASONABLE_SCORE) return false;
    
    return true;
}

// Generate hash for verification (must match client-side)
function generateHash(name, score, duration) {
    const str = `${name}-${score}-${duration}-${SECRET_SALT}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}

// Validate duration to prevent impossible scores
function validateDuration(score, duration) {
    // Duration must be a positive number
    if (typeof duration !== 'number' || duration < 0) return false;
    
    // Minimum duration check - prevents instant submissions
    if (duration < MIN_DURATION_MS) return false;
    
    // For score 0, just check minimum duration
    if (score === 0) return duration >= MIN_DURATION_MS;
    
    // Score-based time requirements
    // Lower scores: more lenient (1 point per 150ms)
    // Higher scores: progressively stricter (skill-based scaling)
    let minRequiredTime;
    if (score <= 10) {
        minRequiredTime = score * MIN_MS_PER_SCORE; // 150ms per point for low scores
    } else if (score <= 30) {
        minRequiredTime = (10 * MIN_MS_PER_SCORE) + ((score - 10) * (MIN_MS_PER_SCORE * 1.5)); // 225ms per point for mid scores
    } else {
        minRequiredTime = (10 * MIN_MS_PER_SCORE) + (20 * MIN_MS_PER_SCORE * 1.5) + ((score - 30) * (MIN_MS_PER_SCORE * 2)); // 300ms per point for high scores
    }
    
    // Add some tolerance (10% buffer) to account for network/processing delays
    const tolerance = minRequiredTime * 0.1;
    return duration >= (minRequiredTime - tolerance);
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            // GET is public - no rate limiting needed for reads
            const result = await redisCommand('zrevrange', 'leaderboard', 0, 4, 'WITHSCORES');
            
            const leaderboard = [];
            if (result.result && Array.isArray(result.result)) {
                // Result format: ["member1", "score1", "member2", "score2", ...]
                for (let i = 0; i < result.result.length; i += 2) {
                    const member = result.result[i];
                    const score = parseFloat(result.result[i + 1]);
                    
                    try {
                        // Try to parse as JSON (our format)
                        const lastColonIndex = member.lastIndexOf(':');
                        const jsonPart = lastColonIndex !== -1 ? member.substring(0, lastColonIndex) : member;
                        const entryData = JSON.parse(jsonPart);
                        leaderboard.push({
                            name: entryData.name,
                            score: Math.round(score), // Ensure integer
                            date: entryData.date || new Date().toISOString()
                        });
                    } catch (e) {
                        // If not JSON, skip invalid entries
                        continue;
                    }
                }
            }
            
            return res.status(200).json(leaderboard || []);
        }
        
        if (req.method === 'POST') {
            const ip = getClientIP(req);
            
            // Rate limiting
            const rateLimit = await checkRateLimit(ip);
            if (!rateLimit.allowed) {
                return res.status(429).json({ 
                    error: 'Too many requests. Please wait before submitting again.' 
                });
            }
            
            // Validate request body
            const { name, score, duration, hash } = req.body;
            
            // Validate score
            if (!validateScore(score)) {
                return res.status(400).json({ 
                    error: 'Invalid score. Score must be a positive integer within reasonable limits.' 
                });
            }
            
            // Sanitize name
            const sanitizedName = sanitizeName(name);
            if (!sanitizedName) {
                return res.status(400).json({ 
                    error: 'Invalid name. Name must be 1-20 characters.' 
                });
            }
            
            // Validate duration (anti-cheat - prevents impossible scores)
            if (!validateDuration(score, duration)) {
                return res.status(400).json({ 
                    error: 'Invalid game duration. Score cannot be achieved in the reported time.' 
                });
            }
            
            // Validate hash (basic integrity check)
            // Note: Hash can still be replicated by determined cheaters, but duration validation is primary defense
            const expectedHash = generateHash(sanitizedName, score, duration);
            if (hash !== expectedHash) {
                return res.status(403).json({ 
                    error: 'Invalid submission. Security check failed.' 
                });
            }
            
            // Create entry data (sanitized)
            const entryData = JSON.stringify({ 
                name: sanitizedName, 
                date: new Date().toISOString() 
            });
            
            // Create unique member key (allows same names, uses timestamp for uniqueness)
            const member = `${entryData}:${Date.now()}`;
            
            // Ensure score is integer
            const integerScore = Math.round(score);
            
            // Add to sorted set
            await redisCommand('zadd', 'leaderboard', integerScore, member);
            
            // Keep only top 5 - remove lowest scores
            const countResult = await redisCommand('zcard', 'leaderboard');
            const count = countResult.result || 0;
            
            if (count > 5) {
                // Remove lowest scores (ranks 0 to count-6) to keep top 5
                await redisCommand('zremrangebyrank', 'leaderboard', 0, count - 6);
            }
            
            return res.status(200).json({ 
                success: true,
                remaining: rateLimit.remaining
            });
        }
        
        if (req.method === 'DELETE') {
            // DELETE requires admin authentication
            const authHeader = req.headers.authorization;
            const providedToken = authHeader?.replace('Bearer ', '') || req.query.token;
            
            if (!ADMIN_TOKEN) {
                return res.status(500).json({ 
                    error: 'Admin token not configured. Set LEADERBOARD_ADMIN_TOKEN environment variable.' 
                });
            }
            
            if (providedToken !== ADMIN_TOKEN) {
                return res.status(401).json({ 
                    error: 'Unauthorized. Admin token required.' 
                });
            }
            
            // Clear the entire leaderboard
            await redisCommand('del', 'leaderboard');
            
            // Also clear all rate limit keys (optional cleanup)
            // Note: This would require SCAN which is expensive, so we'll skip it
            
            return res.status(200).json({ success: true, message: 'Leaderboard cleared' });
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({ 
            error: 'Server error', 
            message: 'An error occurred. Please try again later.'
        });
    }
}

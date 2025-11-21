# Security Documentation

This document outlines the security measures implemented to protect the leaderboard API.

## 🔒 Security Features

### 1. **Rate Limiting**
- **Per-IP rate limiting**: Maximum 5 submissions per IP per minute
- Prevents spam attacks and automated score flooding
- Uses Redis for distributed rate limiting across serverless functions

### 2. **Score Validation**
- Scores must be **integers only** (no decimals)
- Scores must be **positive numbers**
- Maximum score cap: **10,000** (adjust `MAX_REASONABLE_SCORE` in `api/leaderboard.js` based on your game's difficulty)
- Server-side validation cannot be bypassed by client-side manipulation

### 3. **Input Sanitization**
- Names are limited to **20 characters**
- Potentially harmful characters (`< > " ' &`) are stripped
- All inputs are sanitized before database storage

### 4. **Admin Authentication**
- DELETE operations require an admin token
- Public users cannot delete the leaderboard
- Set `LEADERBOARD_ADMIN_TOKEN` in Vercel environment variables

### 5. **Error Handling**
- Generic error messages (no sensitive info leaked)
- Rate limit errors return HTTP 429
- Invalid input errors return HTTP 400
- Authentication errors return HTTP 401

## 🛡️ Protection Against Common Attacks

### **Score Manipulation**
✅ Server validates all scores before storing
✅ Scores must be integers (prevents decimal exploits)
✅ Maximum score cap prevents impossibly high scores
❌ **Note**: Perfect client-side game cheating prevention is impossible. For stronger protection, implement server-side game simulation or validation.

### **Spam/Abuse**
✅ Rate limiting per IP (5 submissions/minute)
✅ Input length limits
✅ Character sanitization

### **Database Attacks**
✅ No SQL injection risk (Redis, not SQL)
✅ No command injection (Redis commands are sanitized)
✅ Input validation before database operations

### **Unauthorized Deletion**
✅ DELETE endpoint requires admin token
✅ Public users cannot access admin functions

## ⚙️ Configuration

### Required Environment Variables (Vercel)

1. **`UPSTASH_REDIS_REST_URL`** - Your Upstash Redis REST API URL
2. **`UPSTASH_REDIS_REST_TOKEN`** - Your Upstash Redis REST API token
3. **`LEADERBOARD_ADMIN_TOKEN`** - Secret token for admin operations (generate a strong random string)

### Adjusting Security Settings

Edit `api/leaderboard.js`:

```javascript
const MAX_REASONABLE_SCORE = 10000; // Adjust based on actual game difficulty
const MAX_NAME_LENGTH = 20;
const RATE_LIMIT_WINDOW = 60; // seconds
const MAX_SUBMISSIONS_PER_WINDOW = 5; // submissions per IP per window
```

## 🔧 Admin Operations

To clear the leaderboard (requires admin token):

```bash
curl -X DELETE "https://your-site.vercel.app/api/leaderboard?token=YOUR_ADMIN_TOKEN"
# OR
curl -X DELETE "https://your-site.vercel.app/api/leaderboard" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## ⚠️ Important Notes

1. **Client-Side Validation is NOT Security**: Client-side checks are for UX only. All security is enforced server-side.

2. **Score Limits**: Adjust `MAX_REASONABLE_SCORE` based on your game's actual difficulty. Monitor your leaderboard for suspicious scores.

3. **Rate Limiting**: If legitimate users hit rate limits, increase `MAX_SUBMISSIONS_PER_WINDOW` or `RATE_LIMIT_WINDOW`.

4. **IP-Based Rate Limiting**: Users behind shared networks (schools, offices) share the same IP and may hit limits together.

5. **Perfect Anti-Cheat**: For a client-side game, perfect cheating prevention is impossible. These measures prevent obvious abuse but advanced users could still manipulate client-side code. For stronger protection, consider:
   - Server-side game simulation/validation
   - Cryptographic score signatures
   - Periodic revalidation of top scores

## 📊 Monitoring

Monitor your Upstash Redis dashboard for:
- Unusual request patterns
- Scores exceeding expected maximums
- Rate limit hits (may indicate abuse or legitimate issues)


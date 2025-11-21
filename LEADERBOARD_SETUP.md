# Global Leaderboard Setup

This guide explains how to set up the **GLOBAL** leaderboard feature for the Packet Run game.

## 🌍 Global Database

**This is a truly global leaderboard!** Once set up, users from anywhere in the world (India, USA, Europe, Asia, etc.) will all compete on the same leaderboard. All scores are stored in a cloud database (Upstash Redis) that's accessible worldwide.

## Option 1: Upstash Redis (Recommended - Free Tier)

Upstash Redis is a global cloud database that works from anywhere in the world. It's perfect for a global leaderboard!

1. **Create an Upstash account:**
   - Go to https://upstash.com/
   - Sign up for a free account (free tier is generous)

2. **Create a Redis database:**
   - Click "Create Database"
   - Choose a name (e.g., "packet-run-leaderboard")
   - **Select a region** - Choose a region that's central to most of your users (e.g., if you have users worldwide, US East or EU West are good options)
   - Click "Create"
   - **Note:** Even if you choose a specific region, the database is accessible globally via REST API

3. **Get your credentials:**
   - After creating the database, click on it
   - Copy the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

4. **Add to Vercel environment variables:**
   - Go to your Vercel project dashboard
   - Navigate to Settings → Environment Variables
   - Add:
     - Name: `UPSTASH_REDIS_REST_URL`, Value: (paste URL from Upstash)
     - Name: `UPSTASH_REDIS_REST_TOKEN`, Value: (paste token from Upstash)
   - Click "Save"
   - Redeploy your site

## Option 2: Local Development (In-Memory)

For local development without Redis, the API will automatically use in-memory storage. Note that scores will reset when the server restarts.

## 🌍 Global Testing

Once deployed with Upstash Redis configured:
1. **Any user, anywhere in the world** can play and submit scores
2. All scores are stored in the same global database
3. The top 5 scores are shared across ALL users worldwide
4. Someone in India can see scores from users in the US, Europe, etc.

**Testing locally:**
1. Play the game and get a score
2. If your score qualifies for top 5, you'll be prompted to enter your name
3. If your score is below the 5th place, you'll see a "So close!" message
4. Check the leaderboard dropdown to see the global top 5 scores

## API Endpoints

- `GET /api/leaderboard` - Fetch top 5 scores
- `POST /api/leaderboard` - Submit a new score (requires `name` and `score` in body)


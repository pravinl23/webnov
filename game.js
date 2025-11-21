/**
 * Packet Run - A minimalist diagram-style game
 */

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    // Accessibility
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Packet Run Game: Press space or tap to jump and avoid obstacles.');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.querySelector('.game-score');
    const bestScoreElement = document.getElementById('best-score');
    const leaderboardList = document.getElementById('leaderboard-list');
    const instructionElement = document.querySelector('.game-instruction');
    const leaderboardToggle = document.getElementById('leaderboard-toggle');
    const leaderboardDropdown = document.getElementById('leaderboard-dropdown');
    const nameInputOverlay = document.getElementById('name-input-overlay');
    const nameInput = document.getElementById('name-input');
    const nameSubmitBtn = document.getElementById('name-submit-btn');
    const nameSkipBtn = document.getElementById('name-skip-btn');
    const closeMessageOverlay = document.getElementById('close-message-overlay');
    const closeMessageText = document.getElementById('close-message-text');
    const closeMessageOk = document.getElementById('close-message-ok');

    // Toggle Leaderboard
    leaderboardToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        leaderboardDropdown.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!leaderboardDropdown.contains(e.target) && !leaderboardToggle.contains(e.target)) {
            leaderboardDropdown.classList.remove('active');
        }
    });

    // Game Constants
    const GRAVITY = 0.4; // Reduced gravity for floaty feel
    const JUMP_FORCE = -6.5; // Reduced jump force
    const OBSTACLE_SPEED = 2.5; // Slower speed
    const OBSTACLE_GAP = 140; // Wider gap
    const OBSTACLE_INTERVAL = 220; // More space between obstacles
    const PACKET_SIZE = 16;
    const FONT_SIZE = 32; // Size for brackets

    // Game State
    let state = 'IDLE'; // IDLE, RUNNING, GAME_OVER
    let score = 0;
    let bestScore = localStorage.getItem('packetRunBest') || 0;
    let frames = 0;
    let gameLoopId;
    let globalLeaderboard = []; // Store global leaderboard

    // Fetch Global Leaderboard
    async function fetchLeaderboard() {
        try {
            const response = await fetch('/api/leaderboard');
            if (response.ok) {
                // ALWAYS use API data - it's the source of truth
                const leaderboard = await response.json();
                globalLeaderboard = leaderboard || [];
                
                // Sync localStorage with API data (so it matches server)
                saveLocalLeaderboard();
                updateLeaderboardDisplay();
            } else if (response.status === 404) {
                // API not available (local dev) - use localStorage fallback
                console.log('API not available, using localStorage fallback');
                loadLocalLeaderboard();
            } else {
                // Other errors - clear and show empty
                globalLeaderboard = [];
                localStorage.removeItem('packetRunGlobalLeaderboard');
                updateLeaderboardDisplay();
            }
        } catch (error) {
            // Network error - check if we're on localhost
            console.error('Failed to fetch leaderboard:', error);
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                // Local dev - use localStorage
                loadLocalLeaderboard();
            } else {
                // Production - clear stale localStorage data
                globalLeaderboard = [];
                localStorage.removeItem('packetRunGlobalLeaderboard');
                updateLeaderboardDisplay();
            }
        }
    }
    
    // Fallback to localStorage for local development ONLY
    function loadLocalLeaderboard() {
        const stored = localStorage.getItem('packetRunGlobalLeaderboard');
        if (stored) {
            try {
                const localData = JSON.parse(stored);
                globalLeaderboard = localData || [];
                updateLeaderboardDisplay();
            } catch (e) {
                globalLeaderboard = [];
                updateLeaderboardDisplay();
            }
        } else {
            globalLeaderboard = [];
            updateLeaderboardDisplay();
        }
    }
    
    function saveLocalLeaderboard() {
        localStorage.setItem('packetRunGlobalLeaderboard', JSON.stringify(globalLeaderboard));
    }

    // Update Best Score Display
    bestScoreElement.textContent = bestScore;
    fetchLeaderboard(); // Load global leaderboard on start

    // Player (Packet)
    const packet = {
        x: 50,
        y: 200,
        velocity: 0,
        size: PACKET_SIZE,
        
        reset() {
            this.y = canvas.height / 2;
            this.velocity = 0;
        },

        draw() {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.fillStyle = '#fff';
            
            // Draw rounded square
            const r = 4; // radius
            ctx.beginPath();
            ctx.moveTo(this.x + r, this.y);
            ctx.lineTo(this.x + this.size - r, this.y);
            ctx.quadraticCurveTo(this.x + this.size, this.y, this.x + this.size, this.y + r);
            ctx.lineTo(this.x + this.size, this.y + this.size - r);
            ctx.quadraticCurveTo(this.x + this.size, this.y + this.size, this.x + this.size - r, this.y + this.size);
            ctx.lineTo(this.x + r, this.y + this.size);
            ctx.quadraticCurveTo(this.x, this.y + this.size, this.x, this.y + this.size - r);
            ctx.lineTo(this.x, this.y + r);
            ctx.quadraticCurveTo(this.x, this.y, this.x + r, this.y);
            ctx.fill();
            ctx.stroke();

            // Optional trail (faint dots)
            if (state === 'RUNNING') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.beginPath();
                ctx.arc(this.x - 10, this.y + this.size/2, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(this.x - 20, this.y + this.size/2, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        },

        update() {
            this.velocity += GRAVITY;
            this.y += this.velocity;

            // Floor collision
            if (this.y + this.size > canvas.height) {
                this.y = canvas.height - this.size;
                this.velocity = 0;
                gameOver();
            }

            // Ceiling collision
            if (this.y < 0) {
                this.y = 0;
                this.velocity = 0.1; // Small bounce to prevent sticking
            }
        },

        jump() {
            this.velocity = JUMP_FORCE;
        }
    };

    // Obstacles (Brackets)
    const obstacles = [];
    const bracketPairs = [
        { top: '{', bottom: '}' },
        { top: '[', bottom: ']' },
        { top: '(', bottom: ')' }
    ];

    class Obstacle {
        constructor() {
            this.x = canvas.width;
            this.width = 30; // Approximate width of text
            this.gapHeight = OBSTACLE_GAP;
            this.topHeight = Math.random() * (canvas.height - this.gapHeight - 40) + 20;
            this.pair = bracketPairs[Math.floor(Math.random() * bracketPairs.length)];
            this.passed = false;
            
            // Easter egg chance
            if (Math.random() < 0.05) {
                const eggs = [
                    { top: '{ steve }', bottom: '' },
                    { top: '[ quiry ]', bottom: '' },
                    { top: '( versus )', bottom: '' }
                ];
                // Simplified logic for now, just sticking to brackets to ensure gameplay consistency
                // Could expand later
            }
        }

        draw() {
            ctx.fillStyle = '#000';
            ctx.font = `bold ${FONT_SIZE}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            // Top Bracket
            ctx.fillText(this.pair.top, this.x + this.width/2, this.topHeight);
            
            // Bottom Bracket
            ctx.textBaseline = 'top';
            ctx.fillText(this.pair.bottom, this.x + this.width/2, this.topHeight + this.gapHeight);

            // Debug hitboxes (uncomment to see)
            // ctx.strokeStyle = 'red';
            // ctx.strokeRect(this.x, 0, this.width, this.topHeight);
            // ctx.strokeRect(this.x, this.topHeight + this.gapHeight, this.width, canvas.height - (this.topHeight + this.gapHeight));
        }

        update() {
            this.x -= OBSTACLE_SPEED;
        }
    }

    // Input Handling
    function handleInput(e) {
        if (e.type === 'keydown' && e.code !== 'Space') return;
        if (e.type === 'keydown') e.preventDefault(); // Prevent scrolling

        if (state === 'IDLE' || state === 'GAME_OVER') {
            resetGame();
            state = 'RUNNING';
            startTime = Date.now(); // Start timer for anti-cheat
            instructionElement.textContent = 'tap / space to hop';
            gameLoop();
        } else if (state === 'RUNNING') {
            packet.jump();
        }
    }

    window.addEventListener('keydown', handleInput);
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent default touch behavior
        handleInput(e);
    }, { passive: false });
    canvas.addEventListener('mousedown', handleInput);

    // Game Logic
    function resetGame() {
        packet.reset();
        obstacles.length = 0;
        score = 0;
        frames = 0;
        updateScoreDisplay();
    }

    function updateScoreDisplay() {
        // Safe DOM update
        scoreElement.textContent = '';
        scoreElement.appendChild(document.createTextNode(`score ${score} | best `));
        const bestSpan = document.createElement('span');
        bestSpan.id = 'best-score';
        bestSpan.textContent = bestScore;
        scoreElement.appendChild(bestSpan);
    }

    async function checkAndSubmitScore() {
        // Get current leaderboard to check if score qualifies
        await fetchLeaderboard();
        
        // Get the current game score (capture it to ensure we're checking the right score)
        const currentScore = score;
        
        // If score is 0 or less, don't qualify
        if (currentScore <= 0) {
            showGameOverScreen();
            return;
        }
        
        const fifthPlaceScore = globalLeaderboard.length >= 5 
            ? globalLeaderboard[4].score 
            : -1; // Use -1 so that any positive score qualifies if leaderboard is empty
        
        // Check if score qualifies for top 5
        // Must be STRICTLY GREATER than 5th place (not equal)
        if (globalLeaderboard.length < 5) {
            // Leaderboard has fewer than 5 entries, any score qualifies
            promptForName();
        } else if (currentScore > fifthPlaceScore) {
            // Score is strictly greater than 5th place - qualifies!
            promptForName();
        } else {
            // Score is less than or equal to 5th place, show "so close" message
            // Show what score they need to beat (must be strictly greater)
            showCloseMessage(fifthPlaceScore + 1);
        }
    }

    function promptForName() {
        // Show name input overlay
        nameInputOverlay.style.display = 'flex';
        nameInput.value = '';
        nameInput.focus();
        showGameOverScreen(); // Show game over background
        
        // Handle submit
        const handleSubmit = () => {
            const name = nameInput.value.trim();
            if (name) {
                nameInputOverlay.style.display = 'none';
                submitScore(name);
            } else {
                nameInput.focus();
            }
        };
        
        // Handle skip
        const handleSkip = () => {
            nameInputOverlay.style.display = 'none';
            showGameOverScreen();
        };
        
        // Remove any existing listeners by replacing with clones
        const submitBtn = document.getElementById('name-submit-btn');
        const skipBtn = document.getElementById('name-skip-btn');
        
        // Add listeners
        submitBtn.onclick = handleSubmit;
        skipBtn.onclick = handleSkip;
        
        // Handle Enter key
        nameInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                handleSubmit();
            }
        };
    }

    // Anti-Cheat
    let startTime = 0;
    const SECRET_SALT = 'packet-run-secure-v1'; // Simple client-side salt

    function generateHash(name, score, duration) {
        // Simple hash function for basic integrity check
        const str = `${name}-${score}-${duration}-${SECRET_SALT}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }

    async function submitScore(name) {
        const originalText = instructionElement.textContent;
        
        try {
            // Validate score on client side too (but server will validate again)
            const integerScore = Math.round(score);
            if (integerScore !== score || integerScore < 0) {
                throw new Error('Invalid score format');
            }
            
            // Sanitize name on client side
            const sanitizedName = name.trim().slice(0, 20).replace(/[<>\"'&]/g, '');
            if (!sanitizedName) {
                throw new Error('Invalid name');
            }

            // Calculate duration
            const duration = Date.now() - startTime;
            
            // Generate hash
            const hash = generateHash(sanitizedName, integerScore, duration);
            
            // Show submitting state
            instructionElement.textContent = 'Submitting...';
            instructionElement.style.color = 'hsl(var(--muted-foreground))';
            
            const response = await fetch('/api/leaderboard', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    name: sanitizedName, 
                    score: integerScore,
                    duration: duration,
                    hash: hash
                })
            });
            
            // ... (rest of function)
            
            if (response.ok) {
                // Refresh leaderboard and show success
                await fetchLeaderboard();
                showGameOverScreen();
                
                // Show success message
                instructionElement.textContent = '✓ Score submitted!';
                instructionElement.style.color = '#4CAF50';
                setTimeout(() => {
                    instructionElement.textContent = originalText;
                    instructionElement.style.color = '';
                }, 2000);
            } else if (response.status === 429) {
                // Rate limited
                const data = await response.json().catch(() => ({}));
                instructionElement.textContent = 'Too many submissions. Please wait a moment.';
                instructionElement.style.color = '#ff9800';
                setTimeout(() => {
                    instructionElement.textContent = originalText;
                    instructionElement.style.color = '';
                }, 3000);
                showGameOverScreen();
            } else if (response.status === 404) {
                // API not available - use localStorage fallback
                console.log('API not available, using localStorage fallback');
                submitToLocalLeaderboard(name, originalText);
            } else {
                console.error('Failed to submit score');
                showGameOverScreen();
                instructionElement.textContent = 'Error submitting score. Try again.';
                instructionElement.style.color = '#f44336';
                setTimeout(() => {
                    instructionElement.textContent = originalText;
                    instructionElement.style.color = '';
                }, 3000);
            }
        } catch (error) {
            console.error('Error submitting score:', error);
            // Fall back to localStorage on network error
            submitToLocalLeaderboard(name, originalText);
        }
    }
    
    // Fallback submission to localStorage
    function submitToLocalLeaderboard(name, originalText) {
        // Load current leaderboard
        loadLocalLeaderboard();
        
        // Add new entry
        globalLeaderboard.push({ name, score, date: new Date().toISOString() });
        
        // Sort and keep top 5
        globalLeaderboard.sort((a, b) => b.score - a.score);
        globalLeaderboard = globalLeaderboard.slice(0, 5);
        
        // Save to localStorage
        saveLocalLeaderboard();
        
        // Update display
        updateLeaderboardDisplay();
        showGameOverScreen();
        
        // Show success message
        instructionElement.textContent = '✓ Score saved! (local)';
        instructionElement.style.color = '#4CAF50';
        setTimeout(() => {
            instructionElement.textContent = originalText;
            instructionElement.style.color = '';
        }, 2000);
    }

    function showCloseMessage(targetScore) {
        showGameOverScreen();
        
        // Show "so close" message overlay
        if (targetScore > 0) {
            closeMessageText.textContent = `So close! Get ${targetScore} to make the leaderboard.`;
        } else {
            closeMessageText.textContent = `Get a score greater than 0 to make the leaderboard.`;
        }
        closeMessageOverlay.style.display = 'flex';
        
        // Handle OK button
        const okBtn = document.getElementById('close-message-ok');
        okBtn.onclick = () => {
            closeMessageOverlay.style.display = 'none';
            showGameOverScreen();
        };
    }

    function showGameOverScreen() {
        // Draw Game Over Text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // White overlay
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('packet dropped.', canvas.width/2, canvas.height/2 - 10);
        
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText('tap to retry', canvas.width/2, canvas.height/2 + 20);
    }

    function gameOver() {
        state = 'GAME_OVER';
        cancelAnimationFrame(gameLoopId);
        
        // Update Best Score (local)
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('packetRunBest', bestScore);
        }
        
        updateScoreDisplay();
        
        // Check if score qualifies for global leaderboard
        checkAndSubmitScore();
        
        // Show initial game over screen (will be updated after score check)
        showGameOverScreen();
    }

    function checkCollision(obstacle) {
        // Simple AABB collision
        // Packet hitbox
        const pLeft = packet.x;
        const pRight = packet.x + packet.size;
        const pTop = packet.y;
        const pBottom = packet.y + packet.size;

        // Obstacle hitboxes
        // Top bracket area
        // Note: Text rendering is tricky for hitboxes, using approximate rectangles
        const obsLeft = obstacle.x;
        const obsRight = obstacle.x + obstacle.width;
        
        // Top collision
        if (pRight > obsLeft && pLeft < obsRight && pTop < obstacle.topHeight) {
            return true;
        }

        // Bottom collision
        if (pRight > obsLeft && pLeft < obsRight && pBottom > obstacle.topHeight + obstacle.gapHeight) {
            return true;
        }

        return false;
    }

    function gameLoop() {
        if (state !== 'RUNNING') return;

        // Clear Canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Optional: Draw faint grid (adjusted for transparent/beige background)
        // Using a darker dot for visibility on beige
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; 
        for(let i=0; i<canvas.width; i+=20) {
            for(let j=0; j<canvas.height; j+=20) {
                ctx.fillRect(i, j, 1, 1);
            }
        }

        // Update & Draw Packet
        packet.update();
        packet.draw();

        // Manage Obstacles
        if (frames % OBSTACLE_INTERVAL === 0) {
            obstacles.push(new Obstacle());
        }

        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            obs.update();
            obs.draw();

            // Collision Check
            if (checkCollision(obs)) {
                gameOver();
                return;
            }

            // Score Update
            if (!obs.passed && packet.x > obs.x + obs.width) {
                score++;
                obs.passed = true;
                updateScoreDisplay();
                
                // Subtle flash effect on score could go here
            }

            // Remove off-screen obstacles
            if (obs.x + obs.width < 0) {
                obstacles.splice(i, 1);
            }
        }

        frames++;
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    function updateLeaderboardDisplay() {
        leaderboardList.innerHTML = '';
        
        if (globalLeaderboard.length === 0) {
            const li = document.createElement('li');
            li.className = 'leaderboard-item';
            const rankSpan = document.createElement('span');
            rankSpan.textContent = '-';
            const scoreSpan = document.createElement('span');
            scoreSpan.textContent = '-';
            li.appendChild(rankSpan);
            li.appendChild(scoreSpan);
            leaderboardList.appendChild(li);
            return;
        }

        globalLeaderboard.forEach((entry, index) => {
            const li = document.createElement('li');
            li.className = 'leaderboard-item';
            // Highlight if this is the current score (recently submitted)
            if (entry.score === score && state === 'GAME_OVER') {
                li.classList.add('highlight');
            }
            
            // Truncate name if too long
            const displayName = entry.name.length > 12 ? entry.name.substring(0, 12) + '...' : entry.name;
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = `#${index + 1} ${displayName}`;
            
            const scoreSpan = document.createElement('span');
            scoreSpan.textContent = entry.score;
            
            li.appendChild(nameSpan);
            li.appendChild(scoreSpan);
            leaderboardList.appendChild(li);
        });
    }

    // Initial Draw (Idle State)
    function drawIdle() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw Grid
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        for(let i=0; i<canvas.width; i+=20) {
            for(let j=0; j<canvas.height; j+=20) {
                ctx.fillRect(i, j, 1, 1);
            }
        }

        // Draw Packet
        packet.y = canvas.height / 2;
        packet.draw();

        // Draw Start Text
        ctx.fillStyle = '#000';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('click to start', canvas.width/2, canvas.height/2 + 40);
    }

    drawIdle();
});

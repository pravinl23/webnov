/**
 * Packet Run - A minimalist diagram-style game
 */

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.querySelector('.game-score');
    const bestScoreElement = document.getElementById('best-score');
    const leaderboardList = document.getElementById('leaderboard-list');
    const instructionElement = document.querySelector('.game-instruction');
    const leaderboardToggle = document.getElementById('leaderboard-toggle');
    const leaderboardDropdown = document.getElementById('leaderboard-dropdown');

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

    // Update Best Score Display
    bestScoreElement.textContent = bestScore;
    updateLeaderboardDisplay();

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
                this.velocity = 0;
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
        scoreElement.innerHTML = `score ${score} | best <span id="best-score">${bestScore}</span>`;
    }

    function gameOver() {
        state = 'GAME_OVER';
        cancelAnimationFrame(gameLoopId);
        
        // Update Best Score
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('packetRunBest', bestScore);
            saveToLeaderboard(score);
        }
        
        updateScoreDisplay();
        updateLeaderboardDisplay();

        // Draw Game Over Text
        ctx.fillStyle = 'rgba(255, 243, 224, 0.9)'; // Beige overlay
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('packet dropped.', canvas.width/2, canvas.height/2 - 10);
        
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText('tap to retry', canvas.width/2, canvas.height/2 + 20);
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

    // Leaderboard Logic
    function saveToLeaderboard(newScore) {
        let leaderboard = JSON.parse(localStorage.getItem('packetRunLeaderboard') || '[]');
        leaderboard.push({ score: newScore, date: new Date().toISOString() });
        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard = leaderboard.slice(0, 5); // Keep top 5
        localStorage.setItem('packetRunLeaderboard', JSON.stringify(leaderboard));
    }

    function updateLeaderboardDisplay() {
        const leaderboard = JSON.parse(localStorage.getItem('packetRunLeaderboard') || '[]');
        leaderboardList.innerHTML = '';
        
        if (leaderboard.length === 0) {
            const li = document.createElement('li');
            li.className = 'leaderboard-item';
            li.innerHTML = `<span>-</span><span>-</span>`;
            leaderboardList.appendChild(li);
            return;
        }

        leaderboard.forEach((entry, index) => {
            const li = document.createElement('li');
            li.className = 'leaderboard-item';
            if (entry.score === score && state === 'GAME_OVER') {
                li.classList.add('highlight');
            }
            li.innerHTML = `<span>#${index + 1}</span><span>${entry.score}</span>`;
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

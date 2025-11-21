// Target Cursor - Vanilla JS version
class TargetCursor {
    constructor(options = {}) {
        this.targetSelector = options.targetSelector || 'a, button, .cursor-target, .locked-on';
        this.spinDuration = options.spinDuration || 2;
        this.hideDefaultCursor = false; // Show default cursor
        this.hoverDuration = options.hoverDuration || 0.2;
        this.parallaxOn = options.parallaxOn !== false;
        
        this.constants = {
            borderWidth: 3,
            cornerSize: 12
        };
        
        this.isActive = false;
        this.targetCornerPositions = null;
        this.activeStrength = 0;
        this.activeTarget = null;
        this.currentLeaveHandler = null;
        this.resumeTimeout = null;
        this.spinTl = null;
        this.tickerFnRef = null;
        
        this.init();
    }
    
    isMobile() {
        const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth <= 768;
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
        const isMobileUserAgent = mobileRegex.test(userAgent.toLowerCase());
        return (hasTouchScreen && isSmallScreen) || isMobileUserAgent;
    }
    
    init() {
        if (this.isMobile()) return;
        
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) return;
        
        this.createCursor();
        this.setupEventListeners();
        
        // Don't hide default cursor - show regular cursor
        // if (this.hideDefaultCursor) {
        //     document.body.style.cursor = 'none';
        // }
    }
    
    createCursor() {
        const wrapper = document.createElement('div');
        wrapper.className = 'target-cursor-wrapper';
        wrapper.innerHTML = `
            <div class="target-cursor-dot"></div>
            <div class="target-cursor-corner corner-tl"></div>
            <div class="target-cursor-corner corner-tr"></div>
            <div class="target-cursor-corner corner-br"></div>
            <div class="target-cursor-corner corner-bl"></div>
        `;
        document.body.appendChild(wrapper);
        
        this.cursor = wrapper;
        this.dot = wrapper.querySelector('.target-cursor-dot');
        this.corners = wrapper.querySelectorAll('.target-cursor-corner');
        
        gsap.set(this.cursor, {
            xPercent: -50,
            yPercent: -50,
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            opacity: 0
        });
        
        // Don't start spinning by default
        // this.createSpinTimeline();
    }
    
    createSpinTimeline() {
        if (this.spinTl) {
            this.spinTl.kill();
        }
        this.spinTl = gsap.timeline({ repeat: -1 })
            .to(this.cursor, { rotation: '+=360', duration: this.spinDuration, ease: 'none' });
    }
    
    moveCursor(x, y) {
        if (!this.cursor) return;
        gsap.to(this.cursor, {
            x,
            y,
            duration: 0.1,
            ease: 'power3.out'
        });
    }
    
    createTickerFn() {
        return () => {
            if (!this.targetCornerPositions || !this.cursor || !this.corners) return;
            
            const strength = this.activeStrength;
            if (strength === 0) return;
            
            const cursorX = gsap.getProperty(this.cursor, 'x');
            const cursorY = gsap.getProperty(this.cursor, 'y');
            
            this.corners.forEach((corner, i) => {
                const currentX = gsap.getProperty(corner, 'x');
                const currentY = gsap.getProperty(corner, 'y');
                
                const targetX = this.targetCornerPositions[i].x - cursorX;
                const targetY = this.targetCornerPositions[i].y - cursorY;
                
                const finalX = currentX + (targetX - currentX) * strength;
                const finalY = currentY + (targetY - currentY) * strength;
                
                const duration = strength >= 0.99 ? (this.parallaxOn ? 0.2 : 0) : 0.05;
                
                gsap.to(corner, {
                    x: finalX,
                    y: finalY,
                    duration: duration,
                    ease: duration === 0 ? 'none' : 'power1.out',
                    overwrite: 'auto'
                });
            });
        };
    }
    
    setupEventListeners() {
        const moveHandler = (e) => {
            // Always update cursor position, but it's only visible when hovering
            this.moveCursor(e.clientX, e.clientY);
        };
        window.addEventListener('mousemove', moveHandler);
        
        const scrollHandler = () => {
            if (!this.activeTarget || !this.cursor) return;
            const mouseX = gsap.getProperty(this.cursor, 'x');
            const mouseY = gsap.getProperty(this.cursor, 'y');
            const elementUnderMouse = document.elementFromPoint(mouseX, mouseY);
            const isStillOverTarget = elementUnderMouse && 
                (elementUnderMouse === this.activeTarget || 
                 elementUnderMouse.closest(this.targetSelector) === this.activeTarget);
            if (!isStillOverTarget) {
                if (this.currentLeaveHandler) {
                    this.currentLeaveHandler();
                }
            }
        };
        window.addEventListener('scroll', scrollHandler, { passive: true });
        
        const mouseDownHandler = () => {
            if (!this.dot) return;
            gsap.to(this.dot, { scale: 0.7, duration: 0.3 });
            gsap.to(this.cursor, { scale: 0.9, duration: 0.2 });
        };
        
        const mouseUpHandler = () => {
            if (!this.dot) return;
            gsap.to(this.dot, { scale: 1, duration: 0.3 });
            gsap.to(this.cursor, { scale: 1, duration: 0.2 });
        };
        
        window.addEventListener('mousedown', mouseDownHandler);
        window.addEventListener('mouseup', mouseUpHandler);
        
        const enterHandler = (e) => {
            const directTarget = e.target;
            const allTargets = [];
            let current = directTarget;
            
            while (current && current !== document.body) {
                if (current.matches(this.targetSelector)) {
                    allTargets.push(current);
                }
                current = current.parentElement;
            }
            
            const target = allTargets[0] || null;
            if (!target || !this.cursor || !this.corners) return;
            if (this.activeTarget === target) return;
            
            if (this.activeTarget) {
                this.cleanupTarget(this.activeTarget);
            }
            
            if (this.resumeTimeout) {
                clearTimeout(this.resumeTimeout);
                this.resumeTimeout = null;
            }
            
            this.activeTarget = target;
            this.corners.forEach(corner => gsap.killTweensOf(corner));
            
            // Position cursor at mouse location and show it
            const mouseX = e.clientX;
            const mouseY = e.clientY;
            gsap.set(this.cursor, { x: mouseX, y: mouseY, rotation: 0 });
            
            // Show cursor (static, no spinning)
            gsap.to(this.cursor, { opacity: 1, duration: 0.2 });
            gsap.killTweensOf(this.cursor, 'rotation');
            // Don't spin when hovering - keep it static
            
            const rect = target.getBoundingClientRect();
            const { borderWidth, cornerSize } = this.constants;
            const cursorX = gsap.getProperty(this.cursor, 'x');
            const cursorY = gsap.getProperty(this.cursor, 'y');
            
            this.targetCornerPositions = [
                { x: rect.left - borderWidth, y: rect.top - borderWidth },
                { x: rect.right + borderWidth - cornerSize, y: rect.top - borderWidth },
                { x: rect.right + borderWidth - cornerSize, y: rect.bottom + borderWidth - cornerSize },
                { x: rect.left - borderWidth, y: rect.bottom + borderWidth - cornerSize }
            ];
            
            this.isActive = true;
            this.tickerFnRef = this.createTickerFn();
            gsap.ticker.add(this.tickerFnRef);
            
            const strengthObj = { value: 0 };
            gsap.to(strengthObj, {
                value: 1,
                duration: this.hoverDuration,
                ease: 'power2.out',
                onUpdate: () => {
                    this.activeStrength = strengthObj.value;
                }
            });
            
            this.corners.forEach((corner, i) => {
                gsap.to(corner, {
                    x: this.targetCornerPositions[i].x - cursorX,
                    y: this.targetCornerPositions[i].y - cursorY,
                    duration: 0.2,
                    ease: 'power2.out'
                });
            });
            
            const leaveHandler = () => {
                if (this.tickerFnRef) {
                    gsap.ticker.remove(this.tickerFnRef);
                }
                
                this.isActive = false;
                this.targetCornerPositions = null;
                this.activeStrength = 0;
                this.activeTarget = null;
                
                // Hide cursor and stop spinning
                gsap.to(this.cursor, { opacity: 0, duration: 0.2 });
                if (this.spinTl) {
                    this.spinTl.kill();
                    this.spinTl = null;
                }
                gsap.set(this.cursor, { rotation: 0 });
                
                if (this.corners) {
                    this.corners.forEach(corner => gsap.killTweensOf(corner));
                    const { cornerSize } = this.constants;
                    const positions = [
                        { x: -cornerSize * 1.5, y: -cornerSize * 1.5 },
                        { x: cornerSize * 0.5, y: -cornerSize * 1.5 },
                        { x: cornerSize * 0.5, y: cornerSize * 0.5 },
                        { x: -cornerSize * 1.5, y: cornerSize * 0.5 }
                    ];
                    const tl = gsap.timeline();
                    this.corners.forEach((corner, index) => {
                        tl.to(corner, {
                            x: positions[index].x,
                            y: positions[index].y,
                            duration: 0.3,
                            ease: 'power3.out'
                        }, 0);
                    });
                }
                
                this.resumeTimeout = null;
                
                this.cleanupTarget(target);
            };
            
            this.currentLeaveHandler = leaveHandler;
            target.addEventListener('mouseleave', leaveHandler);
        };
        
        window.addEventListener('mouseover', enterHandler, { passive: true });
        
        // Store handlers for cleanup
        this.handlers = {
            move: moveHandler,
            scroll: scrollHandler,
            mousedown: mouseDownHandler,
            mouseup: mouseUpHandler,
            mouseover: enterHandler
        };
    }
    
    cleanupTarget(target) {
        if (this.currentLeaveHandler) {
            target.removeEventListener('mouseleave', this.currentLeaveHandler);
        }
        this.currentLeaveHandler = null;
    }
    
    destroy() {
        if (this.handlers) {
            window.removeEventListener('mousemove', this.handlers.move);
            window.removeEventListener('scroll', this.handlers.scroll);
            window.removeEventListener('mousedown', this.handlers.mousedown);
            window.removeEventListener('mouseup', this.handlers.mouseup);
            window.removeEventListener('mouseover', this.handlers.mouseover);
        }
        
        if (this.activeTarget) {
            this.cleanupTarget(this.activeTarget);
        }
        
        if (this.spinTl) {
            this.spinTl.kill();
        }
        
        if (this.cursor) {
            this.cursor.remove();
        }
        
        // Don't reset cursor - keep default
        // document.body.style.cursor = '';
    }
}

// Initialize cursor when DOM and GSAP are ready
let targetCursor;
function initCursor() {
    if (typeof gsap === 'undefined') {
        setTimeout(initCursor, 50);
        return;
    }
    
    targetCursor = new TargetCursor({
        spinDuration: 2,
        hideDefaultCursor: false,
        parallaxOn: true
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCursor);
} else {
    initCursor();
}


function positionNavLine() {
    const sidebar = document.querySelector('.sidebar');
    const navLinks = document.querySelector('.nav-links');
    const navLine = document.querySelector('.nav-line');

    if (!sidebar || !navLinks || !navLine) return;

    const sidebarRect = sidebar.getBoundingClientRect();
    const navRect = navLinks.getBoundingClientRect();

    const TOP_GAP = 32;           // distance between top of sidebar and top of line
    const GAP_BELOW_LINE = 24;     // distance between bottom of line and top of nav links

    // start the line a bit below the top of the sidebar
    const top = sidebarRect.top + TOP_GAP;

    // make the line run downwards, but stop a bit above the nav links
    const height = navRect.top - GAP_BELOW_LINE - top;

    navLine.style.top = `${top}px`;
    navLine.style.height = `${Math.max(0, height)}px`;
}

function positionSocialLine() {
    const sidebar = document.querySelector('.sidebar');
    const socialIcons = document.querySelector('.social-icons');
    const socialLine = document.querySelector('.social-line');

    if (!sidebar || !socialIcons || !socialLine) return;

    const sidebarRect = sidebar.getBoundingClientRect();
    const iconsRect = socialIcons.getBoundingClientRect();

    const GAP_ABOVE_LINE = 24;   // distance between icons and top of line
    const BOTTOM_GAP = 32;       // distance between bottom of line and bottom of sidebar

    // start the line a bit *below* the icons
    const top = iconsRect.bottom + GAP_ABOVE_LINE;

    // make the line run downwards, but stop a bit above the bottom
    const height = sidebarRect.bottom - BOTTOM_GAP - top;

    socialLine.style.top = `${top}px`;
    socialLine.style.height = `${Math.max(0, height)}px`;
}

function positionLines() {
    positionNavLine();
    positionSocialLine();
}

window.addEventListener('load', positionLines);

// Use ResizeObserver for better performance
const resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(positionLines);
});

const sidebar = document.querySelector('.sidebar');
if (sidebar) {
    resizeObserver.observe(sidebar);
    resizeObserver.observe(document.body);
}

setTimeout(positionLines, 100);

// Navigation functionality
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    const aboutSection = document.getElementById('about-section');
    const projectsSection = document.getElementById('projects-section');

    if (!navLinks.length || !aboutSection || !projectsSection) return;

    function showSection(section) {
        // Hide all sections
        aboutSection.style.display = 'none';
        projectsSection.style.display = 'none';
        
        // Show selected section
        if (section === 'about') {
            aboutSection.style.display = 'flex';
        } else if (section === 'projects') {
            projectsSection.style.display = 'flex';
        }
        
        // Toggle scroll indicator
        const scrollIndicator = document.getElementById('scroll-indicator');
        if (scrollIndicator) {
            scrollIndicator.style.display = section === 'projects' ? 'flex' : 'none';
        }
        
        // Update active state on all links
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.section === section);
        });

        // Sync height after showing section (if projects)
        if (section === 'projects') {
            syncProjectHeight();
        }
    }

    // Add click handlers to all nav links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            if (section) {
                showSection(section);
            }
        });
    });

    // Handle hash changes (for direct URL navigation)
    function handleHashChange() {
        const hash = window.location.hash.slice(1);
        if (hash === 'about' || hash === 'projects') {
            showSection(hash);
        }
    }

    window.addEventListener('hashchange', handleHashChange);
    
    // Check initial hash
    handleHashChange();
    
    // Scroll Indicator Logic
    const scrollIndicator = document.getElementById('scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', () => {
            const projectsSection = document.getElementById('projects-section');
            const projectsContainer = projectsSection?.querySelector('.projects-container');
            if (!projectsContainer) return;
            
            const projects = projectsContainer.querySelectorAll('.project');
            const currentScroll = projectsContainer.scrollTop;
            const containerTop = projectsContainer.getBoundingClientRect().top;
            
            // Find the next project
            let nextProject = null;
            
            // We want to find the first project whose top is significantly below the container top
            // But since we are scrolling the container, we should check offsetTop relative to container
            // or just use getBoundingClientRect
            
            for (const project of projects) {
                // Calculate distance from top of container
                const projectTop = project.getBoundingClientRect().top - containerTop;
                
                // If project is below the top (with a small buffer), it's the next one
                // Buffer of 10px to avoid selecting the current one if it's slightly misaligned
                if (projectTop > 10) {
                    nextProject = project;
                    break;
                }
            }
            
            if (nextProject) {
                // Scroll to this project
                // We use scrollIntoView or manual calculation
                // Manual calculation is safer for "snap to top"
                
                // Calculate target scroll position
                // target = currentScroll + distance to project
                // distance = project.getBoundingClientRect().top - containerTop
                
                const distance = nextProject.getBoundingClientRect().top - containerTop;
                
                projectsContainer.scrollTo({
                    top: currentScroll + distance,
                    behavior: 'smooth'
                });
            } else {
                // If no next project (at bottom), maybe scroll to top?
                // Or just do nothing. User didn't specify loop.
                // Let's just scroll to top if we are at the very end?
                // "scrolls to snap the next project to the top everytime"
                // If we are at the last one, there is no next project.
            }
        });
    }
}

function syncProjectHeight() {
    const aboutSection = document.getElementById('about-section');
    const projectsSection = document.getElementById('projects-section');
    const projectsContainer = projectsSection?.querySelector('.projects-container');
    
    if (!aboutSection || !projectsSection || !projectsContainer) return;
    
    let height = aboutSection.offsetHeight;
    
    // If about section is hidden, we need to temporarily show it to measure
    if (height === 0 && window.getComputedStyle(aboutSection).display === 'none') {
        const prevDisplay = aboutSection.style.display;
        const prevVisibility = aboutSection.style.visibility;
        const prevPosition = aboutSection.style.position;
        
        aboutSection.style.visibility = 'hidden';
        aboutSection.style.position = 'absolute';
        aboutSection.style.display = 'flex'; // or block, depending on layout. It was flex in CSS?
        // checking CSS... .notes-container is flex.
        
        height = aboutSection.offsetHeight;
        
        aboutSection.style.display = prevDisplay;
        aboutSection.style.visibility = prevVisibility;
        aboutSection.style.position = prevPosition;
    }
    
    if (height > 0) {
        projectsContainer.style.height = `${height}px`;
    }
}

// Sync on resize
window.addEventListener('resize', () => {
    // Debounce slightly or just run
    requestAnimationFrame(syncProjectHeight);
});

// Initialize navigation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
} else {
    initNavigation();
}


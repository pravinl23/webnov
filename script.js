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
        
        // Update active state on all links
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.section === section);
        });
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
}

// Initialize navigation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
} else {
    initNavigation();
}


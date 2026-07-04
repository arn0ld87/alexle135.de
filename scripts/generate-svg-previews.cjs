const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '../public/media');

const images = [
  {
    filename: 'docker_container_preview.svg',
    title: 'Docker Container',
    subtitle: 'Einfach erklärt',
    colors: ['#0ea5e9', '#2563eb'], // Sky to Blue
    icon: 'docker',
  },
  {
    filename: 'devops_ci_cd_preview.svg',
    title: 'DevOps & CI/CD',
    subtitle: 'Automatisierung',
    colors: ['#8b5cf6', '#d946ef'], // Violet to Fuchsia
    icon: 'infinity',
  },
  {
    filename: 'it_automation_preview.svg',
    title: 'IT Automatisierung',
    subtitle: 'Für KMU',
    colors: ['#10b981', '#059669'], // Emerald
    icon: 'cog',
  },
  {
    filename: 'kubernetes_preview.svg',
    title: 'Kubernetes',
    subtitle: 'Orchestrierung',
    colors: ['#3b82f6', '#1d4ed8'], // Blue
    icon: 'ship',
  },
  {
    filename: 'linux_commands_preview.svg',
    title: 'Linux Befehle',
    subtitle: 'Für Einsteiger',
    colors: ['#f59e0b', '#d97706'], // Amber
    icon: 'terminal',
  },
  {
    filename: 'proxmox_homelab_preview.svg',
    title: 'Proxmox Homelab',
    subtitle: 'Server Setup',
    colors: ['#f97316', '#ea580c'], // Orange
    icon: 'server',
  },
  {
    filename: 'fisi_tools_preview.svg',
    title: 'FISI Tools',
    subtitle: 'Produktivität',
    colors: ['#6366f1', '#4f46e5'], // Indigo
    icon: 'tools',
  },
  {
    filename: 'ki_tools_preview.svg',
    title: 'KI Tools',
    subtitle: 'Umschulung 2025',
    colors: ['#ec4899', '#be185d'], // Pink
    icon: 'chip',
  },
  {
    filename: 'docker_ubuntu_setup_preview.svg',
    title: 'Docker Setup',
    subtitle: 'Ubuntu 24.04',
    colors: ['#e11d48', '#be123c'], // Rose
    icon: 'ubuntu',
  },
  {
    filename: 'chronoextractor_preview.svg',
    title: 'ChronoExtractor',
    subtitle: 'KI Termin-Analyse',
    colors: ['#06b6d4', '#0891b2'], // Cyan
    icon: 'calendar',
  },
  {
    filename: 'ki_nachrichten_portal_preview.svg',
    title: 'KI News Portal',
    subtitle: 'Automated News',
    colors: ['#8b5cf6', '#6d28d9'], // Violet
    icon: 'globe',
  },
  {
    filename: 'm2_schnittstelle_preview.svg',
    title: 'M.2 Schnittstelle',
    subtitle: 'Hardware Vortrag',
    colors: ['#14b8a6', '#0f766e'], // Teal
    icon: 'chip',
  },
  {
    filename: 'ticket_routing_preview.svg',
    title: 'Ticket Routing',
    subtitle: 'KI Agenten',
    colors: ['#64748b', '#475569'], // Slate
    icon: 'mail',
  },
];

const generateSVG = (config) => {
  const { title, subtitle, colors } = config;
  const gradientId = `grad-${Math.random().toString(36).substr(2, 9)}`;

  return `
<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors[0]};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colors[1]};stop-opacity:1" />
    </linearGradient>
    <filter id="glass" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="blur" />
      <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1280" height="720" fill="#0f172a" />
  
  <!-- Abstract Shapes -->
  <circle cx="0" cy="0" r="500" fill="url(#${gradientId})" opacity="0.2" />
  <circle cx="1280" cy="720" r="600" fill="url(#${gradientId})" opacity="0.15" />
  
  <!-- Glass Card -->
  <rect x="240" y="160" width="800" height="400" rx="24" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
  
  <!-- Content -->
  <g text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">
    <!-- Title -->
    <text x="640" y="350" fill="white" font-size="72" font-weight="800" style="text-shadow: 0 4px 12px rgba(0,0,0,0.5)">${title}</text>
    
    <!-- Subtitle -->
    <text x="640" y="420" fill="rgba(255,255,255,0.8)" font-size="36" font-weight="400" letter-spacing="1">${subtitle}</text>
  </g>
  
  <!-- Decorative Elements -->
  <path d="M240 160 L1040 160" stroke="url(#${gradientId})" stroke-width="2" opacity="0.5" />
  <path d="M240 560 L1040 560" stroke="url(#${gradientId})" stroke-width="2" opacity="0.5" />
  
</svg>`;
};

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate images
images.forEach((img) => {
  const svgContent = generateSVG(img);
  fs.writeFileSync(path.join(outputDir, img.filename), svgContent);
  console.log(`Generated ${img.filename}`);
});

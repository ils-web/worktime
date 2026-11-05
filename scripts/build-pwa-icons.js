const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function makeHtml(size, isMaskable) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    margin: 0;
    padding: 0;
    width: 1000px;
    height: 1000px;
    background: transparent;
    overflow: hidden;
  }
  svg {
    position: absolute;
    top: 0;
    left: 0;
    width: ${size}px;
    height: ${size}px;
  }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <!-- Rich emerald gradient -->
    <linearGradient id="emGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="35%" stop-color="#10b981"/>
      <stop offset="85%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>

    <!-- Radial central lighting -->
    <radialGradient id="centerGlow" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#6ee7b7" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#047857" stop-opacity="0"/>
    </radialGradient>

    <!-- Subtle specular glass shine -->
    <linearGradient id="specular" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity="0.0"/>
    </linearGradient>

    <!-- 3D drop shadow -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#022c22" flood-opacity="0.6"/>
    </filter>

    <filter id="dotShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background: full-bleed square if maskable/iOS, or squircle if any -->
  <rect width="512" height="512" ${isMaskable ? '' : 'rx="115"'} fill="url(#emGrad)"/>
  <rect width="512" height="512" ${isMaskable ? '' : 'rx="115"'} fill="url(#centerGlow)"/>
  <rect width="512" height="256" ${isMaskable ? '' : 'rx="115"'} fill="url(#specular)"/>
  <rect width="506" height="506" x="3" y="3" ${isMaskable ? '' : 'rx="113"'} fill="none" stroke="#a7f3d0" stroke-width="3" opacity="0.4"/>

  <!-- Main Clock Graphic (Radius < 170px, securely within the 80% safe zone for maskable) -->
  <g filter="url(#shadow)">
    <!-- Outer Precision Dial Ring -->
    <circle cx="256" cy="256" r="142" stroke="#ffffff" stroke-width="20" fill="rgba(6, 78, 59, 0.25)"/>

    <!-- 4 Cardinal Major Hour Ticks (12, 3, 6, 9) -->
    <line x1="256" y1="134" x2="256" y2="152" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
    <line x1="378" y1="256" x2="360" y2="256" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
    <line x1="256" y1="378" x2="256" y2="360" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
    <line x1="134" y1="256" x2="152" y2="256" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>

    <!-- Clock Hands (10:10 Position) -->
    <!-- Hour Hand -->
    <line x1="256" y1="256" x2="182" y2="174" stroke="#ffffff" stroke-width="22" stroke-linecap="round"/>

    <!-- Minute Hand -->
    <line x1="256" y1="256" x2="338" y2="164" stroke="#ffffff" stroke-width="18" stroke-linecap="round"/>

    <!-- Center Pivot Cap -->
    <circle cx="256" cy="256" r="24" fill="#047857"/>
    <circle cx="256" cy="256" r="16" fill="#ffffff"/>
    <circle cx="256" cy="256" r="8" fill="#10b981"/>

    <!-- Geofence Verified / GPS Radar Pulse Accent -->
    <circle cx="352" cy="158" r="16" fill="#ffffff" filter="url(#dotShadow)"/>
    <circle cx="352" cy="158" r="11" fill="#059669"/>
    <circle cx="352" cy="158" r="5" fill="#34d399"/>
  </g>
</svg>
</body>
</html>`;
}

function render(targetPath, size, isMaskable) {
  const tempHtml = path.resolve(`scripts/temp-${size}-${isMaskable ? 'mask' : 'any'}.html`);
  fs.writeFileSync(tempHtml, makeHtml(size, isMaskable));
  const absOut = path.resolve(targetPath);
  execSync(`"${chromePath}" --headless --disable-gpu --screenshot="${absOut}" --window-size=${size},${size} --default-background-color=00000000 "file:///${tempHtml.replace(/\\\\/g, '/')}"`);
  console.log(`Rendered ${targetPath} (${size}x${size}): ${fs.statSync(absOut).size} bytes`);
  try { fs.unlinkSync(tempHtml); } catch {}
}

const icon512 = 'apps/web/public/icons/icon-512.png';
const icon192 = 'apps/web/public/icons/icon-192.png';
const iconMaskable = 'apps/web/public/icons/icon-maskable-512.png';
const appleIcon = 'apps/web/public/apple-touch-icon.png';
const faviconSvg = path.resolve('apps/web/public/favicon.svg');

render(icon512, 512, false);
render(icon192, 192, false);
render(iconMaskable, 512, true);
render(appleIcon, 180, true);

// Save pure vector favicon.svg
const pureSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="emGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="35%" stop-color="#10b981"/>
      <stop offset="85%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <radialGradient id="centerGlow" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#6ee7b7" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#047857" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="specular" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity="0.0"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#022c22" flood-opacity="0.6"/>
    </filter>
  </defs>

  <rect width="512" height="512" rx="115" fill="url(#emGrad)"/>
  <rect width="512" height="512" rx="115" fill="url(#centerGlow)"/>
  <rect width="512" height="256" rx="115" fill="url(#specular)"/>
  <rect width="506" height="506" x="3" y="3" rx="113" fill="none" stroke="#a7f3d0" stroke-width="3" opacity="0.4"/>

  <g filter="url(#shadow)">
    <circle cx="256" cy="256" r="142" stroke="#ffffff" stroke-width="20" fill="rgba(6, 78, 59, 0.25)"/>
    <line x1="256" y1="134" x2="256" y2="152" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
    <line x1="378" y1="256" x2="360" y2="256" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
    <line x1="256" y1="378" x2="256" y2="360" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
    <line x1="134" y1="256" x2="152" y2="256" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
    <line x1="256" y1="256" x2="182" y2="174" stroke="#ffffff" stroke-width="22" stroke-linecap="round"/>
    <line x1="256" y1="256" x2="338" y2="164" stroke="#ffffff" stroke-width="18" stroke-linecap="round"/>
    <circle cx="256" cy="256" r="24" fill="#047857"/>
    <circle cx="256" cy="256" r="16" fill="#ffffff"/>
    <circle cx="256" cy="256" r="8" fill="#10b981"/>
    <circle cx="352" cy="158" r="16" fill="#ffffff"/>
    <circle cx="352" cy="158" r="11" fill="#059669"/>
    <circle cx="352" cy="158" r="5" fill="#34d399"/>
  </g>
</svg>`;

fs.writeFileSync(faviconSvg, pureSvg);
console.log('Saved apps/web/public/favicon.svg');
console.log('Done!');

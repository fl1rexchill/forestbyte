// Линейные иллюстрации комплектов (SVG 800×1000). Используются, пока в _src/photos/ нет фото модели.

const wall = '#ece6dd';
const wall2 = '#e6dfd4';
const floor = '#ddd5c8';

function mirrorGrad(id) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f4f6f5"/><stop offset=".55" stop-color="#dfe6e6"/><stop offset="1" stop-color="#cfd9da"/>
    </linearGradient>`;
}

function vanity(p, type) {
  const x = 190, w = 420, top = 556, h = type === 'drawers' ? 220 : 196;
  let fronts = '';
  if (type === 'shelf') {
    fronts = `
      <rect x="${x + 10}" y="${top + 24}" width="${w / 2 - 14}" height="${h - 36}" rx="6" fill="${p.front}"/>
      <rect x="${x + w / 2 + 4}" y="${top + 24}" width="${w / 2 - 14}" height="${h - 36}" rx="6" fill="${p.front}"/>
      <rect x="${x + w / 2 - 22}" y="${top + 60}" width="4" height="46" rx="2" fill="${p.accent}"/>
      <rect x="${x + w / 2 + 18}" y="${top + 60}" width="4" height="46" rx="2" fill="${p.accent}"/>`;
  } else if (type === 'round') {
    let ribs = '';
    for (let i = x + 22; i < x + w - 12; i += 13) ribs += `<rect x="${i}" y="${top + 26}" width="6" height="${h - 40}" rx="3" fill="${p.accent}" opacity=".55"/>`;
    fronts = `<rect x="${x + 10}" y="${top + 24}" width="${w - 20}" height="${h - 36}" rx="6" fill="${p.front}"/>${ribs}`;
  } else {
    const dh = (h - 44) / 3;
    for (let i = 0; i < 3; i++) {
      const y = top + 24 + i * (dh + 4);
      fronts += `<rect x="${x + 10}" y="${y}" width="${w - 20}" height="${dh}" rx="6" fill="${p.front}"/>
        <rect x="${x + 10}" y="${y}" width="${w - 20}" height="8" rx="3" fill="${p.accent}"/>`;
    }
  }
  return `
    <ellipse cx="400" cy="${top + h + 70}" rx="230" ry="16" fill="#000" opacity=".06"/>
    <rect x="${x}" y="${top}" width="${w}" height="${h}" rx="10" fill="${p.body}"/>
    ${fronts}
    <rect x="${x - 8}" y="${top - 18}" width="${w + 16}" height="24" rx="8" fill="${p.top}"/>
    <path d="M${x + 110} ${top - 18} q0 -14 14 -14 h152 q14 0 14 14 z" fill="${p.top}" opacity=".9"/>
    <rect x="${x + 124}" y="${top - 26}" width="152" height="6" rx="3" fill="#000" opacity=".07"/>
    <path d="M400 ${top - 32} v-44 q0 -12 12 -12 h26" fill="none" stroke="#b9bdbf" stroke-width="9" stroke-linecap="round"/>
    <rect x="386" y="${top - 38}" width="28" height="12" rx="4" fill="#c9cccd"/>`;
}

function mirror(p, type, gid) {
  if (type === 'round') {
    return `
      <circle cx="400" cy="300" r="176" fill="#fffbef" opacity=".55"/>
      <circle cx="400" cy="300" r="160" fill="none" stroke="#fff6dc" stroke-width="10" opacity=".9"/>
      <circle cx="400" cy="300" r="152" fill="url(#${gid})"/>
      <path d="M300 260 l90 -90 M318 312 l130 -130" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".45"/>`;
  }
  if (type === 'shelf') {
    return `
      <rect x="244" y="150" width="312" height="300" rx="14" fill="${p.front}"/>
      <rect x="254" y="160" width="292" height="280" rx="10" fill="url(#${gid})"/>
      <path d="M290 250 l90 -90 M300 320 l150 -150" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".45"/>
      <rect x="244" y="462" width="312" height="14" rx="5" fill="${p.front}"/>
      <rect x="276" y="426" width="22" height="36" rx="6" fill="#d9cdb8"/>
      <rect x="306" y="436" width="18" height="26" rx="5" fill="#b8c9c7"/>
      <rect x="500" y="440" width="26" height="22" rx="7" fill="#efece6"/>`;
  }
  // drawers: зеркало + навесной шкаф с открытыми полками
  return `
    <rect x="178" y="170" width="258" height="300" rx="14" fill="#cfcac2"/>
    <rect x="186" y="178" width="242" height="284" rx="10" fill="url(#${gid})"/>
    <path d="M220 270 l80 -80 M232 340 l130 -130" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".45"/>
    <rect x="470" y="130" width="160" height="340" rx="10" fill="${p.body}" stroke="${p.accent}" stroke-width="3"/>
    <rect x="484" y="146" width="132" height="92" rx="6" fill="${p.front}"/>
    <rect x="484" y="250" width="132" height="4" fill="${p.accent}"/>
    <rect x="484" y="352" width="132" height="4" fill="${p.accent}"/>
    <rect x="496" y="306" width="92" height="46" rx="8" fill="#d8e3e1"/>
    <rect x="496" y="290" width="92" height="20" rx="8" fill="#e8efee"/>
    <rect x="500" y="404" width="30" height="48" rx="7" fill="#d9cdb8"/>
    <rect x="540" y="418" width="24" height="34" rx="6" fill="#b8c9c7"/>`;
}

export function illustration(product) {
  const p = product.palette;
  const gid = `m-${product.slug}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" role="img" aria-label="Иллюстрация: ${product.title}">
  <defs>${mirrorGrad(gid)}
    <linearGradient id="w-${product.slug}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wall}"/><stop offset="1" stop-color="${wall2}"/></linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#w-${product.slug})"/>
  <rect y="880" width="800" height="120" fill="${floor}"/>
  <path d="M0 880 H800" stroke="#cfc6b8" stroke-width="2"/>
  ${mirror(p, product.art, gid)}
  ${vanity(p, product.art)}
</svg>
`;
}

// Декоративные волны для hero и разделителей
export function waves(stroke = 'currentColor') {
  const lines = [];
  for (let i = 0; i < 7; i++) {
    const y = 40 + i * 22;
    lines.push(`<path d="M-200 ${y} C 0 ${y - 26}, 200 ${y + 26}, 400 ${y} S 800 ${y - 26}, 1000 ${y} S 1400 ${y + 26}, 1600 ${y}" fill="none" stroke="${stroke}" stroke-width="1.2" opacity="${(0.55 - i * 0.06).toFixed(2)}"/>`);
  }
  return lines.join('');
}

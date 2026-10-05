function textColorFor(hex) {
  if (!hex) return '#ffffff';
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return '#ffffff';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#000000' : '#ffffff';
}

function nameClass(text, isEnglish = false) {
  const length = [...(text || '')].length;
  if (isEnglish) {
    if (length >= 28) return ' compact-more';
    if (length >= 20) return ' compact';
  } else {
    if (length >= 12) return ' compact-more';
    if (length >= 9) return ' compact';
  }
  return '';
}

function bandClass(text) {
  return [...(text || '')].length >= 17 ? ' compact' : '';
}

export function buildPrintPages(root, members) {
  root.replaceChildren();
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(members.length / pageSize));

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const page = document.createElement('section');
    page.className = 'badge-page';
    const chunk = members.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

    for (let i = 0; i < pageSize; i++) {
      const member = chunk[i];
      const cell = document.createElement('article');
      cell.className = member ? 'badge-cell' : 'badge-cell badge-empty';

      if (member) {
        const name = document.createElement('div');
        name.className = `badge-name${nameClass(member.nameJa)}`;
        name.textContent = member.nameJa || '';
        cell.appendChild(name);

        if (member.nameEn) {
          const en = document.createElement('div');
          en.className = `badge-en${nameClass(member.nameEn, true)}`;
          en.textContent = member.nameEn;
          cell.appendChild(en);
        }

        if (member.badgeText) {
          const band = document.createElement('div');
          band.className = `badge-band${bandClass(member.badgeText)}`;
          const bg = member.bandColor || '#000000';
          band.style.backgroundColor = bg;
          band.style.color = textColorFor(bg);
          band.textContent = member.badgeText;
          cell.appendChild(band);
        }
      }
      page.appendChild(cell);
    }
    root.appendChild(page);
  }
}

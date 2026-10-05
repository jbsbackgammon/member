function textColorFor(hex) {
  if (!hex) return '#000000';
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return '#000000';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#000000' : '#ffffff';
}

function isForeignName(text) {
  const value = String(text || '');
  const hasLatin = /[A-Za-z]/.test(value);
  const hasJapanese = /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
  return hasLatin && !hasJapanese;
}

function nameClass(text, isEnglish = false) {
  const value = String(text || '');
  if (isEnglish) return '';

  if (isForeignName(value)) return ' foreign';

  const length = [...value.replace(/\s/g, '')].length;
  if (length >= 7) return ' compact-more';
  return '';
}

function bandClass(text) {
  const value = String(text || '');
  const weightedLength = [...value].reduce((sum, ch) => {
    return sum + (/[A-Za-z0-9'"‘’･・.\-]/.test(ch) ? 0.55 : 1);
  }, 0);

  if (weightedLength >= 13.5) return ' compact-more';
  if (weightedLength >= 11.5) return ' compact';
  return '';
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
          band.className = `badge-band${bandClass(member.badgeText)}${member.bandColor ? '' : ' no-color'}`;
          if (member.bandColor) {
            band.style.backgroundColor = member.bandColor;
            band.style.color = textColorFor(member.bandColor);
          }
          band.textContent = member.badgeText;
          cell.appendChild(band);
        }
      }
      page.appendChild(cell);
    }
    root.appendChild(page);
  }
}

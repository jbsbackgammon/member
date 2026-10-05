import { buildPrintPages } from './print.js';

const $ = (selector, root = document) => root.querySelector(selector);
const listEl = $('#memberList');
const emptyState = $('#emptyState');
const emptyTitle = $('#emptyTitle');
const emptyMessage = $('#emptyMessage');
const template = $('#memberRowTemplate');
const printBtn = $('#printBtn');
const selectedCount = $('#selectedCount');
const searchInput = $('#searchInput');
const selectVisibleBtn = $('#selectVisibleBtn');
const printRoot = $('#printRoot');

let members = [];
const selectedIds = new Set();

function normalizeColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '';
}

function normalizePhotoPath(value) {
  return String(value || '').trim();
}

function normalizeMember(raw, index) {
  const photos = Array.isArray(raw?.photos)
    ? raw.photos.map(normalizePhotoPath).filter(Boolean)
    : [];

  const mainPhoto = normalizePhotoPath(raw?.mainPhoto);

  return {
    id: String(raw?.id || `member-${index + 1}`),
    sortIndex: Number.isFinite(raw?.sortIndex) ? raw.sortIndex : index,
    nameJa: String(raw?.name ?? raw?.nameJa ?? '').trim(),
    nameEn: String(raw?.nameEn ?? '').trim(),
    photos,
    mainPhoto: mainPhoto || photos[0] || '',
    badgeText: String(raw?.badgeText ?? '').trim(),
    bandColor: normalizeColor(raw?.bandColor),
  };
}

function assetUrl(path) {
  if (!path) return '';
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith('/')) return path;
  return new URL(path, document.baseURI).href;
}

function findMember(id) {
  return members.find(member => member.id === id);
}

function searchText(member) {
  return `${member.nameJa} ${member.nameEn} ${member.badgeText}`.toLocaleLowerCase('ja');
}

function currentQuery() {
  return searchInput.value.trim().toLocaleLowerCase('ja');
}

function isVisibleMember(member) {
  const query = currentQuery();
  return !query || searchText(member).includes(query);
}

function updateSelectionUi() {
  selectedCount.textContent = String(selectedIds.size);
  printBtn.disabled = selectedIds.size === 0;

  const visible = members.filter(isVisibleMember);
  const allVisibleSelected = visible.length > 0 && visible.every(member => selectedIds.has(member.id));
  selectVisibleBtn.textContent = allVisibleSelected ? '表示中を全解除' : '表示中を全選択';
}

function setBandColor(member, row, color) {
  member.bandColor = normalizeColor(color);
  const colorInput = $('.band-color', row);
  if (member.bandColor) colorInput.value = member.bandColor;

  $('.color-none', row).classList.toggle('active', !member.bandColor);
  row.querySelectorAll('.color-presets button').forEach(button => {
    button.classList.toggle(
      'active',
      !!member.bandColor && button.dataset.color.toLowerCase() === member.bandColor.toLowerCase(),
    );
  });
}

function renderPhotos(member, row) {
  const strip = $('.photo-strip', row);
  const mainImg = $('.main-photo', row);
  const placeholder = $('.photo-placeholder', row);
  const mainLabel = $('.main-photo-label', row);
  const mainPhoto = member.mainPhoto || member.photos[0] || '';

  strip.replaceChildren();
  $('.photo-count', row).textContent = `${member.photos.length}枚`;

  if (mainPhoto) {
    mainImg.src = assetUrl(mainPhoto);
    mainImg.hidden = false;
    placeholder.hidden = true;
    mainLabel.hidden = false;
  } else {
    mainImg.removeAttribute('src');
    mainImg.hidden = true;
    placeholder.hidden = false;
    mainLabel.hidden = true;
  }

  member.photos.forEach(photo => {
    const thumb = document.createElement('div');
    const isMain = photo === mainPhoto;
    thumb.className = `photo-thumb${isMain ? ' main' : ''}`;
    thumb.title = isMain ? 'メイン画像' : '顔写真';

    const img = document.createElement('img');
    img.src = assetUrl(photo);
    img.alt = isMain ? 'メイン顔写真' : '顔写真';
    thumb.appendChild(img);

    if (isMain) {
      const mark = document.createElement('span');
      mark.className = 'photo-main-mark';
      mark.textContent = '★';
      mark.setAttribute('aria-label', 'メイン画像');
      thumb.appendChild(mark);
    }

    strip.appendChild(thumb);
  });
}

function bindMemberRow(member, row) {
  row.dataset.memberId = member.id;

  $('.member-name-ja', row).textContent = member.nameJa;
  $('.member-name-en', row).textContent = member.nameEn;

  const printCheck = $('.print-check', row);
  const badgeText = $('.badge-text', row);
  const colorInput = $('.band-color', row);

  printCheck.checked = selectedIds.has(member.id);
  badgeText.value = member.badgeText;
  if (member.bandColor) colorInput.value = member.bandColor;

  renderPhotos(member, row);
  setBandColor(member, row, member.bandColor);

  printCheck.addEventListener('change', () => {
    if (printCheck.checked) selectedIds.add(member.id);
    else selectedIds.delete(member.id);
    updateSelectionUi();
  });

  badgeText.addEventListener('input', () => {
    member.badgeText = badgeText.value;
    applySearch();
  });

  $('.color-none', row).addEventListener('click', () => setBandColor(member, row, ''));
  colorInput.addEventListener('input', () => setBandColor(member, row, colorInput.value));
  row.querySelectorAll('.color-presets button').forEach(button => {
    button.addEventListener('click', () => setBandColor(member, row, button.dataset.color));
  });
}

function renderList() {
  listEl.replaceChildren();
  emptyState.hidden = members.length !== 0;

  members.forEach(member => {
    const row = template.content.firstElementChild.cloneNode(true);
    bindMemberRow(member, row);
    listEl.appendChild(row);
  });

  applySearch();
}

function applySearch() {
  for (const row of listEl.children) {
    const member = findMember(row.dataset.memberId);
    row.classList.toggle('is-filtered', !member || !isVisibleMember(member));
  }
  updateSelectionUi();
}

async function loadMembers() {
  const response = await fetch('./data/members.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`members.json の取得に失敗しました (${response.status})`);
  }

  const data = await response.json();
  const source = Array.isArray(data) ? data : data?.members;
  if (!Array.isArray(source)) {
    throw new Error('members.json の形式が正しくありません。');
  }

  members = source
    .map(normalizeMember)
    .sort((a, b) => a.sortIndex - b.sortIndex || a.nameJa.localeCompare(b.nameJa, 'ja'));
}

searchInput.addEventListener('input', applySearch);

selectVisibleBtn.addEventListener('click', () => {
  const visible = members.filter(isVisibleMember);
  const allSelected = visible.length > 0 && visible.every(member => selectedIds.has(member.id));

  visible.forEach(member => {
    if (allSelected) selectedIds.delete(member.id);
    else selectedIds.add(member.id);
  });

  for (const row of listEl.children) {
    $('.print-check', row).checked = selectedIds.has(row.dataset.memberId);
  }

  updateSelectionUi();
});

printBtn.addEventListener('click', () => {
  const selected = members.filter(member => selectedIds.has(member.id));
  if (!selected.length) return;
  buildPrintPages(printRoot, selected);
  requestAnimationFrame(() => window.print());
});

window.addEventListener('afterprint', () => printRoot.replaceChildren());

try {
  await loadMembers();
  renderList();
} catch (error) {
  console.error(error);
  members = [];
  emptyTitle.textContent = '会員情報を読み込めませんでした。';
  emptyMessage.textContent = error.message || 'data/members.json を確認してください。';
  emptyState.hidden = false;
  updateSelectionUi();
}

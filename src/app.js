import { buildPrintPages } from './print.js';
import { createZip } from './zip.js';

const $ = (selector, root = document) => root.querySelector(selector);
const listEl = $('#memberList');
const emptyState = $('#emptyState');
const emptyTitle = $('#emptyTitle');
const emptyMessage = $('#emptyMessage');
const template = $('#memberRowTemplate');
const photoExportBtn = $('#photoExportBtn');
const printBtn = $('#printBtn');
const searchInput = $('#searchInput');
const clearAllBtn = $('#clearAllBtn');
const printRoot = $('#printRoot');

let members = [];
const selectedIds = new Set();

function normalizeColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '';
}

function normalizePhotoPath(value) {
  return String(value || '').trim();
}

function normalizeMember(raw, index) {
  return {
    id: String(raw?.id || raw?.filename || `member-${index + 1}`),
    nameJa: String(raw?.name ?? raw?.nameJa ?? '').trim(),
    nameEn: String(raw?.nameEn ?? '').trim(),
    photo: normalizePhotoPath(raw?.photo),
    filename: String(raw?.filename ?? '').trim(),
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

function selectedMembers() {
  return members.filter(member => selectedIds.has(member.id));
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
  const hasSelection = selectedIds.size > 0;
  photoExportBtn.disabled = !hasSelection;
  printBtn.disabled = !hasSelection;
  clearAllBtn.disabled = !hasSelection;
}

function setBandColor(member, row, color) {
  member.bandColor = normalizeColor(color);

  row.querySelectorAll('.color-presets button').forEach(button => {
    const buttonColor = normalizeColor(button.dataset.color);
    button.classList.toggle('active', buttonColor === member.bandColor);
  });
}

function renderPhoto(member, row) {
  const image = $('.member-photo', row);
  const placeholder = $('.photo-placeholder', row);

  if (member.photo) {
    image.src = assetUrl(member.photo);
    image.alt = member.filename || `${member.nameJa} 顔写真`;
    image.title = member.filename || '';
    image.hidden = false;
    placeholder.hidden = true;
  } else {
    image.removeAttribute('src');
    image.hidden = true;
    placeholder.hidden = false;
  }
}

function bindMemberRow(member, row) {
  row.dataset.memberId = member.id;

  $('.member-name-ja', row).textContent = member.nameJa;
  $('.member-name-en', row).textContent = member.nameEn;

  const printCheck = $('.print-check', row);
  const badgeText = $('.badge-text', row);

  printCheck.checked = selectedIds.has(member.id);
  badgeText.value = member.badgeText;

  renderPhoto(member, row);
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

function clearAllSelections() {
  selectedIds.clear();
  listEl.querySelectorAll('.print-check').forEach(check => {
    check.checked = false;
  });
  updateSelectionUi();
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportSelectedPhotos() {
  const selected = selectedMembers();
  if (!selected.length) return;

  photoExportBtn.disabled = true;
  const originalText = photoExportBtn.textContent;
  photoExportBtn.textContent = '作成中…';

  try {
    const files = [];
    for (const member of selected) {
      const response = await fetch(assetUrl(member.photo), { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`${member.filename || member.nameJa} の取得に失敗しました (${response.status})`);
      }
      files.push({
        name: member.filename || member.photo.split('/').pop() || `${member.nameJa}.png`,
        data: new Uint8Array(await response.arrayBuffer()),
      });
    }

    triggerDownload(createZip(files), '顔写真.zip');
  } catch (error) {
    console.error(error);
    alert(error.message || '顔写真ZIPの作成に失敗しました。');
  } finally {
    photoExportBtn.textContent = originalText;
    updateSelectionUi();
  }
}

async function loadMembers() {
  const dataUrl = new URL('../data/members.json?v=11', import.meta.url);
  const response = await fetch(dataUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`会員一覧の取得に失敗しました (${response.status})`);
  }

  const data = await response.json();
  const source = Array.isArray(data) ? data : data?.members;
  if (!Array.isArray(source)) {
    throw new Error('自動生成された会員一覧の形式が正しくありません。');
  }

  members = source
    .map(normalizeMember)
    .filter(member => member.nameJa && member.nameEn && member.photo)
    .sort((a, b) => a.nameJa.localeCompare(b.nameJa, 'ja'));
}

searchInput.addEventListener('input', applySearch);
clearAllBtn.addEventListener('click', clearAllSelections);
photoExportBtn.addEventListener('click', exportSelectedPhotos);

printBtn.addEventListener('click', () => {
  const selected = selectedMembers();
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
  emptyMessage.textContent = error.message || 'images/ のファイル名を確認してください。';
  emptyState.hidden = false;
  updateSelectionUi();
}

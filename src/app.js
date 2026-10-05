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

async function loadMembers() {
  const dataUrl = new URL('../data/members.json?v=9', import.meta.url);
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
  emptyMessage.textContent = error.message || 'images/ のファイル名を確認してください。';
  emptyState.hidden = false;
  updateSelectionUi();
}

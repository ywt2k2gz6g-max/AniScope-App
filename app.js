
'use strict';

const state = {
  anime: [],
  completed: loadCompleted(),
  activeFilter: 'All',
  currentId: null,
  lastPage: 'homePage'
};

const $ = id => document.getElementById(id);
const pages = () => [...document.querySelectorAll('.page')];
const navs = () => [...document.querySelectorAll('.navbtn')];

function loadCompleted() {
  try {
    const value = JSON.parse(localStorage.getItem('aniscope-completed') || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
function saveCompleted() {
  localStorage.setItem('aniscope-completed', JSON.stringify(state.completed));
}
function byId(id) {
  return state.anime.find(item => item.id === id);
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  })[char]);
}
function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1500);
}
function go(pageId) {
  state.lastPage = pageId;
  pages().forEach(page => page.classList.toggle('active', page.id === pageId));
  navs().forEach(button => button.classList.toggle('active', button.dataset.page === pageId));
  if (pageId === 'completedPage') renderCompleted();
  if (pageId === 'watchlistPage') renderWatchlist();
  if (pageId === 'searchPage') requestAnimationFrame(() => $('searchInput').focus({preventScroll:true}));
  window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0;
}
function row(item) {
  return `<button type="button" class="anime-row" data-open="${escapeHTML(item.id)}">
    <img src="${escapeHTML(item.thumbnail || item.image)}" alt="">
    <div class="anime-copy">
      <h4><span class="rank">#${item.rank}</span> ${escapeHTML(item.title)}</h4>
      <p>${escapeHTML(item.year)} • ${escapeHTML(item.status)} • ${escapeHTML(item.moods.slice(0,2).join(' / '))}</p>
    </div>
    <div class="score-pill">${item.score.toFixed(1)}</div>
  </button>`;
}
function bindRows(root = document) {
  root.querySelectorAll('[data-open]').forEach(button => {
    button.addEventListener('click', () => openDetail(button.dataset.open));
  });
}
function updateCounts() {
  $('completedCount').textContent = state.completed.length;
  $('watchCount').textContent = state.anime.length - state.completed.length;
}
function renderHome() {
  const top = state.anime.find(item => !state.completed.includes(item.id)) || state.anime[0];
  $('featuredCard').innerHTML = `<img src="${escapeHTML(top.image)}" alt="">
    <div class="rec-content">
      <span class="kicker">#${top.rank} • ${top.confidence}% MATCH</span>
      <h3>${escapeHTML(top.title)}</h3>
      <p>${escapeHTML(top.verdict)}</p>
    </div>`;
  $('featuredCard').onclick = () => openDetail(top.id);

  const categories = [
    ['🎨','Best Visuals','Beautiful'], ['🔥','Most Hype','Hype'],
    ['❤️','Emotional','Emotional'], ['🏀','Sports','Sports'],
    ['🧠','Mind Games','Mind Games'], ['🌍','World-building','World-building']
  ];
  $('homeCategories').innerHTML = categories.map(([icon,label,filter]) =>
    `<button type="button" class="category" data-category="${filter}">
      <b>${icon} ${label}</b><span>Explore personalized picks</span>
    </button>`).join('');

  document.querySelectorAll('[data-category]').forEach(button => {
    button.addEventListener('click', () => {
      state.activeFilter = button.dataset.category;
      go('watchlistPage');
    });
  });

  $('homeTop10').innerHTML = state.anime.slice(0,10).map(row).join('');
  bindRows($('homeTop10'));
  updateCounts();
}
const filters = ['All','Sports','Beautiful','Hype','Emotional','Mind Games','World-building','Complete','Ongoing'];
function matches(item, filter) {
  if (filter === 'All') return true;
  if (filter === 'Complete') return item.statusType === 'complete';
  if (filter === 'Ongoing') return item.statusType === 'ongoing' || item.statusType === 'paused';
  const haystack = [...item.genres, ...item.moods, ...item.tags].join(' ').toLowerCase();
  return haystack.includes(filter.toLowerCase());
}
function renderFilterChips(container, rerender) {
  container.innerHTML = filters.map(filter =>
    `<button type="button" class="chip ${state.activeFilter === filter ? 'active' : ''}" data-filter="${filter}">${filter}</button>`
  ).join('');
  container.querySelectorAll('[data-filter]').forEach(button => {
    button.addEventListener('click', () => {
      state.activeFilter = button.dataset.filter;
      rerender();
    });
  });
}
function renderWatchlist() {
  renderFilterChips($('watchFilters'), renderWatchlist);
  const items = state.anime
    .filter(item => !state.completed.includes(item.id))
    .filter(item => matches(item, state.activeFilter));
  $('watchlistResults').innerHTML = items.length
    ? items.map(row).join('')
    : '<div class="empty">No watchlist titles match this filter.</div>';
  bindRows($('watchlistResults'));
  updateCounts();
}
function renderSearch() {
  renderFilterChips($('searchChips'), renderSearch);
  const query = $('searchInput').value.trim().toLowerCase();
  const items = state.anime.filter(item => {
    const haystack = [item.title, ...item.genres, ...item.moods, ...item.tags].join(' ').toLowerCase();
    return matches(item, state.activeFilter) && (!query || haystack.includes(query));
  });
  $('searchResults').innerHTML = items.length
    ? items.map(row).join('')
    : '<div class="empty">No matches found.</div>';
  bindRows($('searchResults'));
}
function renderCompleted() {
  const items = state.anime.filter(item => state.completed.includes(item.id));
  $('completedResults').innerHTML = items.length
    ? `<div class="anime-list">${items.map(row).join('')}</div>`
    : `<div class="empty"><b>No completed titles yet.</b><br><br>
       Open an anime profile and tap <b>Mark completed</b>. It will move here.</div>`;
  bindRows($('completedResults'));
  updateCounts();
}
function openDetail(id) {
  const item = byId(id);
  if (!item) return;

  state.currentId = id;
  $('detailImage').src = item.image;
  $('detailImage').alt = item.title;
  $('detailName').textContent = item.title;
  $('detailRank').textContent = `#${item.rank} • ${item.confidence}% MATCH`;
  $('detailSubtitle').textContent = `${item.year} • ${item.genres.join(' • ')}`;

  const metrics = [
    ['Predicted rating', `${item.score.toFixed(1)}/10`, ''],
    ['Length', item.length, ''],
    ['Time', item.time, ''],
    ['Status', item.status, item.statusType]
  ];
  $('detailMetrics').innerHTML = metrics.map(([label,value,type]) =>
    `<div class="metric"><span>${escapeHTML(label)}</span><b class="status ${escapeHTML(type)}">${escapeHTML(value)}</b></div>`
  ).join('');

  $('detailTags').innerHTML = item.tags.map(tag => `<span>${escapeHTML(tag)}</span>`).join('');
  $('detailScores').innerHTML = Object.entries(item.scores).map(([name,value]) =>
    `<div class="score-card">
      <header><span>${escapeHTML(name)}</span><b>${value}</b></header>
      <div class="bar"><i style="width:${Math.max(0, Math.min(100, Number(value)*10))}%"></i></div>
    </div>`).join('');

  const fields = {
    detailVerdict:'verdict', detailWhy:'why', detailMood:'mood', detailFeels:'feels',
    detailHook:'hook', detailWarning:'warning', detailDub:'dub', detailEnding:'ending'
  };
  Object.entries(fields).forEach(([element,key]) => $(element).textContent = item[key]);

  $('detailTips').innerHTML = item.before.map(tip => `<li>${escapeHTML(tip)}</li>`).join('');
  $('completeBtn').textContent = state.completed.includes(id) ? 'Move back to watchlist' : 'Mark completed';

  $('detailView').classList.add('open');
  $('detailView').setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  history.pushState({detail:id}, '', `#anime/${id}`);
}
function closeDetail({fromPopState=false} = {}) {
  $('detailView').classList.remove('open');
  $('detailView').setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
  state.currentId = null;
  renderHome();
  renderWatchlist();
  renderCompleted();
  if (!fromPopState && location.hash.startsWith('#anime/')) {
    history.back();
  }
}
function toggleCompleted() {
  const id = state.currentId;
  if (!id) return;
  if (state.completed.includes(id)) {
    state.completed = state.completed.filter(value => value !== id);
    showToast('Moved back to Watchlist');
  } else {
    state.completed.push(id);
    showToast('Moved to Completed');
  }
  saveCompleted();
  $('completeBtn').textContent = state.completed.includes(id) ? 'Move back to watchlist' : 'Mark completed';
  updateCounts();
}
async function copyTitle() {
  const item = byId(state.currentId);
  if (!item) return;
  try {
    await navigator.clipboard.writeText(item.title);
    showToast('Title copied');
  } catch {
    showToast(item.title);
  }
}
async function start() {
  const splashFailsafe = setTimeout(() => { $('loading').hidden = true; $('app').hidden = false; }, 2500);
  try {
    const response = await fetch('data/anime.json', {cache:'no-store'});
    if (!response.ok) throw new Error(`Anime data failed: ${response.status}`);
    state.anime = await response.json();

    clearTimeout(splashFailsafe);
    $('loading').hidden = true;
    $('app').hidden = false;

    navs().forEach(button => button.addEventListener('click', () => go(button.dataset.page)));
    document.querySelectorAll('[data-go]').forEach(button =>
      button.addEventListener('click', () => go(button.dataset.go))
    );

    $('topSearch').addEventListener('click', () => go('searchPage'));
    $('searchInput').addEventListener('input', renderSearch);
    $('detailBack').addEventListener('click', () => closeDetail());
    $('completeBtn').addEventListener('click', toggleCompleted);
    $('copyBtn').addEventListener('click', copyTitle);

    window.addEventListener('popstate', () => {
      if ($('detailView').classList.contains('open')) closeDetail({fromPopState:true});
    });

    renderHome();
    renderSearch();
    renderWatchlist();
    renderCompleted();

    const hashMatch = location.hash.match(/^#anime\/(.+)$/);
    if (hashMatch && byId(hashMatch[1])) openDetail(hashMatch[1]);

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('service-worker.js').catch(console.warn);
    }
  } catch (error) {
    clearTimeout(splashFailsafe);
    console.error(error);
    $('loading').innerHTML = `<div class="empty"><b>AniScope could not start.</b><br><br>
      It must be opened from a hosted web server—not directly inside a static file preview.</div>`;
  }
}
document.addEventListener('DOMContentLoaded', start);

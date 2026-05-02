const categoryOrder = ['Core & Official','Workspaces & GUIs','Skills & Skill Registries','Memory & Context','Plugins & Extensions','Multi-Agent & Orchestration','Deployment & Infra','Integrations & Bridges','Developer Tools','Domain Applications','Guides & Docs','Forks & Derivatives'];
const state = { repos: [], query: '', category: 'all', sort: 'stars', selected: null };
const $ = (sel) => document.querySelector(sel);
const fmt = (n) => n >= 1000 ? (n/1000).toFixed(n >= 10000 ? 1 : 1) + 'K' : String(n);

async function init(){
  state.repos = await fetch('./data/repos.ko.json', { cache: 'no-store' }).then(r => r.json());
  state.selected = state.repos[0];
  setupTheme();
  renderStats();
  renderFilters();
  bindControls();
  render();
}

function setupTheme(){
  const saved = localStorage.getItem('atlas-kr-theme');
  if(saved) document.documentElement.dataset.theme = saved;
  $('#themeButton').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? '' : 'dark';
    if(next) document.documentElement.dataset.theme = next; else delete document.documentElement.dataset.theme;
    localStorage.setItem('atlas-kr-theme', next);
    $('#themeButton').textContent = next === 'dark' ? '라이트 모드' : '다크 모드';
  });
  $('#themeButton').textContent = document.documentElement.dataset.theme === 'dark' ? '라이트 모드' : '다크 모드';
}

function renderStats(){
  $('#totalRepos').textContent = state.repos.length;
  $('#totalStars').textContent = fmt(state.repos.reduce((sum,r)=>sum+(r.stars||0),0));
}

function renderFilters(){
  const cats = [...new Set(state.repos.map(r => r.category))].sort((a,b)=>categoryOrder.indexOf(a)-categoryOrder.indexOf(b));
  const select = $('#categorySelect');
  for(const cat of cats){
    const opt = document.createElement('option'); opt.value = cat; opt.textContent = state.repos.find(r=>r.category===cat)?.categoryKo || cat; select.appendChild(opt);
  }
  const strip = $('#categories');
  const all = chip('전체', 'all'); strip.appendChild(all);
  for(const cat of cats) strip.appendChild(chip(state.repos.find(r=>r.category===cat)?.categoryKo || cat, cat));
}
function chip(label, value){
  const b=document.createElement('button'); b.type='button'; b.className='chip'; b.textContent=label; b.dataset.category=value;
  b.addEventListener('click',()=>{state.category=value; $('#categorySelect').value=value; render();}); return b;
}
function bindControls(){
  $('#searchInput').addEventListener('input', e => { state.query = e.target.value.trim().toLowerCase(); render(); });
  $('#categorySelect').addEventListener('change', e => { state.category = e.target.value; render(); });
  $('#sortSelect').addEventListener('change', e => { state.sort = e.target.value; render(); });
}
function filtered(){
  let list = state.repos.filter(r => state.category === 'all' || r.category === state.category);
  if(state.query){
    const q=state.query;
    list = list.filter(r => [
      r.owner,
      r.repo,
      r.name,
      r.description,
      r.descriptionKo,
      r.oneLineKo,
      r.summaryKo,
      r.categoryKo,
      ...(r.keywordsKo || []),
      ...(r.useCasesKo || []),
      ...(r.audienceKo || [])
    ].join(' ').toLowerCase().includes(q));
  }
  list.sort((a,b)=>{
    if(state.sort==='stars') return (b.stars||0)-(a.stars||0);
    if(state.sort==='name') return `${a.owner}/${a.repo}`.localeCompare(`${b.owner}/${b.repo}`);
    return (a.categoryKo||a.category).localeCompare(b.categoryKo||b.category) || (b.stars||0)-(a.stars||0);
  });
  return list;
}
function render(){
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.category === state.category));
  const list = filtered();
  if (list.length && (!state.selected || !list.some(r => r.owner === state.selected.owner && r.repo === state.selected.repo))) {
    state.selected = list[0];
  }
  if (!list.length) state.selected = null;
  $('#resultCount').textContent = `${list.length}개 표시`;
  const grid = $('#projectGrid'); grid.innerHTML='';
  for(const repo of list){
    const btn=document.createElement('button'); btn.type='button'; btn.className='card';
    btn.classList.toggle('active', state.selected && repo.owner===state.selected.owner && repo.repo===state.selected.repo);
    const cardSummary = repo.oneLineKo || repo.summaryKo || repo.descriptionKo || repo.description || '';
    btn.innerHTML = `<div class="cardTop"><div class="repoName">${escapeHtml(repo.owner)} / ${escapeHtml(repo.repo)}${repo.official?'<span class="official">공식</span>':''}</div><div class="stars">★ ${fmt(repo.stars||0)}</div></div><span class="cat">${escapeHtml(repo.categoryKo||repo.category)}</span><p class="desc">${escapeHtml(cardSummary)}</p>`;
    btn.addEventListener('click',()=>{state.selected=repo; renderDetail(); document.querySelectorAll('.card').forEach(c=>c.classList.remove('active')); btn.classList.add('active');});
    grid.appendChild(btn);
  }
  renderDetail();
}
function renderDetail(){
  const r=state.selected; const el=$('#detailPanel');
  if(!r){ el.innerHTML='<p class="empty">표시할 프로젝트가 없습니다.</p>'; return; }
  const summary = r.summaryKo || r.oneLineKo || r.descriptionKo || r.description || '';
  const useCases = Array.isArray(r.useCasesKo) && r.useCasesKo.length
    ? `<div class="detailBlock"><h4>어디에 쓰나</h4><ul>${r.useCasesKo.slice(0, 4).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
    : '';
  const audience = Array.isArray(r.audienceKo) && r.audienceKo.length
    ? `<div class="detailBlock"><h4>맞는 사람</h4><p>${escapeHtml(r.audienceKo.join(' · '))}</p></div>`
    : '';
  const keywords = Array.isArray(r.keywordsKo) && r.keywordsKo.length
    ? `<div class="keywordRow">${r.keywordsKo.slice(0, 6).map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>`
    : '';
  el.innerHTML = `<h3>${escapeHtml(r.owner)} / ${escapeHtml(r.repo)}</h3><p>${escapeHtml(summary)}</p><div class="detailMeta"><span class="pill">${escapeHtml(r.categoryKo || r.category)}</span><span class="pill">★ ${fmt(r.stars||0)}</span>${r.official?'<span class="pill">공식</span>':''}</div>${keywords}${useCases}${audience}<p class="source">원문 설명: ${escapeHtml(r.description || '')}</p><a class="visit" href="${escapeAttr(r.url)}" target="_blank" rel="noreferrer">GitHub에서 보기</a>`;
}
function escapeHtml(s=''){ return String(s).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function escapeAttr(s=''){ return escapeHtml(s); }
init().catch(err => { console.error(err); $('#projectGrid').innerHTML='<p class="empty">데이터를 불러오지 못했습니다.</p>'; });

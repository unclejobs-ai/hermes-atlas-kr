import { retrieve, answerFromContext } from '../lib/retrieval.js?v=2';

const categoryOrder = ['Core & Official','Workspaces & GUIs','Skills & Skill Registries','Memory & Context','Plugins & Extensions','Multi-Agent & Orchestration','Deployment & Infra','Integrations & Bridges','Developer Tools','Domain Applications','Guides & Docs','Forks & Derivatives'];
const state = { repos: [], chunks: [], query: '', category: 'all', sort: 'stars', selected: null };
const $ = (sel) => document.querySelector(sel);
const fmt = (n) => n >= 1000 ? (n/1000).toFixed(n >= 10000 ? 1 : 1) + 'K' : String(n);

async function init(){
  state.repos = await fetch('./data/repos.ko.json', { cache: 'no-store' }).then(r => r.json());
  state.chunks = await fetch('./data/chunks.ko.json', { cache: 'no-store' }).then(r => r.json()).then(data => data.chunks || []).catch(() => []);
  state.selected = state.repos[0];
  setupTheme();
  renderStats();
  renderFilters();
  bindControls();
  bindAsk();
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
  const reviewedRepos = state.repos.filter(r => r.localizationStatus === 'human_reviewed').length;
  $('#reviewedRepos').textContent = `${reviewedRepos}/${state.repos.length}`;
  const summaryCoverage = $('#summaryCoverage');
  if (summaryCoverage) {
    const covered = state.repos.filter(r => (r.summaryKo || '').length >= 45).length;
    summaryCoverage.textContent = `${covered}/${state.repos.length}`;
  }
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
  b.addEventListener('click',()=>{state.category=value; state.selected=null; $('#categorySelect').value=value; render();}); return b;
}
function bindControls(){
  $('#searchInput').addEventListener('input', e => { state.query = e.target.value.trim().toLowerCase(); state.selected=null; render(); });
  $('#categorySelect').addEventListener('change', e => { state.category = e.target.value; state.selected=null; render(); });
  $('#sortSelect').addEventListener('change', e => { state.sort = e.target.value; render(); });
}
function bindAsk(){
  const form = $('#askForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('#askInput');
    const question = input.value.trim();
    if (!question) return;
    const answer = $('#askAnswer');
    answer.textContent = 'Atlas가 한국어 인덱스에서 찾는 중입니다…';
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      if (response.ok) {
        const data = await response.json();
        answer.innerHTML = renderAnswer(data.answer, data.citations || []);
        return;
      }
    } catch (_) {
      // Local static server has no /api route. Fall back to in-browser retrieval.
    }
    const contexts = retrieve(question, state.chunks, { limit: 5 });
    answer.innerHTML = renderAnswer(answerFromContext(question, contexts), contexts);
  });
}
function renderAnswer(answer, citations = []){
  const safe = escapeHtml(answer || '답변을 만들지 못했습니다.').replace(/\n/g, '<br>');
  const links = citations.slice(0, 5).map(c => {
    const url = c.sourceUrl || '';
    const label = c.repoId || c.title || url;
    return url ? `<a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>` : '';
  }).filter(Boolean).join('');
  return `${safe}${links ? `<div class="askCitations">${links}</div>` : ''}`;
}
function searchFields(r){
  return {
    primary: [r.owner, r.repo, r.name, r.categoryKo, ...(r.keywordsKo || []), ...(r.tagsKo || []), ...(r.useCasesKo || [])].join(' ').toLowerCase(),
    secondary: [r.description, r.descriptionKo, r.oneLineKo, r.summaryKo, ...(r.audienceKo || [])].join(' ').toLowerCase(),
  };
}
function searchRelevance(r, query){
  if(!query) return 0;
  const repoId = `${r.owner}/${r.repo}`.toLowerCase();
  const { primary, secondary } = searchFields(r);
  const count = (text) => text.split(query).length - 1;
  let score = 0;
  if(repoId.includes(query)) score += 80;
  score += count(primary) * 12;
  score += count(secondary) * 3;
  if((r.tagsKo || []).some(tag => String(tag).toLowerCase().includes(query))) score += 24;
  if((r.useCasesKo || []).some(use => String(use).toLowerCase().includes(query))) score += 18;
  return score;
}
function filtered(){
  let list = state.repos.filter(r => state.category === 'all' || r.category === state.category);
  if(state.query){
    const q=state.query;
    list = list.filter(r => {
      const fields = searchFields(r);
      return `${fields.primary} ${fields.secondary}`.includes(q);
    });
  }
  list.sort((a,b)=>{
    if(state.query){
      const relevance = searchRelevance(b,state.query)-searchRelevance(a,state.query);
      if(relevance) return relevance;
    }
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
function projectPath(repo){ return `/projects/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`; }
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
  const keywordsSource = Array.isArray(r.keywordsKo) && r.keywordsKo.length ? r.keywordsKo : (r.tagsKo || []);
  const keywords = keywordsSource.length
    ? `<div class="keywordRow">${keywordsSource.slice(0, 6).map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>`
    : '';
  el.innerHTML = `<h3>${escapeHtml(r.owner)} / ${escapeHtml(r.repo)}</h3><p>${escapeHtml(summary)}</p><div class="detailMeta"><span class="pill">${escapeHtml(r.categoryKo || r.category)}</span><span class="pill">★ ${fmt(r.stars||0)}</span>${r.official?'<span class="pill">공식</span>':''}</div>${keywords}${useCases}${audience}<p class="source">원문 설명과 구현 세부사항은 원문 저장소에서 확인할 수 있습니다.</p><div class="detailActions"><a class="visit" href="${escapeAttr(projectPath(r))}">상세 페이지</a><a class="visit secondaryVisit" href="${escapeAttr(r.url)}" target="_blank" rel="noreferrer">원문 저장소 보기</a></div>`;
}
function escapeHtml(s=''){ return String(s).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function escapeAttr(s=''){ return escapeHtml(s); }
init().catch(err => { console.error(err); $('#projectGrid').innerHTML='<p class="empty">데이터를 불러오지 못했습니다.</p>'; });

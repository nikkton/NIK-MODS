const CONFIG={OWNER:"nikkton",REPO:"NIK-MODS",MAX_RELEASES:50,CACHE_SECONDS:30};
const $=s=>document.querySelector(s),grid=$("#grid"),status=$("#status"),count=$("#count"),hero=$("#heroSearch"),top=$("#topSearch");let assets=[],filter="all";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const size=b=>{if(!b)return"—";let u=["B","KB","MB","GB"],i=0,n=b;while(n>=1024&&i<3){n/=1024;i++}return `${n.toFixed(i?1:0)} ${u[i]}`};
const date=d=>{try{return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"}).format(new Date(d))}catch{return""}};
const cat=n=>/game|pubg|bgmi|minecraft|roblox|gta|freefire|brawl/i.test(n)?"games":/tool|manager|zarchiver|termux|vpn|root|utility/i.test(n)?"tools":"apps";
const clean=n=>n.replace(/\.(apk|xapk|apks|zip|rar|7z)$/i,"").replace(/[_-]+/g," ").replace(/\b(v?\d[\w.-]*)\b/ig,"").trim();
function render(){
 let q=(hero.value||top.value).trim().toLowerCase();
 let v=assets.filter(a=>(filter==="all"||a.category===filter)&&(!q||`${a.name} ${a.release} ${a.category}`.toLowerCase().includes(q)));
 count.textContent=`${v.length} item${v.length===1?"":"s"}`;
 status.style.display="none";
 grid.innerHTML=v.length?v.map(a=>`<article class="card"><div class="card-bg"><img src="assets/nik-logo.svg" loading="lazy" alt=""></div><div class="card-content"><div class="app-top"><img class="icon" src="assets/nik-logo.svg" alt=""><div><div class="app-name">${esc(clean(a.name)||a.name)}</div><div class="meta">${esc(a.tag||"Latest")} • ${size(a.size)}</div></div><button class="more" aria-label="More">⋮</button></div><div class="description">${esc(a.release||a.category)}</div><a class="download" href="${a.url}" target="_blank" rel="noopener">↓ &nbsp;Download</a><div class="bottom-meta"><span>◷ ${date(a.published)}</span><span>GitHub Release</span></div></div></article>`).join(""):'<div class="empty">No matching files yet.</div>';
}
async function load(){
 try{
  const key=`nik:${CONFIG.OWNER}/${CONFIG.REPO}`;let cached=null;
  try{cached=JSON.parse(sessionStorage.getItem(key)||"null")}catch{}
  let r=cached&&Date.now()-cached.time<CONFIG.CACHE_SECONDS*1000?cached.data:null;
  if(!r){const res=await fetch(`https://api.github.com/repos/${encodeURIComponent(CONFIG.OWNER)}/${encodeURIComponent(CONFIG.REPO)}/releases?per_page=${CONFIG.MAX_RELEASES}`,{headers:{Accept:"application/vnd.github+json"}});if(!res.ok)throw Error("GitHub API "+res.status);r=await res.json();try{sessionStorage.setItem(key,JSON.stringify({time:Date.now(),data:r}))}catch{}}
  assets=[];
  r.filter(x=>!x.draft&&x.assets).forEach(x=>x.assets.filter(a=>!/\.(sha256|sha512|md5|sig|asc)$/i.test(a.name)).forEach(a=>assets.push({name:a.name,size:a.size,url:a.browser_download_url,tag:x.tag_name,release:x.name||x.tag_name,published:x.published_at||x.created_at,category:cat(a.name+" "+(x.name||""))})));
  if(!assets.length){status.innerHTML='<span>No releases yet — upload your first file from <b>GitHub → Releases → New release</b>.</span>';count.textContent="0 items";return}
  render();
 }catch(e){console.error(e);status.innerHTML='<span>Could not load releases. <a href="https://github.com/nikkton/NIK-MODS/releases/new" target="_blank" rel="noopener">Upload a release →</a></span>';count.textContent="Offline"}}
function sync(a,b){a.addEventListener("input",()=>{b.value=a.value;render()})}
sync(hero,top);sync(top,hero);
$("#filters").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;render()});
$("#year").textContent=new Date().getFullYear();load();

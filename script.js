const CONFIG={CSV_URL:"",DEFAULT_ICON:"assets/nik-logo.svg"};
const $=s=>document.querySelector(s),grid=$("#grid"),count=$("#count"),hero=$("#heroSearch"),top=$("#topSearch");
let items=[],filter="all";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const clean=s=>String(s||"").trim();
const norm=s=>clean(s).toLowerCase();
const size=s=>clean(s)||"—";
const date=s=>{if(!s)return"—";try{return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"}).format(new Date(s))}catch{return s}};
const category=s=>{let n=norm(s);return /game|pubg|bgmi|minecraft|roblox|gta|freefire|brawl|gameplay/.test(n)?"games":/tool|manager|zarchiver|termux|vpn|root|utility|editor/.test(n)?"tools":"apps"};
const fallback=[
{name:"Spotify",category:"apps",version:"Latest",size:"—",description:"Music and audio release",icon:"assets/nik-logo.svg",link:"#"},
{name:"Minecraft",category:"games",version:"Latest",size:"—",description:"Game release",icon:"assets/nik-logo.svg",link:"#"},
{name:"ZArchiver",category:"tools",version:"Latest",size:"—",description:"File management tool",icon:"assets/nik-logo.svg",link:"#"}
];
function parseCSV(text){
 const rows=[];let row=[],cell="",quote=false;
 for(let i=0;i<text.length;i++){let c=text[i],n=text[i+1];if(c==='"'&&quote&&n==='"'){cell+='"';i++;continue}if(c==='"'){quote=!quote;continue}if(c===','&&!quote){row.push(cell);cell="";continue}if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell="";continue}cell+=c}row.push(cell);if(row.some(Boolean))rows.push(row);
 const h=(rows.shift()||[]).map(x=>norm(x).replace(/\s+/g,"_"));
 return rows.map(r=>Object.fromEntries(h.map((k,i)=>[k,clean(r[i])]))).filter(x=>x.name);
}
function normalize(r){
 const c=norm(r.category||r.type)||category(r.name);
 return {name:r.name,category:c==="game"?"games":c==="tool"?"tools":c==="app"?"apps":c,version:r.version||"Latest",size:r.size||"—",description:r.description||"Ready to download",icon:r.icon||CONFIG.DEFAULT_ICON,link:r.link||r.url||"#",date:r.date||r.updated||""};
}
function render(){
 const q=norm(hero.value||top.value);
 const visible=items.filter(x=>(filter==="all"||x.category===filter)&&(!q||norm(x.name+" "+x.description+" "+x.category).includes(q)));
 count.textContent=visible.length+" "+(visible.length===1?"item":"items");
 grid.innerHTML=visible.length?visible.map((a,i)=>`<article class="card" style="--delay:${i*45}ms">
  <div class="card-bg"><img src="${esc(a.icon)}" alt="" loading="lazy"></div>
  <div class="card-content">
   <div class="app-top"><img class="icon" src="${esc(a.icon)}" alt="" loading="lazy"><div class="app-info"><div class="app-name">${esc(a.name)}</div><div class="meta">${esc(a.version)} <i>•</i> ${esc(size(a.size))}</div></div><span class="category-tag">${esc(a.category)}</span></div>
   <div class="description">${esc(a.description)}</div>
   <a class="download ${a.link==="#"?"disabled":""}" href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">${a.link==="#"?"Coming soon":"↓  Get download"}</a>
   <div class="bottom-meta"><span>${a.date?"◷ "+esc(date(a.date)):"NIK MODS"}</span><span>● READY</span></div>
  </div>
 </article>`).join(""):'<div class="empty"><strong>Nothing here yet.</strong><br>Try another search or category.</div>';
}
async function load(){
 if(!CONFIG.CSV_URL){items=fallback.map(normalize);document.querySelector("#sourceNote").textContent="Demo catalog • Connect Google Sheets to manage drops";render();return}
 try{const res=await fetch(CONFIG.CSV_URL,{cache:"no-store"});if(!res.ok)throw Error("Sheet unavailable");items=parseCSV(await res.text()).map(normalize);document.querySelector("#sourceNote").textContent="Live catalog • Updated from Google Sheets";render()}
 catch(e){items=[];count.textContent="—";grid.innerHTML='<div class="empty"><strong>Catalog unavailable.</strong><br>Check the Google Sheets connection.</div>'}
}
function sync(a,b){a.addEventListener("input",()=>{b.value=a.value;render()})}
sync(hero,top);sync(top,hero);
$("#filters").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;render()});
$("#year").textContent=new Date().getFullYear();load();
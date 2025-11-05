'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Seven Knights Rebirth — GvG 3v3 Tracker (Search by Defender)
 * v4 — Skill Combo on BOTH sides:
 * - Each hero has S1/S2
 * - Attacker can pick exactly 3 of 6 (A1,A2,B1,B2,C1,C2)
 * - Defender can pick exactly 3 of 6 (D1,D2, ... for its 3 heroes)
 * Stored:
 *  - attackerPicks: ["Vanessa:S1","Eileene:S2","Rudy:S2"]
 *  - defenderPicks: ["Orkah:S2","Jave:S1","Karin:S1"]
 * Aggregation:
 *  - For a given defender team search → show attacker teams with:
 *    - Win rate, Matches
 *    - Most common ATTACKER 3-pick combo vs this defense
 *    - Most common DEFENDER 3-pick combo used vs this attacker
 */

const LS_KEY = 'skrb_gvg_3v3_v4_combo_both';

const HEROES = [
  'Ace','Alice','Aragon','Ariel','Aris','Asura','Ballista','Bane','Bi Dam','Biscuit','Black Rose','Catty','Chancellor','Chloe','Cleo','Colt','Daisy','Dellons','Eileene','Espada','Evan','Fai','Feng Yan','Heavenia','Hellenia','Hokin','Jane','Jave','Jin','Joker','Jupy','Juri','Karin','Karma','Karon','Knox','Kris','Kyle','Kyrielle','Lania','Leo','Li','Lina','Lucy','May','Mercure','Nia','Noho','Orkah','Orly','Pascal','Platin','Rachel','Rahkun','Rei','Rin','Rook','Rosie','Rudy','Ruri','Sarah','Sera','Shane','Sieg','Silvesta','Snipper','Soi','Spike','Sylvia','Taka','Teo','Vanessa','Velika','Victoria','Yeonhee','Yu Shin','Yui','Yuri','Irene','Kagura','Amelia'
].sort();

// ---------- utils ----------
const cleanWhitespace = (s)=> (s||'').replace(/\s+/g,' ').trim();
const uniq = (arr)=> Array.from(new Set(arr));
const parseTags = (raw)=> (raw||'').split(',').map(t=>cleanWhitespace(t)).filter(Boolean);
const formatPercent = (n,d=1)=> !isFinite(n) ? '0%' : `${(n*100).toFixed(d)}%`;
const newId = ()=> (typeof crypto!=='undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Math.random().toString(36).slice(2)+Date.now().toString(36));

function titleCaseName(s){
  const x = cleanWhitespace(s).toLowerCase();
  if(!x) return '';
  return x.split(' ').filter(Boolean).map(w=> w[0].toUpperCase()+w.slice(1)).join(' ');
}
function normalizeName(s){
  const aliases = {'vane':'Vanessa','van':'Vanessa','blk rose':'Black Rose','bk rose':'Black Rose','blackrose':'Black Rose','yeonhee':'Yeonhee','yoonhee':'Yeonhee','yu-shin':'Yu Shin','yushin':'Yu Shin','bi-dam':'Bi Dam','bidam':'Bi Dam','fengyan':'Feng Yan','silvesta':'Silvesta','ork':'Orkah'};
  const t = titleCaseName(s); if(!t) return ''; const k = t.toLowerCase(); return aliases[k] || t;
}
function normalizeTeam(arr){ return (arr||[]).map(normalizeName).filter(Boolean).sort(); }
const teamKey = (arr)=> normalizeTeam(arr).join('|');

function picksKey(picks){ return (picks||[]).slice().sort().join(' + '); }
function humanizePick(p){ const [n,s]=p.split(':'); return `${n} ${s}`; }

// ---------- storage ----------
function useLocalData(){
  const [data,setData] = useState([]);
  useEffect(()=>{
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(raw){ const parsed = JSON.parse(raw); if(Array.isArray(parsed)) return setData(parsed); }
      // migrate older versions (no both-sides picks) -> v4 (empty picks)
      const older = localStorage.getItem('skrb_gvg_3v3_v3_combo') || localStorage.getItem('skrb_gvg_3v3_v2_skills') || localStorage.getItem('skrb_gvg_3v3_v1');
      if(older){
        const arr = JSON.parse(older);
        if(Array.isArray(arr)){
          setData(arr.map(m=>({
            id:m.id||newId(),
            attackers: normalizeTeam(m.attackers||[]),
            defenders: normalizeTeam(m.defenders||[]),
            attackerPicks: Array.isArray(m.attackerPicks)? m.attackerPicks.map(String).slice(0,3).sort() : [],
            defenderPicks: Array.isArray(m.defenderPicks)? m.defenderPicks.map(String).slice(0,3).sort() : [],
            result: m.result==='LOSS'?'LOSS':'WIN',
            notes: cleanWhitespace(m.notes||''),
            tags: uniq((m.tags||[]).map(cleanWhitespace).filter(Boolean)),
            createdAt: Number(m.createdAt)||Date.now(),
          })));
        }
      }
    }catch(e){ console.error(e); }
  },[]);
  useEffect(()=>{ try{ localStorage.setItem(LS_KEY, JSON.stringify(data)); }catch(e){ console.error(e);} },[data]);
  return [data,setData];
}

// ---------- UI primitives ----------
function Badge({ children }) {
  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">{children}</span>;
}
function Card({ title, actions, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <div className="flex gap-2">{actions}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
function Button({ children, onClick, variant='default', type='button', title }) {
  const base='inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium border shadow-sm active:scale-[.98]';
  const variants={ default:'bg-slate-900 text-white border-slate-900 hover:opacity-90', outline:'bg-white text-slate-700 border-slate-300 hover:bg-slate-50', subtle:'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200', danger:'bg-rose-600 text-white border-rose-600 hover:opacity-90' };
  return <button type={type} title={title} onClick={onClick} className={`${base} ${variants[variant]}`}>{children}</button>;
}
function Textarea({ label, value, onChange, placeholder }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-500">{label}</span>
      <textarea className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300" value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} rows={3}/>
    </label>
  );
}

// ---------- Hero Autocomplete ----------
function HeroInput({ label, value, onChange, placeholder }) {
  const [open,setOpen] = useState(false);
  const [q,setQ] = useState(value||'');
  const boxRef = useRef(null);

  useEffect(()=> setQ(value||''),[value]);
  useEffect(()=>{
    const onClick = (e)=>{ if(!boxRef.current) return; if(!boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', onClick); return ()=> document.removeEventListener('click', onClick);
  },[]);

  const suggestions = useMemo(()=>{
    const needle = cleanWhitespace(q).toLowerCase();
    if(!needle) return HEROES.slice(0,30);
    const starts = HEROES.filter(h=> h.toLowerCase().startsWith(needle));
    const contains = HEROES.filter(h=> !h.toLowerCase().startsWith(needle) && h.toLowerCase().includes(needle));
    return [...starts, ...contains].slice(0,30);
  },[q]);

  return (
    <div className="flex flex-col gap-1" ref={boxRef}>
      <span className="text-xs text-slate-500">{label}</span>
      <input
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        value={q}
        onChange={(e)=>{ const v=e.target.value; setQ(v); onChange(v); setOpen(true); }}
        onFocus={()=> setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && suggestions.length>0 && (
        <div className="mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {suggestions.map(h=>(
            <button key={h} type="button" className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50" onClick={()=>{ onChange(h); setQ(h); setOpen(false); }}>
              {h}
            </button>
          ))}
        </div>
      )}
      <div className="text-[10px] text-slate-400">พิมพ์เพื่อค้นหา หรือเลือกจากรายการ</div>
    </div>
  );
}

// ---------- Skill Combo Picker (max 3 of 6) ----------
function SkillCombo({ title, heroes, picks, onChange }) {
  const names = normalizeTeam(heroes);
  const allSlots = names.flatMap(n=> ([`${n}:S1`, `${n}:S2`]));
  const set = new Set(picks||[]);

  function toggle(key){
    const next = new Set(set);
    if(next.has(key)) next.delete(key);
    else {
      if(next.size>=3) return; // limit to 3
      next.add(key);
    }
    onChange(Array.from(next));
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="text-xs text-slate-600 mb-2">
        {title}: เลือกสกิลได้รวมกัน <b>3</b> จาก 6 ปุ่ม
      </div>
      {names.length===0 ? (
        <div className="text-xs text-slate-400">กรอกชื่อตัวละครให้ครบก่อน</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {names.map((n)=>(
            <div key={n} className="flex flex-col gap-2">
              <div className="text-xs font-medium text-slate-700">{n}</div>
              <div className="flex gap-2">
                {['S1','S2'].map(s=>{
                  const key = `${n}:${s}`;
                  const active = set.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={()=> toggle(key)}
                      className={`px-3 py-1.5 rounded-lg border text-sm ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                    >
                      {s}{active ? ' ✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 text-[11px] text-slate-500">เลือกแล้ว: {Array.from(set).map(humanizePick).join(' • ') || '—'}</div>
      {allSlots.length>0 && set.size>3 && <div className="text-xs text-rose-600 mt-1">เลือกเกิน 3 ปุ่ม</div>}
    </div>
  );
}

// ---------- Render helpers ----------
function TeamPill({ names }) {
  const list = normalizeTeam(names);
  return <div className="flex flex-wrap gap-1">{list.map(n=> <Badge key={n}>{n}</Badge>)}</div>;
}

function StatRow({ row }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start rounded-xl border border-slate-200 p-3 bg-white">
      <div className="md:col-span-4">
        <div className="text-[11px] text-slate-500 mb-1">Attacker</div>
        <TeamPill names={row.sideTeam} />
        {row.topComboAtk && (
          <div className="mt-1 text-[11px] text-slate-600">
            คอมโบสกิลบุกบ่อยสุด: {row.topComboAtk.human} <span className="text-slate-400">({row.topComboAtk.count} ครั้ง)</span>
          </div>
        )}
        {row.topComboDef && (
          <div className="mt-1 text-[11px] text-slate-600">
            คอมโบสกิลรับบ่อยสุด: {row.topComboDef.human} <span className="text-slate-400">({row.topComboDef.count} ครั้ง)</span>
          </div>
        )}
      </div>
      <div className="md:col-span-2">
        <div className="text-[11px] text-slate-500 mb-1">Win rate</div>
        <div className="text-base font-semibold">{formatPercent(row.winRate)}</div>
      </div>
      <div className="md:col-span-2">
        <div className="text-[11px] text-slate-500 mb-1">Matches</div>
        <div className="text-base font-semibold">{row.total}</div>
      </div>
      <div className="md:col-span-4">
        <div className="flex flex-wrap gap-1 mb-1">{row.tags.map(t=> <Badge key={t}>{t}</Badge>)}</div>
        {row.notes.length>0 && (<div className="text-[12px] text-slate-600">{row.notes.join(' • ')}</div>)}
      </div>
    </div>
  );
}

// ---------- Page ----------
export default function Page(){
  const [data,setData] = useLocalData();

  // inputs
  const [atk,setAtk] = useState(['','','']);
  const [def,setDef] = useState(['','','']);
  const [attackerPicks,setAttackerPicks] = useState([]); // ["Name:S1|S2"] (max 3)
  const [defenderPicks,setDefenderPicks] = useState([]); // ["Name:S1|S2"] (max 3)
  const [result,setResult] = useState('WIN');
  const [notes,setNotes] = useState('');
  const [tagsInput,setTagsInput] = useState('');

  // search (by defender)
  const [qDef,setQDef] = useState(['','','']);

  function addMatch(){
    const attackers = normalizeTeam(atk);
    const defenders = normalizeTeam(def);
    if(attackers.length!==3 || defenders.length!==3){ alert('กรุณากรอกชื่อให้ครบ 3 ตัว ทั้งฝั่งบุกและฝั่งรับ'); return; }
    if(attackerPicks.length!==3){ alert('กรุณาเลือกสกิลฝั่งบุกให้ครบ 3 ปุ่ม'); return; }
    if(defenderPicks.length!==3){ alert('กรุณาเลือกสกิลฝั่งรับให้ครบ 3 ปุ่ม'); return; }

    // validate picks belong to their teams
    const atkNames = new Set(attackers);
    const defNames = new Set(defenders);
    const atkOk = attackerPicks.every(p=> atkNames.has((p||'').split(':')[0]));
    const defOk = defenderPicks.every(p=> defNames.has((p||'').split(':')[0]));
    if(!atkOk || !defOk){ alert('สกิลที่เลือกไม่ตรงกับทีม'); return; }

    const rec = {
      id:newId(),
      attackers, defenders,
      attackerPicks: attackerPicks.slice().sort(),
      defenderPicks: defenderPicks.slice().sort(),
      result,
      notes: cleanWhitespace(notes),
      tags: uniq(parseTags(tagsInput)),
      createdAt: Date.now(),
    };
    setData(prev=> [rec, ...prev]);

    // reset
    setAtk(['','','']); setDef(['','','']);
    setAttackerPicks([]); setDefenderPicks([]);
    setResult('WIN'); setNotes(''); setTagsInput('');
  }

  // search stats (DEF -> ATTACKERS + top combos for both sides)
  const searchStats = useMemo(()=>{
    const qKey = teamKey(qDef);
    const qNames = normalizeTeam(qDef);
    if(qNames.length<3) return null;

    const matches = data.filter(m=> teamKey(m.defenders)===qKey);

    const map = new Map();
    for(const m of matches){
      const aKey = teamKey(m.attackers);
      const bucket = map.get(aKey) || {
        sideTeam:m.attackers,
        total:0, wins:0, notes:[], tags:[], lastAt:0,
        combosAtk:new Map(), combosDef:new Map(),
      };
      bucket.total += 1;
      if(m.result==='WIN') bucket.wins += 1;
      if(m.notes) bucket.notes.push(m.notes);
      if(m.tags?.length) bucket.tags.push(...m.tags);

      const cAtk = picksKey(m.attackerPicks||[]);
      const cDef = picksKey(m.defenderPicks||[]);
      if(cAtk) bucket.combosAtk.set(cAtk, (bucket.combosAtk.get(cAtk)||0)+1);
      if(cDef) bucket.combosDef.set(cDef, (bucket.combosDef.get(cDef)||0)+1);

      bucket.lastAt = Math.max(bucket.lastAt, m.createdAt||0);
      map.set(aKey, bucket);
    }

    const rows = Array.from(map.values()).map(b=>{
      let topA=null, topD=null;
      for(const [k,c] of b.combosAtk.entries()){ if(!topA || c>topA.count) topA={key:k,count:c}; }
      for(const [k,c] of b.combosDef.entries()){ if(!topD || c>topD.count) topD={key:k,count:c}; }
      const humanA = topA ? topA.key.split(' + ').map(humanizePick).join(' • ') : '';
      const humanD = topD ? topD.key.split(' + ').map(humanizePick).join(' • ') : '';
      return {
        sideTeam: b.sideTeam,
        total: b.total,
        wins: b.wins,
        winRate: b.total ? b.wins/b.total : 0,
        notes: uniq(b.notes),
        tags: uniq(b.tags),
        lastAt: b.lastAt,
        topComboAtk: topA ? { human: humanA, count: topA.count } : null,
        topComboDef: topD ? { human: humanD, count: topD.count } : null,
      };
    }).sort((a,b)=> b.total-a.total || b.winRate-a.winRate || b.lastAt-a.lastAt);

    return { qKey, rows, count: matches.length };
  },[qDef, data]);

  // export / import
  function handleExport(){
    const payload = { schema:'skrb_gvg_3v3_v4_combo_both', exportedAt:new Date().toISOString(), matches:data };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=`gvg-3v3-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
  }
  const importRef = useRef(null);
  function handleImportClick(){ importRef.current?.click(); }
  function handleImport(e){
    const file = e.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const parsed = JSON.parse(reader.result);
        const list = Array.isArray(parsed?.matches) ? parsed.matches : Array.isArray(parsed) ? parsed : [];
        if(!list.length){ alert('ไฟล์ไม่ถูกต้องหรือไม่มีข้อมูล'); e.target.value=''; return; }
        const cleaned = list.map(m=>({
          id: m.id||newId(),
          attackers: normalizeTeam(m.attackers||[]),
          defenders: normalizeTeam(m.defenders||[]),
          attackerPicks: Array.isArray(m.attackerPicks) ? m.attackerPicks.map(String).slice(0,3).sort() : [],
          defenderPicks: Array.isArray(m.defenderPicks) ? m.defenderPicks.map(String).slice(0,3).sort() : [],
          result: m.result==='LOSS' ? 'LOSS' : 'WIN',
          notes: cleanWhitespace(m.notes||''),
          tags: uniq((m.tags||[]).map(cleanWhitespace).filter(Boolean)),
          createdAt: Number(m.createdAt)||Date.now(),
        })).filter(m=> m.attackers.length===3 && m.defenders.length===3);
        if(!cleaned.length){ alert('ข้อมูลหลังทำความสะอาดว่างเปล่า'); e.target.value=''; return; }

        if(confirm('ต้องการรวมข้อมูลเข้ากับของเดิมหรือไม่? (OK = รวม / Cancel = แทนที่)')){
          const bySig = new Map();
          const add = (m)=>{
            const sig = `${teamKey(m.attackers)}=>${teamKey(m.defenders)}#A:${(m.attackerPicks||[]).join('|')}#D:${(m.defenderPicks||[]).join('|')}#${m.result}#${m.notes}`;
            const ex = bySig.get(sig);
            if(!ex || (m.createdAt||0)>(ex.createdAt||0)) bySig.set(sig,m);
          };
          data.forEach(add); cleaned.forEach(add);
          setData(Array.from(bySig.values()).sort((a,b)=> (b.createdAt||0)-(a.createdAt||0)));
        }else{
          setData(cleaned.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0)));
        }
      }catch(err){ console.error(err); alert('อ่านไฟล์ไม่สำเร็จ'); }
      finally{ e.target.value=''; }
    };
    reader.readAsText(file);
  }

  function seedDemo(){
    const demo = [
      {
        attackers:['Vanessa','Eileene','Rudy'],
        defenders:['Orkah','Jave','Karin'],
        attackerPicks:['Vanessa:S1','Eileene:S2','Rudy:S2'],
        defenderPicks:['Orkah:S2','Jave:S1','Karin:S1'],
        result:'WIN', notes:'ต้อง C6+ ใส่ต้าน 100%', tags:['Archetype:ถึก','Reflect']
      },
      {
        attackers:['Vanessa','Eileene','Rudy'],
        defenders:['Orkah','Jave','Karin'],
        attackerPicks:['Vanessa:S1','Eileene:S2','Rudy:S2'],
        defenderPicks:['Orkah:S2','Jave:S1','Karin:S1'],
        result:'LOSS', notes:'โดนสวนแรง', tags:['Reflect']
      },
      {
        attackers:['Vanessa','Eileene','Rudy'],
        defenders:['Kris','Dellons','Aris'],
        attackerPicks:['Vanessa:S2','Eileene:S1','Rudy:S2'],
        defenderPicks:['Kris:S1','Dellons:S2','Aris:S1'],
        result:'WIN', notes:'ดาเมจเร็ว', tags:['Archetype:ดาเมจเร็ว']
      },
    ].map((m,i)=>({
      id:newId(),
      attackers: normalizeTeam(m.attackers),
      defenders: normalizeTeam(m.defenders),
      attackerPicks: m.attackerPicks.slice().sort(),
      defenderPicks: m.defenderPicks.slice().sort(),
      result:m.result, notes:m.notes, tags:m.tags,
      createdAt: Date.now()-i*60000
    }));
    setData(prev=> [...demo, ...prev]);
  }
  function clearAll(){ if(confirm('ลบข้อมูลทั้งหมดหรือไม่?')) setData([]); }

  // ---------- UI ----------
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Seven Knights Rebirth — GvG 3v3 Tracker</h1>
            <p className="text-sm text-slate-600">Search by Defender • Skill Combo on BOTH sides (3 of 6)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={seedDemo} variant="subtle">Seed demo data</Button>
            <Button onClick={handleExport} variant="outline">Export JSON</Button>
            <Button onClick={handleImportClick} variant="outline">Import JSON</Button>
            <input ref={importRef} type="file" accept="application/json" onChange={handleImport} className="hidden" />
            <Button onClick={clearAll} variant="danger">Clear all</Button>
          </div>
        </header>

        {/* Search (DEF -> ATTACKERS) */}
        <Card title="ค้นหาจากทีมผู้รับ (Defender 3 ตัว)" actions={<div className="text-xs text-slate-600">คีย์ทีมแบบไม่สนลำดับ</div>}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <HeroInput label="Defender #1" value={qDef[0]} onChange={(v)=> setQDef([v,qDef[1],qDef[2]])} placeholder="เช่น Orkah" />
            <HeroInput label="Defender #2" value={qDef[1]} onChange={(v)=> setQDef([qDef[0],v,qDef[2]])} placeholder="เช่น Jave" />
            <HeroInput label="Defender #3" value={qDef[2]} onChange={(v)=> setQDef([qDef[0],qDef[1],v])} placeholder="เช่น Karin" />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={()=> setQDef([...qDef])}>ค้นหา</Button>
            {searchStats?.count ? <div className="text-sm text-slate-600">พบ {searchStats.count} แมตช์ที่บันทึกไว้</div> : <div className="text-sm text-slate-400">ใส่ชื่อให้ครบ 3 ตัวเพื่อดูสถิติ</div>}
          </div>
          {searchStats && (
            <div className="mt-6 space-y-3">
              {searchStats.rows.length>0 ? searchStats.rows.map((row,idx)=> <StatRow key={idx} row={row} />) : <div className="text-sm text-slate-500">ยังไม่มีสถิติกับทีมบุกไหนๆ สำหรับทีมรับนี้</div>}
            </div>
          )}
        </Card>

        {/* Add Match */}
        <div className="h-6" />
        <Card title="บันทึกแมตช์ใหม่">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <HeroInput label="Attacker #1" value={atk[0]} onChange={(v)=> setAtk([v,atk[1],atk[2]])} placeholder="Vanessa" />
            <HeroInput label="Attacker #2" value={atk[1]} onChange={(v)=> setAtk([atk[0],v,atk[2]])} placeholder="Eileene" />
            <HeroInput label="Attacker #3" value={atk[2]} onChange={(v)=> setAtk([atk[0],atk[1],v])} placeholder="Rudy" />
          </div>
          <div className="mt-3">
            <SkillCombo title="ฝั่งบุก (Attacker)" heroes={atk} picks={attackerPicks} onChange={setAttackerPicks} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <HeroInput label="Defender #1" value={def[0]} onChange={(v)=> setDef([v,def[1],def[2]])} placeholder="Orkah" />
            <HeroInput label="Defender #2" value={def[1]} onChange={(v)=> setDef([def[0],v,def[2]])} placeholder="Jave" />
            <HeroInput label="Defender #3" value={def[2]} onChange={(v)=> setDef([def[0],def[1],v])} placeholder="Karin" />
          </div>
          <div className="mt-3">
            <SkillCombo title="ฝั่งรับ (Defender)" heroes={def} picks={defenderPicks} onChange={setDefenderPicks} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">ผลลัพธ์</span>
              <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300" value={result} onChange={(e)=> setResult(e.target.value)}>
                <option value="WIN">WIN</option>
                <option value="LOSS">LOSS</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-xs text-slate-500">Tags (คั่นด้วย ,)</span>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300" value={tagsInput} onChange={(e)=> setTagsInput(e.target.value)} placeholder="ถึก, Archetype:ดาเมจเร็ว, Reflect" />
            </label>
          </div>

          <div className="mt-3">
            <Textarea label="หมายเหตุ" value={notes} onChange={setNotes} placeholder="เช่น ต้อง C6+ ใส่เซ็ตต้าน 100%" />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={addMatch}>บันทึกแมตช์</Button>
            <div className="text-xs text-slate-500">แต่ละฝั่งเลือกสกิลได้ 3 ปุ่มจาก 6 ปุ่ม (ต่อแมตช์)</div>
          </div>
        </Card>

        {/* Recent matches */}
        <div className="h-6" />
        <Card title="แมตช์ล่าสุด">
          {data.length===0 ? (
            <div className="text-sm text-slate-500">ยังไม่มีข้อมูล ลองเพิ่มหรือกด Seed demo data</div>
          ) : (
            <div className="space-y-2">
              {data.slice(0,30).map(m=>(
                <div key={m.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start rounded-xl border border-slate-200 p-3">
                  <div className="md:col-span-4">
                    <div className="text-[11px] text-slate-500 mb-1">Attacker</div>
                    <TeamPill names={m.attackers} />
                    <div className="mt-1 text-[11px] text-slate-600">สกิลที่ใช้ (บุก): {m.attackerPicks?.map(humanizePick).join(' • ') || '—'}</div>
                  </div>
                  <div className="md:col-span-4">
                    <div className="text-[11px] text-slate-500 mb-1">Defender</div>
                    <TeamPill names={m.defenders} />
                    <div className="mt-1 text-[11px] text-slate-600">สกิลที่ใช้ (รับ): {m.defenderPicks?.map(humanizePick).join(' • ') || '—'}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-[11px] text-slate-500 mb-1">Result</div>
                    <Badge>{m.result}</Badge>
                  </div>
                  <div className="md:col-span-2 flex flex-wrap gap-1">{m.tags?.map(t=> <Badge key={t}>{t}</Badge>)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <footer className="py-8 text-center text-xs text-slate-400">Local only • v4 (Both sides 3-of-6 Skill Combo)</footer>
      </div>
    </main>
  );
}

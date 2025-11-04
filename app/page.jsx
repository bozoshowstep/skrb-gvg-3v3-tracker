'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Next.js (App Router) — page.jsx
 * Seven Knights Rebirth — GvG 3v3 Tracker
 * -------------------------------------------------------------
 * Copy this whole file to: app/page.jsx
 * TailwindCSS required (standard Next.js Tailwind setup).
 *
 * Features:
 *  - Record matches (Attacker x3 vs Defender x3, Win/Loss, Notes, Tags)
 *  - Search by Defender team (exact trio, order-insensitive)
 *    -> Shows common Attacker teams used against that defense, Win rate, Match counts, aggregated notes & tags
 *  - Autocomplete Hero inputs (full list merged from your message)
 *  - LocalStorage persistence (no backend)
 *  - Export / Import JSON
 *  - Name normalization + order-insensitive team keys
 */

// -------------------- Config --------------------
const LS_KEY = 'skrb_gvg_3v3_v1';

// === Hero suggestions list (merged & deduped, sorted) ===
// Feel free to edit/extend.
const HEROES = [
  'Ace','Alice','Aragon','Ariel','Aris','Asura','Ballista','Bane','Bi Dam','Biscuit','Black Rose','Catty','Chancellor','Chloe','Cleo','Colt','Daisy','Dellons','Eileene','Espada','Evan','Fai','Feng Yan','Heavenia','Hellenia','Hokin','Jane','Jave','Jin','Joker','Jupy','Juri','Karin','Karma','Karon','Knox','Kris','Kyle','Kyrielle','Lania','Leo','Li','Lina','Lucy','May','Mercure','Nia','Noho','Orkah','Orly','Pascal','Platin','Rachel','Rahkun','Rei','Rin','Rook','Rosie','Rudy','Ruri','Sarah','Sera','Shane','Sieg','Silvesta','Snipper','Soi','Spike','Sylvia','Taka','Teo','Vanessa','Velika','Victoria','Yeonhee','Yu Shin','Yui','Yuri','Irene','Kagura'
].sort();

// -------------------- Utilities --------------------
function cleanWhitespace(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function titleCaseName(s) {
  const x = cleanWhitespace(s).toLowerCase();
  if (!x) return '';
  return x
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function normalizeName(s) {
  const aliases = {
    'vane': 'Vanessa',
    'van': 'Vanessa',
    'blk rose': 'Black Rose',
    'bk rose': 'Black Rose',
    'blackrose': 'Black Rose',
    'yeonhee': 'Yeonhee',
    'yoonhee': 'Yeonhee',
    'yu-shin': 'Yu Shin',
    'yushin': 'Yu Shin',
    'bi-dam': 'Bi Dam',
    'bidam': 'Bi Dam',
    'fengyan': 'Feng Yan',
    'silvesta': 'Silvesta',
    'ork': 'Orkah',
  };
  const t = titleCaseName(s);
  if (!t) return '';
  const key = t.toLowerCase();
  return aliases[key] || t;
}

function normalizeTeam(arr) {
  const names = (arr || []).map(normalizeName).filter(Boolean).sort();
  return names;
}

function teamKey(arr) {
  return normalizeTeam(arr).join('|');
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function parseTags(raw) {
  return (raw || '')
    .split(',')
    .map((t) => cleanWhitespace(t))
    .filter(Boolean);
}

function formatPercent(n, digits = 1) {
  if (!isFinite(n)) return '0%';
  return `${(n * 100).toFixed(digits)}%`;
}

function newId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : (Math.random().toString(36).slice(2) + Date.now().toString(36));
}

// -------------------- Storage hook --------------------
function useLocalData() {
  const [data, setData] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setData(parsed);
      }
    } catch (e) { console.error('Failed to load', e); }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) { console.error('Failed to save', e); }
  }, [data]);

  return [data, setData];
}

// -------------------- UI primitives --------------------
function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
      {children}
    </span>
  );
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

function Button({ children, onClick, variant = 'default', type = 'button', title }) {
  const base = 'inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium border shadow-sm active:scale-[.98]';
  const variants = {
    default: 'bg-slate-900 text-white border-slate-900 hover:opacity-90',
    outline: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50',
    subtle: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200',
    danger: 'bg-rose-600 text-white border-rose-600 hover:opacity-90',
  };
  return (
    <button type={type} title={title} onClick={onClick} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  );
}

function Textarea({ label, value, onChange, placeholder }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-500">{label}</span>
      <textarea
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
      />
    </label>
  );
}

// -------------------- Hero Autocomplete --------------------
function HeroInput({ label, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value || '');
  const boxRef = useRef(null);

  useEffect(() => setQ(value || ''), [value]);

  useEffect(() => {
    const onClick = (e) => { if (!boxRef.current) return; if (!boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const suggestions = useMemo(() => {
    const needle = cleanWhitespace(q).toLowerCase();
    if (!needle) return HEROES.slice(0, 30);
    const starts = HEROES.filter((h) => h.toLowerCase().startsWith(needle));
    const contains = HEROES.filter((h) => !h.toLowerCase().startsWith(needle) && h.toLowerCase().includes(needle));
    return [...starts, ...contains].slice(0, 30);
  }, [q]);

  return (
    <div className="flex flex-col gap-1" ref={boxRef}>
      <span className="text-xs text-slate-500">{label}</span>
      <input
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        value={q}
        onChange={(e) => { const v = e.target.value; setQ(v); onChange(v); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {suggestions.map((h) => (
            <button
              key={h}
              type="button"
              className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => { onChange(h); setQ(h); setOpen(false); }}
            >
              {h}
            </button>
          ))}
        </div>
      )}
      <div className="text-[10px] text-slate-400">พิมพ์เพื่อค้นหา หรือเลือกจากรายการ (พิมพ์ชื่อที่ไม่มีในลิสต์ได้)</div>
    </div>
  );
}

// -------------------- Render helpers --------------------
function TeamPill({ names }) {
  const list = normalizeTeam(names);
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((n) => (
        <Badge key={n}>{n}</Badge>
      ))}
    </div>
  );
}

function StatRow({ row, sideLabel }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-xl border border-slate-200 p-3 bg-white">
      <div className="md:col-span-4">
        <div className="text-[11px] text-slate-500 mb-1">{sideLabel}</div>
        <TeamPill names={row.sideTeam} />
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
        <div className="flex flex-wrap gap-1 mb-1">
          {row.tags.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
        {row.notes.length > 0 && (
          <div className="text-[12px] text-slate-600 line-clamp-2">
            {row.notes.join(' • ')}
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------- Main Page --------------------
export default function Page() {
  const [data, setData] = useLocalData();

  // Add form
  const [atk, setAtk] = useState(['', '', '']);
  const [def, setDef] = useState(['', '', '']);
  const [result, setResult] = useState('WIN');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Search (by DEF)
  const [qDef, setQDef] = useState(['', '', '']);

  // Add match
  function addMatch() {
    const attackers = normalizeTeam(atk);
    const defenders = normalizeTeam(def);

    if (attackers.length !== 3 || defenders.length !== 3) {
      alert('กรุณากรอกชื่อตัวละครให้ครบ 3 ตัว ทั้งฝั่งบุกและฝั่งรับ');
      return;
    }

    const rec = {
      id: newId(),
      attackers,
      defenders,
      result,
      notes: cleanWhitespace(notes),
      tags: uniq(parseTags(tagsInput)),
      createdAt: Date.now(),
    };

    setData((prev) => [rec, ...prev]);
    setAtk(['', '', '']);
    setDef(['', '', '']);
    setResult('WIN');
    setNotes('');
    setTagsInput('');
  }

  // Search stats (by DEFENDER -> aggregate ATTACKERS)
  const searchStats = useMemo(() => {
    const qKey = teamKey(qDef);
    const qNames = normalizeTeam(qDef);
    if (qNames.length < 3) return null;

    const matches = data.filter((m) => teamKey(m.defenders) === qKey);

    const map = new Map();
    for (const m of matches) {
      const aKey = teamKey(m.attackers);
      const bucket = map.get(aKey) || {
        sideTeam: m.attackers, // we'll render this as the Attacker team
        total: 0,
        wins: 0,
        notes: [],
        tags: [],
        lastAt: 0,
      };
      bucket.total += 1;
      if (m.result === 'WIN') bucket.wins += 1; // WIN refers to attacker won
      if (m.notes) bucket.notes.push(m.notes);
      if (m.tags?.length) bucket.tags.push(...m.tags);
      bucket.lastAt = Math.max(bucket.lastAt, m.createdAt || 0);
      map.set(aKey, bucket);
    }

    const rows = Array.from(map.values())
      .map((b) => ({
        sideTeam: b.sideTeam,
        total: b.total,
        wins: b.wins,
        winRate: b.total ? b.wins / b.total : 0,
        notes: uniq(b.notes),
        tags: uniq(b.tags),
        lastAt: b.lastAt,
      }))
      .sort((a, b) => b.total - a.total || b.winRate - a.winRate || b.lastAt - a.lastAt);

    return { qKey, rows, count: matches.length };
  }, [qDef, data]);

  // Export / Import
  function handleExport() {
    const payload = { schema: 'skrb_gvg_3v3_v1', exportedAt: new Date().toISOString(), matches: data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gvg-3v3-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  const importRef = useRef(null);
  function handleImportClick() { importRef.current?.click(); }
  function handleImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const list = Array.isArray(parsed?.matches) ? parsed.matches : Array.isArray(parsed) ? parsed : [];
        if (!list.length) { alert('ไฟล์ไม่ถูกต้องหรือไม่มีข้อมูล'); e.target.value=''; return; }
        const cleaned = list
          .map((m) => ({
            id: m.id || newId(),
            attackers: normalizeTeam(m.attackers || []),
            defenders: normalizeTeam(m.defenders || []),
            result: m.result === 'LOSS' ? 'LOSS' : 'WIN',
            notes: cleanWhitespace(m.notes || ''),
            tags: uniq((m.tags || []).map(cleanWhitespace).filter(Boolean)),
            createdAt: Number(m.createdAt) || Date.now(),
          }))
          .filter((m) => m.attackers.length === 3 && m.defenders.length === 3);
        if (!cleaned.length) { alert('ข้อมูลหลังทำความสะอาดว่างเปล่า'); e.target.value=''; return; }

        if (confirm('ต้องการรวมข้อมูลเข้ากับของเดิมหรือไม่? (OK = รวม / Cancel = แทนที่)')) {
          const bySig = new Map();
          const add = (m) => { const sig = `${teamKey(m.attackers)}=>${teamKey(m.defenders)}#${m.result}#${m.notes}`; const ex = bySig.get(sig); if (!ex || (m.createdAt||0) > (ex.createdAt||0)) bySig.set(sig, m); };
          data.forEach(add); cleaned.forEach(add);
          setData(Array.from(bySig.values()).sort((a,b)=> (b.createdAt||0)-(a.createdAt||0)));
        } else {
          setData(cleaned.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0)));
        }
      } catch(err){ console.error(err); alert('อ่านไฟล์ไม่สำเร็จ'); }
      finally { e.target.value=''; }
    };
    reader.readAsText(file);
  }

  function seedDemo() {
    const demo = [
      { attackers: ['Vanessa','Eileene','Rudy'], defenders: ['Orkah','Jave','Karin'], result: 'WIN',  notes: 'ต้อง C6+ ใส่เซ็ตต้าน 100%', tags: ['Archetype:ถึก','Reflect'] },
      { attackers: ['Vanessa','Eileene','Rudy'], defenders: ['Orkah','Jave','Karin'], result: 'LOSS', notes: 'โดนสวนแรง', tags: ['Reflect'] },
      { attackers: ['Vanessa','Eileene','Rudy'], defenders: ['Kris','Dellons','Aris'], result: 'WIN',  notes: '', tags: ['Archetype:ดาเมจเร็ว'] },
      { attackers: ['Spike','Rin','Rudy'],     defenders: ['Kris','Dellons','Aris'], result: 'LOSS', notes: 'ขาดต้านสถานะ', tags: ['ควรใส่ต้าน'] },
    ].map((m,i)=>({ id:newId(), attackers:normalizeTeam(m.attackers), defenders:normalizeTeam(m.defenders), result:m.result, notes:m.notes, tags:m.tags, createdAt: Date.now() - i*60000 }));

    setData((prev) => [...demo, ...prev]);
  }

  function clearAll() {
    if (confirm('ลบข้อมูลทั้งหมดหรือไม่?')) setData([]);
  }

  // -------------------- UI --------------------
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Seven Knights Rebirth — GvG 3v3 Tracker</h1>
            <p className="text-sm text-slate-600">Next.js (App Router) + Tailwind + localStorage — Single-file</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={seedDemo} variant="subtle">Seed demo data</Button>
            <Button onClick={handleExport} variant="outline">Export JSON</Button>
            <Button onClick={handleImportClick} variant="outline">Import JSON</Button>
            <input ref={importRef} type="file" accept="application/json" onChange={handleImport} className="hidden" />
            <Button onClick={clearAll} variant="danger">Clear all</Button>
          </div>
        </header>

        {/* Search Card (DEF -> ATTACKERS) */}
        <Card
          title="ค้นหาจากทีมผู้รับ (Defender 3 ตัว)"
          actions={
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 text-xs text-slate-600">
                ตรงทีมเป๊ะ (ปิดการแก้ไข — ใช้คีย์แบบไม่สนลำดับ)
              </span>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <HeroInput label="Defender #1" value={qDef[0]} onChange={(v) => setQDef([v, qDef[1], qDef[2]])} placeholder="เช่น Orkah" />
            <HeroInput label="Defender #2" value={qDef[1]} onChange={(v) => setQDef([qDef[0], v, qDef[2]])} placeholder="เช่น Jave" />
            <HeroInput label="Defender #3" value={qDef[2]} onChange={(v) => setQDef([qDef[0], qDef[1], v])} placeholder="เช่น Karin" />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={() => setQDef([...qDef])}>ค้นหา</Button>
            {searchStats?.count ? (
              <div className="text-sm text-slate-600">พบ {searchStats.count} แมตช์ที่บันทึกไว้</div>
            ) : (
              <div className="text-sm text-slate-400">ใส่ชื่อให้ครบ 3 ตัวเพื่อดูสถิติ</div>
            )}
          </div>

          {searchStats && (
            <div className="mt-6 space-y-3">
              {searchStats.rows.length > 0 ? (
                searchStats.rows.map((row, idx) => <StatRow key={idx} row={row} sideLabel="Attacker" />)
              ) : (
                <div className="text-sm text-slate-500">ยังไม่มีสถิติกับทีมบุกไหนๆ สำหรับทีมรับนี้</div>
              )}
            </div>
          )}
        </Card>

        {/* Add Match */}
        <div className="h-6" />
        <Card title="บันทึกแมตช์ใหม่" actions={null}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <HeroInput label="Attacker #1" value={atk[0]} onChange={(v) => setAtk([v, atk[1], atk[2]])} placeholder="Vanessa" />
            <HeroInput label="Attacker #2" value={atk[1]} onChange={(v) => setAtk([atk[0], v, atk[2]])} placeholder="Eileene" />
            <HeroInput label="Attacker #3" value={atk[2]} onChange={(v) => setAtk([atk[0], atk[1], v])} placeholder="Rudy" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <HeroInput label="Defender #1" value={def[0]} onChange={(v) => setDef([v, def[1], def[2]])} placeholder="Orkah" />
            <HeroInput label="Defender #2" value={def[1]} onChange={(v) => setDef([def[0], v, def[2]])} placeholder="Jave" />
            <HeroInput label="Defender #3" value={def[2]} onChange={(v) => setDef([def[0], def[1], v])} placeholder="Karin" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">ผลลัพธ์</span>
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={result}
                onChange={(e) => setResult(e.target.value)}
              >
                <option value="WIN">WIN</option>
                <option value="LOSS">LOSS</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-xs text-slate-500">Tags (คั่นด้วย ,)</span>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="ถึก, Archetype:ดาเมจเร็ว, Reflect"
              />
            </label>
          </div>

          <div className="mt-3">
            <Textarea label="หมายเหตุ" value={notes} onChange={setNotes} placeholder="เช่น ต้อง C6+ ใส่เซ็ตต้าน 100%" />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={addMatch}>บันทึกแมตช์</Button>
            <div className="text-xs text-slate-500">ระบบจะ Normalize ชื่อ และจัดลำดับทีมให้อัตโนมัติ</div>
          </div>
        </Card>

        {/* Recent matches */}
        <div className="h-6" />
        <Card title="แมตช์ล่าสุด" actions={null}>
          {data.length === 0 ? (
            <div className="text-sm text-slate-500">ยังไม่มีข้อมูล ลองเพิ่มหรือกด Seed demo data</div>
          ) : (
            <div className="space-y-2">
              {data.slice(0, 30).map((m) => (
                <div key={m.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-xl border border-slate-200 p-3">
                  <div className="md:col-span-4">
                    <div className="text-[11px] text-slate-500 mb-1">Attacker</div>
                    <TeamPill names={m.attackers} />
                  </div>
                  <div className="md:col-span-4">
                    <div className="text-[11px] text-slate-500 mb-1">Defender</div>
                    <TeamPill names={m.defenders} />
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-[11px] text-slate-500 mb-1">Result</div>
                    <Badge>{m.result}</Badge>
                  </div>
                  <div className="md:col-span-2 flex flex-wrap gap-1">
                    {m.tags?.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <footer className="py-8 text-center text-xs text-slate-400">
          Built for Seven Knights Rebirth GvG 3v3 • Local only • v2 (Search by Defender)
        </footer>
      </div>
    </main>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings, BarChart3, RefreshCw, Pin, TrendingUp, Circle, EyeOff, ChevronRight } from 'lucide-react';

function PinEditor({ 
  initialValue, 
  onSave 
}: { 
  initialValue: number | null;
  onSave: (val: number | null) => void;
}) {
  const [value, setValue] = useState(
    initialValue === null || initialValue === undefined ? '' : String(initialValue)
  );
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    setValue(initialValue === null || initialValue === undefined ? '' : String(initialValue));
    setSaved(true);
  }, [initialValue]);

  const handleSave = () => {
    const num = value === '' ? null : parseInt(value);
    const clean = (num === null || num === 0 || isNaN(num)) ? null : num;
    onSave(clean);
    setSaved(true);
  };

  return (
    <div className="flex items-center gap-1 justify-center">
      <input 
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        placeholder="—"
        onChange={(e) => {
          setValue(e.target.value.replace(/[^0-9]/g, ''));
          setSaved(false);
        }}
        className={`w-14 px-2 py-1.5 text-center text-sm rounded-md border tabular-nums transition-all outline-none
          ${!saved || (initialValue !== null && initialValue > 0)
            ? 'border-[#6b5eae] bg-[#f5f3fa] text-[#6b5eae] ring-2 ring-[#e8e6f1]' 
            : 'border-[#e9ebec] text-[#313a46] focus:border-[#3e60d5] focus:ring-2 focus:ring-[#e8edfa]'
          }`}
      />
      {!saved && (
        <button 
          onClick={handleSave}
          className="px-2 py-1.5 text-xs font-black bg-[#3e60d5] text-white rounded-md hover:bg-[#324ea7] transition-all active:scale-95 shadow-sm"
        >
          ✓
        </button>
      )}
    </div>
  );
}

export default function OfferSettings({ app, initialOffers, initialEpcMode }: any) {
  const initialRef = useRef({ offers: initialOffers, epcMode: initialEpcMode });
  const [offers, setOffers] = useState(initialRef.current.offers);
  const [epcMode, setEpcMode] = useState(initialRef.current.epcMode);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const updateEpcMode = async (mode: string) => {
    const prev = epcMode;
    setEpcMode(mode);
    try {
      const res = await fetch('/api/admin/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: app.appId, epc_mode: mode })
      });
      if (!res.ok) throw new Error();
    } catch (e) {
      setEpcMode(prev);
      alert('Ошибка при смене режима EPC');
    }
  };

  const updateOffer = async (slug: string, docId: string, fields: any) => {
    let prev: any[] = [];
    setOffers((current: any[]) => {
      prev = [...current];
      return current.map((o: any) => 
        o.slug === slug ? { 
          ...o, 
          ...fields, 
          isActive: fields.is_active ?? o.isActive, 
          manualPin: fields.manual_pin ?? o.manualPin 
        } : o
      );
    });

    try {
      const res = await fetch('/api/admin/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          app_id: app.appId, 
          offer_slug: slug, 
          doc_id: docId, 
          ...fields 
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
    } catch (e: any) {
      setOffers(prev);
      alert(e.message);
    }
  };

  const recalculate = async () => {
    if (!confirm('Пересчитать ротацию для этого приложения?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/recalculate?app_id=${app.appId}`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        alert('Пересчет завершен!');
        router.refresh();
      }
    } catch (e) {
      alert('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  };

  const pinZone = offers.filter((o: any) => o.manualPin !== null && o.isActive);
  const autoZone = offers.filter((o: any) => o.manualPin === null && o.autoPriority !== null && o.isActive);
  const defaultZone = offers.filter((o: any) => o.manualPin === null && o.autoPriority === null && o.isActive);
  const inactiveZone = offers.filter((o: any) => !o.isActive);

  pinZone.sort((a: any, b: any) => a.manualPin - b.manualPin);
  autoZone.sort((a: any, b: any) => a.autoPriority - b.autoPriority);
  defaultZone.sort((a: any, b: any) => a.initialPos - b.initialPos);

  const zoneBadgeClass = (zone: string, isActive: boolean) => {
    if (!isActive) return 'bg-[#e9ebec] text-[#98a6ad]';
    return {
      pin: 'bg-[#6b5eae] text-white',
      auto: 'bg-[#3e60d5] text-white',
      default: 'bg-[#98a6ad] text-white',
    }[zone] || 'bg-[#98a6ad] text-white';
  };

  const renderRow = (o: any, zone: string) => (
    <tr key={`${o.slug}-${zone}`} className="border-b border-[#f0f1f2] hover:bg-[#f8f9fa] transition-colors">
      <td className="px-5 py-3.5 text-black text-black">
        <div className="flex items-center gap-3">
          <Avatar slug={o.slug} displayName={o.displayName} isActive={o.isActive} />
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${o.isActive ? 'text-[#313a46]' : 'text-[#98a6ad]'}`}>
                {o.displayName}
              </span>
              {!o.hasSlug && (
                <span className="px-1.5 py-0.5 rounded bg-[#fcebee] text-[#f1556c] text-[9px] font-bold uppercase tracking-wider">
                  NO SLUG
                </span>
              )}
            </div>
            {o.hasSlug && (
              <div className="text-xs text-[#98a6ad] mt-0.5 font-mono truncate max-w-[150px]">
                {o.slug}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 text-center">
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${zoneBadgeClass(zone, o.isActive)}`}>
          #{o.currentPos}
        </span>
      </td>
      <td className="px-5 py-3.5 text-center text-black border-black">
        <button
          onClick={() => updateOffer(o.slug, o.docId, { is_active: !o.isActive })}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold font-sans transition-all border
            ${o.isActive 
              ? 'bg-[#ebf5f3] text-[#1abc9c] border-[#1abc9c]/10 hover:bg-[#d4ebe4]' 
              : 'bg-[#fcebee] text-[#f1556c] border-[#f1556c]/10 hover:bg-[#f5d4da]'
            }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${o.isActive ? 'bg-[#1abc9c]' : 'bg-[#f1556c]'}`} />
          {o.isActive ? 'Активен' : 'Скрыт'}
        </button>
      </td>
      <td className="px-5 py-3.5 text-center">
        <PinEditor 
          initialValue={o.manualPin}
          onSave={(newValue) => {
            fetch('/api/admin/override', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ app_id: app.appId, offer_slug: o.slug, doc_id: o.docId, manual_pin: newValue })
            }).then(res => {
              if (!res.ok) res.json().then(data => alert(data.error || 'Ошибка'));
              else {
                setOffers((curr: any[]) => curr.map((item: any) => item.slug === o.slug ? { ...item, manualPin: newValue } : item));
              }
            });
          }}
        />
      </td>
      <td className="px-5 py-3.5 text-right text-sm tabular-nums">
        {o.epc > 0 ? (
          <span className={`font-semibold ${o.isActive ? 'text-[#1abc9c]' : 'text-[#98a6ad]'}`}>
            {o.epc.toFixed(2)}
          </span>
        ) : (
          <span className="text-[#98a6ad]">—</span>
        )}
      </td>
    </tr>
  );

  return (
    <div className="space-y-6 text-black border-black">
      <div className="mb-6">
        <nav className="flex items-center gap-1.5 text-xs text-[#6c757d] mb-3">
          <Link href="/admin" className="hover:text-[#3e60d5] transition-colors">Главная</Link>
          <ChevronRight className="w-3 h-3 text-[#e9ebec]" />
          <span className="text-[#313a46]">{app.name}</span>
        </nav>
        
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-[#313a46] capitalize">{app.name}</h1>
              <span className="px-2 py-0.5 rounded-full bg-white border border-[#e9ebec] text-[11px] font-bold font-mono text-[#6c757d]">
                {app.appId}
              </span>
            </div>
            <p className="text-sm text-[#6c757d]">Управление офферами и приоритетами</p>
          </div>
          
          <Link href={`/admin/stats/${app.appId}`} className="flex items-center gap-2 px-4 py-2 rounded-md border border-[#e9ebec] bg-white text-sm font-medium text-[#313a46] hover:bg-[#f5f6f8] transition-colors shadow-[0_0_35px_0_rgba(154,161,171,0.15)]">
            <BarChart3 className="w-4 h-4 text-[#6c757d]" />
            Открыть статистику
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#e9ebec] p-5 flex items-center justify-between shadow-[0_0_35px_0_rgba(154,161,171,0.15)]">
        <div>
          <label className="block text-[11px] font-bold text-[#6c757d] uppercase tracking-wider mb-2">Метод ротации</label>
          <select value={epcMode} onChange={(e) => updateEpcMode(e.target.value)}
            className="w-56 px-3 py-2 rounded-md border border-[#e9ebec] text-sm text-[#313a46] focus:outline-none focus:border-[#3e60d5] focus:ring-2 focus:ring-[#e8edfa] bg-white transition-all font-medium cursor-pointer"
          >
            <option value="global">Глобальный</option>
            <option value="per_app">По приложению</option>
          </select>
        </div>
        <button onClick={recalculate} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#3e60d5] text-white text-sm font-medium hover:bg-[#324ea7] transition-all shadow-md active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
          Пересчитать сейчас
        </button>
      </div>

      <div className="bg-white rounded-lg border border-[#e9ebec] overflow-hidden shadow-[0_0_35px_0_rgba(154,161,171,0.15)]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#f5f6f8] border-b border-[#e9ebec]">
              <th className="px-5 py-3 text-left text-[11px] font-bold text-[#6c757d] uppercase tracking-wider">Оффер</th>
              <th className="px-5 py-3 text-center text-[11px] font-bold text-[#6c757d] uppercase tracking-wider">Витрина</th>
              <th className="px-5 py-3 text-center text-[11px] font-bold text-[#6c757d] uppercase tracking-wider">Статус</th>
              <th className="px-5 py-3 text-center text-[11px] font-bold text-[#6c757d] uppercase tracking-wider text-[#3e60d5]">Manual PIN</th>
              <th className="px-5 py-3 text-right text-[11px] font-bold text-[#6c757d] uppercase tracking-wider leading-none">EPC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f1f2]">
            {pinZone.length > 0 && <ZoneRows zone="pin" count={pinZone.length} />}
            {pinZone.map((o: any) => renderRow(o, 'pin'))}

            <ZoneRows zone="auto" count={autoZone.length} />
            {autoZone.map((o: any) => renderRow(o, 'auto'))}

            {defaultZone.length > 0 && <ZoneRows zone="default" count={defaultZone.length} />}
            {defaultZone.map((o: any) => renderRow(o, 'default'))}

            {inactiveZone.length > 0 && <ZoneRows zone="hidden" count={inactiveZone.length} />}
            {inactiveZone.map((o: any) => renderRow(o, 'hidden'))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ZoneRows({ zone, count }: { zone: string, count: number }) {
  const styles: any = {
    pin: { icon: Pin, bg: 'bg-[#e8e6f1]', text: 'text-[#6b5eae]', label: 'PIN-ЗОНА' },
    auto: { icon: TrendingUp, bg: 'bg-[#e8edfa]', text: 'text-[#3e60d5]', label: 'AUTO-ЗОНА' },
    default: { icon: Circle, bg: 'bg-[#f0f1f2]', text: 'text-[#98a6ad]', label: 'DEFAULT-ЗОНА' },
    hidden: { icon: EyeOff, bg: 'bg-[#fcebee]', text: 'text-[#f1556c]', label: 'СКРЫТЫЕ' },
  };
  const { icon: Icon, bg, text, label } = styles[zone] || styles.default;
  return (
    <tr className="bg-[#f8f9fa] border-y border-[#e9ebec]">
      <td colSpan={5} className="px-5 py-2.5">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full ${bg} flex items-center justify-center`}>
            <Icon className={`w-3.5 h-3.5 ${text}`} />
          </div>
          <span className={`text-[11px] font-bold ${text} uppercase tracking-wider`}>
            {label} · {count}
          </span>
        </div>
      </td>
    </tr>
  );
}

function Avatar({ slug, displayName, isActive }: { slug: string, displayName: string, isActive: boolean }) {
  const colors = [
    { bg: 'bg-[#e8edfa]', text: 'text-[#3e60d5]' }, // a-e
    { bg: 'bg-[#e8e6f1]', text: 'text-[#6b5eae]' }, // f-j
    { bg: 'bg-[#ebf5f3]', text: 'text-[#1abc9c]' }, // k-o
    { bg: 'bg-[#fef5e4]', text: 'text-[#f9c851]' }, // p-t
    { bg: 'bg-[#fcebee]', text: 'text-[#f1556c]' }, // u-z
  ];
  
  const char = (displayName?.[0] || slug?.[0] || '?').toUpperCase();
  const charCode = char.charCodeAt(0);
  // Используем модуль 5 для стабильного выбора цвета из массива
  const colorIdx = charCode % 5;
  let { bg, text } = colors[colorIdx];
  
  if (!isActive) {
      bg = 'bg-[#f0f1f2]';
      text = 'text-[#98a6ad]';
  }

  return (
    <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center text-sm font-bold ${text} uppercase shadow-inner shrink-0`}>
      {char}
    </div>
  );
}

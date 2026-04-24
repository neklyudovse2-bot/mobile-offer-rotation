'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, BarChart3, RefreshCw, Pin, TrendingUp, Circle, EyeOff } from 'lucide-react';

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

  // Синхронизируем при изменении initialValue извне
  useEffect(() => {
    setValue(initialValue === null || initialValue === undefined ? '' : String(initialValue));
    setSaved(true);
  }, [initialValue]);

  const handleSave = () => {
    const num = value === '' ? null : parseInt(value);
    // Null если пусто, 0, или NaN
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
        className="w-14 px-2 py-1.5 text-center text-sm rounded-md border border-gray-300 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all font-mono shadow-sm"
      />
      {!saved && (
        <button 
          onClick={handleSave}
          className="px-2.5 py-1.5 text-xs font-black bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all active:scale-90 flex items-center justify-center shadow-sm"
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
    console.log('[CLIENT] updateOffer called', { slug, docId, fields });
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

  const renderRow = (o: any) => (
    <tr key={o.slug} className={`${!o.isActive ? 'bg-[#f8f9fa] opacity-60' : 'hover:bg-slate-50'} transition-all`}>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Avatar slug={o.slug} />
          <div>
            <div className="text-sm font-semibold text-[#313a46]">{o.displayName}</div>
            <div className="text-[10px] text-[#98a6ad] font-mono leading-none mt-0.5">{o.slug}</div>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 text-center">
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
          o.isActive ? (
            o.manualPin ? 'bg-[#6b5eae] text-white shadow-sm' : 
            o.autoPriority ? 'bg-[#3e60d5] text-white shadow-sm' :
            'bg-[#98a6ad] text-white'
          ) : 'bg-[#e9ebec] text-[#98a6ad]'
        }`}>
          #{o.currentPos}
        </span>
      </td>
      <td className="px-5 py-3.5 text-center">
        <button
          onClick={() => updateOffer(o.slug, o.docId, { is_active: !o.isActive })}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all border
            ${o.isActive 
              ? 'bg-[#ebf5f3] text-[#1abc9c] border-[#1abc9c]/20 hover:bg-[#d4ebe4]' 
              : 'bg-[#fcebee] text-[#f1556c] border-[#f1556c]/20 hover:bg-[#f5d4da]'
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
            console.log('[PIN SAVE]', { slug: o.slug, newValue });
            fetch('/api/admin/override', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                app_id: app.appId, 
                offer_slug: o.slug, 
                doc_id: o.docId, 
                manual_pin: newValue 
              })
            }).then(res => {
              if (!res.ok) {
                res.json().then(data => alert(data.error || 'Ошибка'));
              } else {
                setOffers((curr: any[]) => 
                  curr.map((item: any) => 
                    item.slug === o.slug ? { ...item, manualPin: newValue } : item
                  )
                );
              }
            });
          }}
        />
      </td>
      <td className="px-5 py-3.5 text-center text-xs font-semibold text-[#98a6ad] font-mono tabular-nums">
        {o.autoPriority || '—'}
      </td>
      <td className="px-5 py-3.5 text-center text-[11px] text-[#98a6ad] font-mono tabular-nums">
        {o.initialPos}
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-[#e9ebec] p-5 flex items-center justify-between shadow-[0_0_35px_0_rgba(154,161,171,0.15)]">
        <div>
          <label className="block text-[11px] font-bold text-[#6c757d] uppercase tracking-wider mb-2">Метод ротации (EPC Mode)</label>
          <select 
            value={epcMode} 
            onChange={(e) => updateEpcMode(e.target.value)}
            className="w-64 px-3 py-2 rounded-md border border-[#e9ebec] text-sm text-[#313a46] focus:outline-none focus:border-[#3e60d5] focus:ring-2 focus:ring-[#e8edfa] bg-white transition-all font-medium cursor-pointer"
          >
            <option value="global">Глобальный (Глобально)</option>
            <option value="per_app">По приложению (Lokal)</option>
          </select>
        </div>
        <button 
          onClick={recalculate}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-[#3e60d5] text-white text-sm font-semibold hover:bg-[#324ea7] transition-all shadow-md active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
          {saving ? 'Пересчет...' : 'Пересчитать сейчас'}
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
              <th className="px-5 py-3 text-center text-[11px] font-bold text-[#6c757d] uppercase tracking-wider">Auto</th>
              <th className="px-5 py-3 text-center text-[11px] font-bold text-[#6c757d] uppercase tracking-wider">Orig</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f1f2]">
            {/* PIN ZONE */}
            {pinZone.length > 0 && <ZoneRows zone="pin" count={pinZone.length} />}
            {pinZone.map(renderRow)}

            {/* AUTO ZONE */}
            <ZoneRows zone="auto" count={autoZone.length} />
            {autoZone.map(renderRow)}

            {/* DEFAULT ZONE */}
            {defaultZone.length > 0 && <ZoneRows zone="default" count={defaultZone.length} />}
            {defaultZone.map(renderRow)}

            {/* INACTIVE */}
            {inactiveZone.length > 0 && <ZoneRows zone="hidden" count={inactiveZone.length} />}
            {inactiveZone.map(renderRow)}
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
  const { icon: Icon, bg, text, label } = styles[zone];
  return (
    <tr className="bg-[#f8f9fa] border-y border-[#e9ebec]">
      <td colSpan={6} className="px-5 py-2.5">
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

function Avatar({ slug }: { slug: string }) {
  const colors = [
    { bg: 'bg-[#e8edfa]', text: 'text-[#3e60d5]' },
    { bg: 'bg-[#e8e6f1]', text: 'text-[#6b5eae]' },
    { bg: 'bg-[#ebf5f3]', text: 'text-[#1abc9c]' },
    { bg: 'bg-[#fef5e4]', text: 'text-[#f9c851]' },
    { bg: 'bg-[#fcebee]', text: 'text-[#f1556c]' },
  ];
  const char = (slug[0] || '?').toLowerCase();
  const charCode = char.charCodeAt(0);
  const colorIdx = charCode >= 97 && charCode <= 122 ? Math.floor((charCode - 97) / 5) : 0;
  const { bg, text } = colors[colorIdx] || colors[0];
  
  return (
    <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center text-sm font-black ${text} uppercase shadow-inner`}>
      {char}
    </div>
  );
}

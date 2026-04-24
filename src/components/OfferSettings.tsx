'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OfferSettings({ app, initialOffers, initialEpcMode }: any) {
  const [epcMode, setEpcMode] = useState(initialEpcMode);
  const [offers, setOffers] = useState(initialOffers);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  // Хак для предотвращения проблем при внешних обновлениях (хотя с Ref-паттерном лучше)
  // Но здесь мы полагаемся на то, что это единственный источник правды в сессии
  
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
    const prevOffers = [...offers];
    const updated = offers.map((o: any) => o.slug === slug ? { ...o, ...fields } : o);
    setOffers(updated);

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
      setOffers(prevOffers);
      alert(e.message);
    }
  };

  const recalculate = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/recalculate?app_id=${app.appId}`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        alert('Пересчет приложения завершен!');
        router.refresh();
        window.location.reload();
      } else {
        alert('Ошибка: ' + (data.error || 'Unknown'));
      }
    } catch (e) {
      alert('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  };

  // Разделение на зоны для отображения
  const pinZone = offers.filter((o: any) => o.manualPin !== null && o.isActive);
  const autoZone = offers.filter((o: any) => o.manualPin === null && o.autoPriority !== null && o.isActive);
  const defaultZone = offers.filter((o: any) => o.manualPin === null && o.autoPriority === null && o.isActive);
  const inactiveZone = offers.filter((o: any) => !o.isActive);

  // Сортировка внутри зон (временно для UI, пока не обновился серверный пропс)
  pinZone.sort((a: any, b: any) => a.manualPin - b.manualPin);
  autoZone.sort((a: any, b: any) => a.autoPriority - b.autoPriority);
  defaultZone.sort((a: any, b: any) => a.initialPos - b.initialPos);

  const renderRow = (o: any) => (
    <tr key={o.slug} className={`${!o.isActive ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50/50'} transition-all`}>
      <td className="px-6 py-4">
        <div className="font-bold text-gray-900">{o.displayName}</div>
        {!o.hasSlug && <span className="text-[10px] text-gray-400 font-mono tracking-tighter">NO SLUG: {o.slug}</span>}
      </td>
      <td className="px-6 py-4 font-mono text-blue-600 text-center text-sm font-bold">#{o.currentPos}</td>
      <td className="px-6 py-4 text-center">
        <input 
          type="checkbox" 
          checked={o.isActive} 
          onChange={(e) => updateOffer(o.slug, o.docId, { is_active: e.target.checked })}
          className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
        />
      </td>
      <td className="px-6 py-4 text-center">
        <input 
          type="number" 
          value={o.manualPin === null ? '' : o.manualPin}
          placeholder="—"
          onBlur={(e) => {
             const val = e.target.value === '' ? null : parseInt(e.target.value);
             if (val !== o.manualPin) updateOffer(o.slug, o.docId, { manual_pin: val });
          }}
          onChange={(e) => {
             const val = e.target.value === '' ? null : parseInt(e.target.value);
             setOffers(offers.map((curr: any) => curr.slug === o.slug ? { ...curr, manualPin: val } : curr));
          }}
          className="p-2 border border-gray-300 rounded w-16 text-center font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </td>
      <td className="px-6 py-4 font-mono text-center text-gray-400 text-xs">{o.autoPriority || '—'}</td>
      <td className="px-6 py-4 font-mono text-center text-gray-400 text-[10px]">{o.initialPos}</td>
    </tr>
  );

  return (
    <div className="space-y-8">
      <div className="bg-gray-50 p-6 rounded border border-gray-100 flex justify-between items-center">
        <div>
          <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest">Основной режим EPC</label>
          <select 
            value={epcMode} 
            onChange={(e) => updateEpcMode(e.target.value)}
            disabled={saving}
            className="p-3 bg-white border border-gray-200 rounded font-bold min-w-[200px] cursor-pointer outline-none"
          >
            <option value="global">Глобальный (global)</option>
            <option value="per_app">По приложению (per_app)</option>
          </select>
        </div>
        <button 
          onClick={recalculate}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors uppercase text-xs tracking-wider"
        >
          {saving ? 'Выполнение...' : 'Пересчитать сейчас'}
        </button>
      </div>

      <div className="border border-gray-100 rounded overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-black">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <th className="px-6 py-4">Оффер (Title)</th>
              <th className="px-6 py-4 text-center">Итоговая Поз.</th>
              <th className="px-6 py-4 text-center">Активен</th>
              <th className="px-6 py-4 text-center text-blue-600">Manual PIN</th>
              <th className="px-6 py-4 text-center">Auto Pri</th>
              <th className="px-6 py-4 text-center">Default</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {/* PIN ZONE */}
            {pinZone.map(renderRow)}
            {pinZone.length > 0 && (
              <tr><td colSpan={6} className="bg-blue-50/30 border-y border-blue-100 py-1 text-[9px] text-center font-bold text-blue-400 tracking-widest">END OF PIN ZONE</td></tr>
            )}

            {/* AUTO ZONE */}
            {autoZone.map(renderRow)}
            {autoZone.length > 0 && (
              <tr><td colSpan={6} className="bg-green-50/30 border-y border-green-100 py-1 text-[9px] text-center font-bold text-green-400 tracking-widest">END OF AUTO ZONE</td></tr>
            )}

            {/* DEFAULT ZONE */}
            {defaultZone.map(renderRow)}
            
            {/* INACTIVE */}
            {inactiveZone.length > 0 && (
              <>
                <tr><td colSpan={6} className="bg-gray-100 border-y border-gray-200 py-1 text-[9px] text-center font-bold text-gray-400 tracking-widest uppercase">Inactive Offers (Hidden)</td></tr>
                {inactiveZone.map(renderRow)}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

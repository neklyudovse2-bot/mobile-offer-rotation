'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OfferSettings({ app, initialOffers, initialEpcMode }: any) {
  const [epcMode, setEpcMode] = useState(initialEpcMode);
  const [offers, setOffers] = useState(initialOffers);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setOffers(initialOffers);
  }, [initialOffers]);

  useEffect(() => {
    setEpcMode(initialEpcMode);
  }, [initialEpcMode]);

  const updateEpcMode = async (mode: string) => {
    let prev = epcMode;
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
    let prevOffers: any[] = [];
    setOffers((current: any[]) => {
      prevOffers = current;
      return current.map((o: any) => o.slug === slug ? { ...o, ...fields } : o);
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
      if (!res.ok) throw new Error();
    } catch (e: any) {
      setOffers(prevOffers);
      alert('Ошибка при сохранении');
    }
  };

  const recalculate = async () => {
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
    <tr key={o.slug} className={`${!o.isActive ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50/50'} transition-all`}>
      <td className="px-6 py-4">
        <div className="font-bold text-gray-900">{o.displayName}</div>
        {!o.hasSlug && <span className="text-[10px] text-gray-400 font-mono">NO SLUG: {o.slug}</span>}
      </td>
      <td className="px-6 py-4 font-mono text-blue-600 text-center text-sm font-bold">#{o.currentPos}</td>
      <td className="px-6 py-4 text-center">
        <button
          type="button"
          onClick={() => updateOffer(o.slug, o.docId, { is_active: !o.isActive })}
          className={`px-4 py-2 rounded font-mono text-[10px] font-black transition-all border shadow-sm ${
            o.isActive 
            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-600 hover:text-white' 
            : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-600 hover:text-white'
          }`}
        >
          {o.isActive ? 'TRUE' : 'FALSE'}
        </button>
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
             setOffers((curr: any[]) => curr.map((item: any) => item.slug === o.slug ? { ...item, manualPin: val } : item));
          }}
          className="p-2 border border-gray-300 rounded w-16 text-center font-mono focus:border-blue-500 focus:ring-1 outline-none"
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
          <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest">Метод EPC</label>
          <select 
            value={epcMode} 
            onChange={(e) => updateEpcMode(e.target.value)}
            className="p-3 bg-white border border-gray-200 rounded font-bold min-w-[200px] cursor-pointer outline-none shadow-sm"
          >
            <option value="global">Глобальный (global)</option>
            <option value="per_app">По приложению (per_app)</option>
          </select>
        </div>
        <button 
          onClick={recalculate}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors uppercase text-xs tracking-wider shadow-md active:scale-95"
        >
          {saving ? 'Считаю...' : 'Пересчитать сейчас'}
        </button>
      </div>

      <div className="border border-gray-100 rounded overflow-hidden shadow-sm bg-white">
        <table className="w-full text-left text-sm text-black">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <th className="px-6 py-4">Оффер (Title)</th>
              <th className="px-6 py-4 text-center">Витрина</th>
              <th className="px-6 py-4 text-center">Статус</th>
              <th className="px-6 py-4 text-center text-blue-600">Manual PIN</th>
              <th className="px-6 py-4 text-center">Auto</th>
              <th className="px-6 py-4 text-center">Orig</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pinZone.map(renderRow)}
            {pinZone.length > 0 && <tr><td colSpan={6} className="bg-blue-50/20 py-1 text-[8px] text-center font-bold text-blue-300 tracking-[0.2em] uppercase">Manual Priority End</td></tr>}
            {autoZone.map(renderRow)}
            {autoZone.length > 0 && <tr><td colSpan={6} className="bg-green-50/20 py-1 text-[8px] text-center font-bold text-green-300 tracking-[0.2em] uppercase">EPC Logic End</td></tr>}
            {defaultZone.map(renderRow)}
            {inactiveZone.length > 0 && (
              <>
                <tr><td colSpan={6} className="bg-gray-50 py-1 text-[8px] text-center font-bold text-gray-300 tracking-[0.2em] uppercase">Hidden Offers</td></tr>
                {inactiveZone.map(renderRow)}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

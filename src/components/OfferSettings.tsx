'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OfferSettings({ app, initialOffers, initialEpcMode }: any) {
  const [epcMode, setEpcMode] = useState(initialEpcMode);
  const [offers, setOffers] = useState(initialOffers);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const updateEpcMode = async (mode: string) => {
    setEpcMode(mode);
    setSaving(true);
    const res = await fetch('/api/admin/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: app.appId, epc_mode: mode })
    });
    if (res.ok) router.refresh();
    setSaving(false);
  };

  const updateOffer = async (slug: string, docId: string, fields: any) => {
    const updated = offers.map((o: any) => o.slug === slug ? { ...o, ...fields } : o);
    setOffers(updated);
    setSaving(true);
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
    if (res.ok) router.refresh();
    setSaving(false);
  };

  const recalculate = async () => {
    setSaving(true);
    const res = await fetch('/api/admin/recalculate', { method: 'POST' });
    const data = await res.json();
    alert(data.ok ? 'Ротация обновлена!' : 'Ошибка: ' + data.error);
    window.location.reload();
  };

  return (
    <div className="space-y-8">
      <div className="bg-gray-50 p-6 rounded border border-gray-100 flex justify-between items-center">
        <div>
          <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest">Основной режим EPC</label>
          <select 
            value={epcMode} 
            onChange={(e) => updateEpcMode(e.target.value)}
            className="p-3 bg-white border border-gray-200 rounded font-bold min-w-[200px]"
          >
            <option value="global">Глобальный (global)</option>
            <option value="per_app">По приложению (per_app)</option>
          </select>
        </div>
        <button 
          onClick={recalculate}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Выполнение...' : 'Пересчитать сейчас'}
        </button>
      </div>

      <div className="border border-gray-100 rounded overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <th className="px-6 py-4">Оффер (Title)</th>
              <th className="px-6 py-4">Текущая Поз.</th>
              <th className="px-6 py-4 text-center">Активен</th>
              <th className="px-6 py-4 text-center">Pin Позиция</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {offers.map((o: any) => (
              <tr key={o.slug} className={!o.isActive ? 'bg-gray-50 opacity-60' : ''}>
                <td className="px-6 py-4 font-bold">
                  {o.displayName} {!o.hasSlug && <span className="text-[9px] text-gray-400 border border-gray-200 px-1 ml-1 rounded">NO SLUG</span>}
                </td>
                <td className="px-6 py-4 font-mono text-blue-600">#{o.currentPos}</td>
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
                    placeholder="None"
                    value={o.pinnedPos || ''}
                    onChange={(e) => updateOffer(o.slug, o.docId, { pinned_position: e.target.value ? parseInt(e.target.value) : null })}
                    className="p-2 border border-gray-200 rounded w-20 text-center font-mono"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

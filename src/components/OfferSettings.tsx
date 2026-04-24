'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OfferSettings({ app, initialOffers, initialEpcMode }: any) {
  const [epcMode, setEpcMode] = useState(initialEpcMode);
  const [offers, setOffers] = useState(initialOffers);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const updateEpcMode = async (mode: string) => {
    const prev = epcMode;
    setEpcMode(mode); // Оптимистично
    
    try {
      const res = await fetch('/api/admin/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: app.appId, epc_mode: mode })
      });
      if (!res.ok) throw new Error();
    } catch (e) {
      setEpcMode(prev); // Откат
      alert('Ошибка при смене режима EPC');
    }
  };

  const updateOffer = async (slug: string, docId: string, fields: any) => {
    // Сохраняем предыдущее состояние для отката
    const prevOffers = [...offers];
    
    // Обновляем локальный стейт мгновенно
    const updated = offers.map((o: any) => 
      o.slug === slug ? { ...o, ...fields } : o
    );
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
      if (!res.ok) throw new Error();
    } catch (e) {
      setOffers(prevOffers); // Откат при ошибке
      alert('Ошибка при сохранении оффера');
    }
  };

  const recalculate = async () => {
    if (!confirm('Запустить ротацию для всех приложений?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/recalculate', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        alert('Ротация завершена!');
        router.refresh();
      } else {
        alert('Ошибка: ' + (data.error || 'Unknown'));
      }
    } catch (e: any) {
      alert('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-gray-50 p-6 rounded border border-gray-100 flex justify-between items-center">
        <div>
          <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest">Основной режим EPC</label>
          <select 
            value={epcMode} 
            onChange={(e) => updateEpcMode(e.target.value)}
            disabled={saving}
            className="p-3 bg-white border border-gray-200 rounded font-bold min-w-[200px] cursor-pointer"
          >
            <option value="global">Глобальный (global)</option>
            <option value="per_app">По приложению (per_app)</option>
          </select>
        </div>
        <button 
          onClick={recalculate}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Выполнение...' : 'Пересчитать сейчас'}
        </button>
      </div>

      <div className="border border-gray-100 rounded overflow-hidden">
        <table className="w-full text-left text-sm text-black">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <th className="px-6 py-4">Оффер (Title)</th>
              <th className="px-6 py-4 text-center">Текущая Поз.</th>
              <th className="px-6 py-4 text-center">Активен</th>
              <th className="px-6 py-4 text-center">Pin Позиция</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {offers.map((o: any) => (
              <tr key={o.slug} className={`${!o.isActive ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50/50'} transition-all`}>
                <td className="px-6 py-4 font-bold">
                  {o.displayName} {!o.hasSlug && <span className="text-[9px] text-gray-400 border border-gray-200 px-1 ml-1 rounded">NO SLUG</span>}
                </td>
                <td className="px-6 py-4 font-mono text-blue-600 text-center">#{o.currentPos}</td>
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
                    placeholder="—"
                    value={o.pinnedPos || ''}
                    onBlur={(e) => {
                       const val = e.target.value ? parseInt(e.target.value) : null;
                       if (val !== o.pinnedPos) updateOffer(o.slug, o.docId, { pinned_position: val });
                    }}
                    onChange={(e) => {
                       // Просто визуальное обновление стейта в процессе ввода, без fetch
                       const updated = offers.map((curr: any) => curr.slug === o.slug ? { ...curr, pinnedPos: e.target.value ? parseInt(e.target.value) : null } : curr);
                       setOffers(updated);
                    }}
                    className="p-2 border border-gray-300 rounded w-16 text-center font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
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

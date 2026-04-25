'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Pin } from 'lucide-react';

interface Offer {
  slug: string;
  hasSlug: boolean;
  docId: string;
  displayName: string;
  isActive: boolean;
  manualPin: number | null;
  autoPriority: number | null;
  initialPos: number;
  currentPos: number;
  epc: number;
}

interface Props {
  app: any;
  initialOffers: Offer[];
  initialEpcMode: string;
}

export default function OfferSettings({ app, initialOffers, initialEpcMode }: Props) {
  const initialRef = useRef({ offers: initialOffers, epcMode: initialEpcMode });
  const [offers, setOffers] = useState<Offer[]>(initialRef.current.offers);
  const [epcMode, setEpcMode] = useState(initialRef.current.epcMode);
  const [recalculating, setRecalculating] = useState(false);
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
    let prev: Offer[] = [];
    
    setOffers((current) => {
      prev = [...current];
      return current.map((o) => 
        o.slug === slug ? { 
          ...o, 
          isActive: fields.is_active !== undefined ? fields.is_active : o.isActive,
          manualPin: 'manual_pin' in fields ? fields.manual_pin : o.manualPin,
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
        throw new Error(data.error || 'Ошибка');
      }
    } catch (e: any) {
      setOffers(prev);
      alert(e.message);
    }
  };

  const recalculate = async () => {
    setRecalculating(true);
    try {
      const res = await fetch(`/api/admin/recalculate?app_id=${app.appId}`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        router.refresh();
      } else {
        alert('Ошибка пересчёта');
      }
    } catch (e) {
      alert('Ошибка соединения');
    } finally {
      setRecalculating(false);
    }
  };

  // Sort by zone
  const pinZone = offers
    .filter((o) => o.manualPin !== null && o.isActive)
    .sort((a, b) => (a.manualPin || 0) - (b.manualPin || 0));
    
  const autoZone = offers
    .filter((o) => o.manualPin === null && o.autoPriority !== null && o.isActive)
    .sort((a, b) => (a.autoPriority || 0) - (b.autoPriority || 0));
    
  const defaultZone = offers
    .filter((o) => o.manualPin === null && o.autoPriority === null && o.isActive)
    .sort((a, b) => a.initialPos - b.initialPos);
    
  const inactiveZone = offers
    .filter((o) => !o.isActive)
    .sort((a, b) => a.initialPos - b.initialPos);

  // Calculate display position
  let posCounter = 0;
  const withPositions = [
    ...pinZone.map((o) => ({ ...o, displayPos: ++posCounter, zone: 'pin' as const })),
    ...autoZone.map((o) => ({ ...o, displayPos: ++posCounter, zone: 'auto' as const })),
    ...defaultZone.map((o) => ({ ...o, displayPos: ++posCounter, zone: 'default' as const })),
  ];

  let hiddenCounter = posCounter;
  const hiddenWithPositions = inactiveZone.map((o) => ({ 
    ...o, 
    displayPos: ++hiddenCounter, 
    zone: 'hidden' as const 
  }));

  return (
    <div className="space-y-6">
      {/* Controls bar */}
      <div className="border border-[#eaeaea] rounded-md bg-white p-5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <label className="block text-[11px] font-medium text-[#666] uppercase tracking-wider mb-2">
              Метод ротации
            </label>
            <select 
              value={epcMode} 
              onChange={(e) => updateEpcMode(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-[#eaeaea] 
                         bg-white text-black focus:outline-none focus:border-black 
                         transition-colors cursor-pointer"
            >
              <option value="global">Глобальный (по всем приложениям)</option>
              <option value="per_app">По приложению</option>
            </select>
          </div>
        </div>
        <button 
          onClick={recalculate}
          disabled={recalculating}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-black text-white 
                     text-sm font-medium hover:bg-[#333] transition-colors 
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin' : ''}`} />
          {recalculating ? 'Пересчитываем…' : 'Пересчитать'}
        </button>
      </div>

      {/* Offers table */}
      <div className="border border-[#eaeaea] rounded-md bg-white overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#eaeaea] bg-[#fafafa]">
              <th className="px-5 py-3 text-left text-[11px] font-medium 
                             text-[#666] uppercase tracking-wider w-20">
                Витрина
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-medium 
                             text-[#666] uppercase tracking-wider">
                Оффер
              </th>
              <th className="px-5 py-3 text-center text-[11px] font-medium 
                             text-[#666] uppercase tracking-wider w-32">
                Статус
              </th>
              <th className="px-5 py-3 text-center text-[11px] font-medium 
                             text-[#666] uppercase tracking-wider w-32">
                Manual PIN
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-medium 
                             text-[#666] uppercase tracking-wider w-24">
                EPC
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Active zones */}
            {pinZone.length > 0 && (
              <ZoneSeparator label="Pin" count={pinZone.length} icon={<Pin className="w-3 h-3" />} />
            )}
            {pinZone.map((o, idx) => (
              <OfferRow 
                key={o.slug}
                offer={o}
                position={posCounter - autoZone.length - defaultZone.length - pinZone.length + idx + 1}
                zone="pin"
                onToggleActive={() => updateOffer(o.slug, o.docId, { is_active: !o.isActive })}
                onSavePin={(val) => updateOffer(o.slug, o.docId, { manual_pin: val })}
              />
            ))}

            {(pinZone.length > 0 && autoZone.length > 0) && <ZoneSeparator label="Auto" count={autoZone.length} />}
            {(pinZone.length === 0 && autoZone.length > 0) && <ZoneSeparator label="Auto" count={autoZone.length} />}
            {autoZone.map((o, idx) => (
              <OfferRow 
                key={o.slug}
                offer={o}
                position={pinZone.length + idx + 1}
                zone="auto"
                onToggleActive={() => updateOffer(o.slug, o.docId, { is_active: !o.isActive })}
                onSavePin={(val) => updateOffer(o.slug, o.docId, { manual_pin: val })}
              />
            ))}

            {defaultZone.length > 0 && (
              <ZoneSeparator label="Default" count={defaultZone.length} />
            )}
            {defaultZone.map((o, idx) => (
              <OfferRow 
                key={o.slug}
                offer={o}
                position={pinZone.length + autoZone.length + idx + 1}
                zone="default"
                onToggleActive={() => updateOffer(o.slug, o.docId, { is_active: !o.isActive })}
                onSavePin={(val) => updateOffer(o.slug, o.docId, { manual_pin: val })}
              />
            ))}

            {/* Hidden */}
            {inactiveZone.length > 0 && (
              <ZoneSeparator label="Скрытые" count={inactiveZone.length} muted />
            )}
            {inactiveZone.map((o, idx) => (
              <OfferRow 
                key={o.slug}
                offer={o}
                position={pinZone.length + autoZone.length + defaultZone.length + idx + 1}
                zone="hidden"
                onToggleActive={() => updateOffer(o.slug, o.docId, { is_active: !o.isActive })}
                onSavePin={(val) => updateOffer(o.slug, o.docId, { manual_pin: val })}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ZoneSeparator({ 
  label, 
  count, 
  icon, 
  muted 
}: { 
  label: string; 
  count: number; 
  icon?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <tr className="bg-[#fafafa] border-y border-[#eaeaea]">
      <td colSpan={5} className="px-5 py-2">
        <div className="flex items-center gap-2">
          {icon && <span className="text-[#666]">{icon}</span>}
          <span className={`text-[11px] font-medium uppercase tracking-wider 
                            ${muted ? 'text-[#999]' : 'text-[#666]'}`}>
            {label}
          </span>
          <span className="text-[11px] text-[#999] tabular-nums">
            · {count}
          </span>
        </div>
      </td>
    </tr>
  );
}

function OfferRow({ 
  offer, 
  position,
  zone,
  onToggleActive, 
  onSavePin 
}: { 
  offer: Offer; 
  position: number;
  zone: 'pin' | 'auto' | 'default' | 'hidden';
  onToggleActive: () => void;
  onSavePin: (val: number | null) => void;
}) {
  const isHidden = zone === 'hidden';
  
  return (
    <tr className="border-b border-[#eaeaea] last:border-b-0 hover:bg-[#fafafa] transition-colors">
      {/* Витрина */}
      <td className="px-5 py-3">
        <span className={`text-sm tabular-nums font-medium 
                          ${isHidden ? 'text-[#999]' : 'text-black'}`}>
          #{position}
        </span>
      </td>
      
      {/* Оффер */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium 
                            ${isHidden ? 'text-[#999]' : 'text-black'}`}>
            {offer.displayName}
          </span>
          {offer.hasSlug ? (
            <span className="text-xs text-[#999]">
              {offer.slug}
            </span>
          ) : (
            <span className="text-[10px] text-[#999] uppercase tracking-wider 
                             border border-[#eaeaea] rounded px-1.5 py-0.5">
              no slug
            </span>
          )}
        </div>
      </td>
      
      {/* Статус — pill toggle */}
      <td className="px-5 py-3 text-center">
        <button 
          onClick={onToggleActive}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md 
                      text-xs font-medium transition-colors border
                      ${offer.isActive 
                        ? 'border-[#eaeaea] text-black hover:bg-[#fafafa]' 
                        : 'border-[#eaeaea] text-[#999] hover:bg-[#fafafa]'
                      }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full 
                            ${offer.isActive ? 'bg-[#0070f3]' : 'bg-[#999]'}`} />
          {offer.isActive ? 'Активен' : 'Скрыт'}
        </button>
      </td>
      
      {/* Manual PIN */}
      <td className="px-5 py-3 text-center">
        <PinEditor 
          initialValue={offer.manualPin}
          onSave={onSavePin}
        />
      </td>
      
      {/* EPC */}
      <td className="px-5 py-3 text-right">
        {offer.epc > 0 ? (
          <span className={`text-sm font-medium tabular-nums 
                            ${isHidden ? 'text-[#999]' : 'text-black'}`}>
            {offer.epc.toFixed(2)}
          </span>
        ) : (
          <span className="text-sm text-[#999]">—</span>
        )}
      </td>
    </tr>
  );
}

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
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValue(initialValue === null || initialValue === undefined ? '' : String(initialValue));
    setDirty(false);
  }, [initialValue]);

  const handleSave = () => {
    const num = value === '' ? null : parseInt(value);
    const clean = (num === null || num === 0 || isNaN(num)) ? null : num;
    onSave(clean);
    setDirty(false);
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
          setDirty(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && dirty) handleSave();
        }}
        className="w-12 px-2 py-1 text-center text-sm rounded-md border 
                   border-[#eaeaea] text-black focus:outline-none 
                   focus:border-black transition-colors tabular-nums"
      />
      {dirty && (
        <button 
          onClick={handleSave}
          className="px-2 py-1 text-xs font-medium bg-black text-white 
                     rounded-md hover:bg-[#333] transition-colors"
        >
          ✓
        </button>
      )}
    </div>
  );
}

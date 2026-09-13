import React, { useState, useMemo } from 'react';
import { ShiftFormState, ShiftFormAction } from '../shiftFormReducer';
import { 
  Layers, 
  Plus, 
  Trash2, 
  Minus, 
  Package, 
  Percent,
  Receipt,
  Car
} from 'lucide-react';
import { formatCurrency, calculateConsumableItemBilledPrice } from '../../../services/pricingEngine';
import { 
  STANDARD_CONSUMABLES_CATALOG, 
  CONSUMABLE_CATEGORIES, 
  CatalogTemplateItem 
} from '../../../services/consumablesCatalog';
import { ConsumableCategory, ConsumableItem } from '../../../types';
import { triggerHaptic } from '../../../utils/haptics';

const COMMON_NON_MATERIAL_EXTRAS = [
  { description: 'Parkovné na stavbě', amount: 250 },
  { description: 'Vjezdový poplatek / dálniční známka', amount: 150 },
  { description: 'Poplatek za zábor / lešení', amount: 500 },
  { description: 'Manipulační poplatek stavba', amount: 300 }
];

const MARKUP_PRESETS = [0, 10, 15, 20];
const OVERHEAD_FEE_PRESETS = [0, 100, 150, 200, 250];

interface ExtrasSectionProps {
  state: ShiftFormState;
  dispatch: React.Dispatch<ShiftFormAction>;
  extrasTotal: number;
}

export const ExtrasSection = React.memo<ExtrasSectionProps>(function ExtrasSection({ 
  state, 
  dispatch, 
  extrasTotal 
}) {
  const [activeCategory, setActiveCategory] = useState<ConsumableCategory>('cutting_grinding');
  
  // Custom consumable item form state
  const [customName, setCustomName] = useState<string>('');
  const [customQty, setCustomQty] = useState<number>(1);
  const [customUnit, setCustomUnit] = useState<string>('ks');
  const [customUnitPrice, setCustomUnitPrice] = useState<number>(100);

  const currentSlip = state.consumableSlip;
  const currentMarkup = currentSlip?.overheadMarkupPercent ?? 15;
  const currentFixedFee = currentSlip?.fixedOverheadFee ?? 0;
  const slipItems = currentSlip?.items ?? [];

  // Filter catalog items by selected category
  const filteredCatalogItems = useMemo(() => {
    return STANDARD_CONSUMABLES_CATALOG.filter(item => item.category === activeCategory);
  }, [activeCategory]);

  const handleAddCatalogItem = (template: CatalogTemplateItem) => {
    triggerHaptic('selection');
    const billedPrice = calculateConsumableItemBilledPrice(1, template.unitPrice, currentMarkup);
    const item: ConsumableItem = {
      id: `cons-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      category: template.category,
      name: template.name,
      quantity: 1,
      unit: template.unit,
      unitPrice: template.unitPrice,
      markupPercent: currentMarkup,
      billedPrice,
    };
    dispatch({ type: 'ADD_CONSUMABLE_ITEM', item });
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    triggerHaptic('selection');

    const qty = Math.max(1, Number(customQty) || 1);
    const price = Math.max(0, Number(customUnitPrice) || 0);
    const billedPrice = calculateConsumableItemBilledPrice(qty, price, currentMarkup);

    const item: ConsumableItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      category: 'custom',
      name: customName.trim(),
      quantity: qty,
      unit: customUnit.trim() || 'ks',
      unitPrice: price,
      markupPercent: currentMarkup,
      billedPrice,
    };

    dispatch({ type: 'ADD_CONSUMABLE_ITEM', item });
    setCustomName('');
    setCustomQty(1);
    setCustomUnitPrice(100);
  };

  const handleAddOtherExtra = (desc: string, amount: number) => {
    if (!desc.trim() || amount <= 0) return;
    triggerHaptic('light');
    dispatch({
      type: 'ADD_EXTRA',
      item: {
        id: `extra-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        description: desc.trim(),
        amount: Math.round(amount)
      }
    });
  };

  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-4">
      {/* 1. Header with live materials badge */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-amber-400" />
          Materiálový lístek & montážní komponenty
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Účtováno celkem:</span>
          <span className="text-sm font-black text-amber-400 font-mono">
            {formatCurrency(currentSlip?.totalBilledAmount || 0)}
          </span>
        </div>
      </div>

      {/* 2. Markup % selector pills & Fixed overhead fee (Glove-friendly) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
        {/* Marže na materiál */}
        <div>
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
            <Percent className="w-3.5 h-3.5 text-amber-400" />
            Marže na materiál:
          </span>
          <div className="flex items-center gap-1.5">
            {MARKUP_PRESETS.map((pct) => {
              const isSelected = currentMarkup === pct;
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    dispatch({ type: 'SET_CONSUMABLE_MARKUP', markupPercent: pct });
                  }}
                  className={`min-h-[44px] flex-1 py-2 rounded-xl text-xs font-bold transition-all border active:scale-95 ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-sm'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  +{pct} %
                </button>
              );
            })}
          </div>
        </div>

        {/* Režijní / manipulační paušál */}
        <div>
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
            <Receipt className="w-3.5 h-3.5 text-amber-400" />
            Závozový / manipulační paušál:
          </span>
          <div className="flex items-center gap-1.5">
            {OVERHEAD_FEE_PRESETS.map((fee) => {
              const isSelected = currentFixedFee === fee;
              return (
                <button
                  key={fee}
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    dispatch({ type: 'SET_CONSUMABLE_FIXED_FEE', fee });
                  }}
                  className={`min-h-[44px] flex-1 py-2 rounded-xl text-xs font-bold transition-all border active:scale-95 ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-sm'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {fee === 0 ? '0 Kč' : `${fee}`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Category Selector Tabs (Glove-Friendly Touch Targets) */}
      <div>
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
          Kategorie spotřebního materiálu:
        </span>
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-6 gap-1.5">
          {CONSUMABLE_CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setActiveCategory(cat.key);
                }}
                className={`min-h-[44px] p-2 rounded-xl border text-[11px] font-bold transition-all text-center flex flex-col justify-center items-center active:scale-95 ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Quick Catalog Item Picker */}
      {activeCategory !== 'custom' ? (
        <div className="space-y-1.5">
          <span className="text-[11px] text-slate-400 block">
            Rychlý výběr položek (kliknutím přidáte 1 ks do lístku):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredCatalogItems.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAddCatalogItem(item)}
                className="min-h-[48px] px-3 py-2 bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/50 rounded-xl text-left flex items-center justify-between gap-2 active:scale-95 transition-all text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-200 truncate">{item.name}</div>
                  <div className="text-[11px] text-slate-400">
                    Základ: <strong className="text-slate-300">{item.unitPrice} Kč / {item.unit}</strong>
                    {currentMarkup > 0 && (
                      <span className="text-amber-400 ml-1">
                        → {calculateConsumableItemBilledPrice(1, item.unitPrice, currentMarkup)} Kč
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 font-black">
                  <Plus className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Custom Item Adder Form */
        <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2.5">
          <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />
            Přidat vlastní nestandardní materiál / komponent ze stavby
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="sm:col-span-2">
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Název položky</label>
              <input
                type="text"
                placeholder="např. Speciální nerezová průchodka M20"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="min-h-[44px] w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Množství & Jednotka</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  min={1}
                  value={customQty}
                  onChange={(e) => setCustomQty(Math.max(1, Number(e.target.value) || 1))}
                  className="min-h-[44px] w-16 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white font-mono text-center"
                />
                <input
                  type="text"
                  placeholder="ks / m / kg"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  className="min-h-[44px] flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white text-center"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Nákupní cena Kč/{customUnit}</label>
              <input
                type="number"
                min={0}
                value={customUnitPrice}
                onChange={(e) => setCustomUnitPrice(Math.max(0, Number(e.target.value) || 0))}
                className="min-h-[44px] w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddCustomItem}
            className="min-h-[44px] w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Přidat položku do materiálového lístku
          </button>
        </div>
      )}

      {/* 5. Active Consumables Slip Items List with Stepper */}
      {slipItems.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <span className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>Rozpis položek na materiálovém lístku ({slipItems.length}):</span>
            <span className="text-[11px] text-slate-400 font-normal">Tlačítky +/- upravíte množství</span>
          </span>

          <div className="space-y-1.5">
            {slipItems.map((item) => (
              <div 
                key={item.id} 
                className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold text-slate-200">{item.name}</div>
                  <div className="text-[11px] text-slate-400">
                    Základ: {item.unitPrice} Kč/{item.unit}
                    {item.markupPercent !== undefined && ` (+${item.markupPercent}% marže)`}
                  </div>
                </div>

                {/* Quantity Stepper (Glove-Friendly Touch Targets) */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      dispatch({
                        type: 'UPDATE_CONSUMABLE_ITEM_QTY',
                        id: item.id,
                        quantity: item.quantity - 1
                      });
                    }}
                    className="min-w-[38px] min-h-[38px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center active:scale-90 transition-all"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <span className="w-10 text-center font-mono font-bold text-white text-sm">
                    {item.quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      dispatch({
                        type: 'UPDATE_CONSUMABLE_ITEM_QTY',
                        id: item.id,
                        quantity: item.quantity + 1
                      });
                    }}
                    className="min-w-[38px] min-h-[38px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center active:scale-90 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] text-slate-400 min-w-[20px]">{item.unit}</span>
                </div>

                {/* Billed Price & Delete Button */}
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-amber-400 text-sm min-w-[80px] text-right">
                    {formatCurrency(item.billedPrice)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('warning');
                      dispatch({ type: 'REMOVE_CONSUMABLE_ITEM', id: item.id });
                    }}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg"
                    title="Odebrat položku"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 6. Real-Time Slip Cost Summary Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-slate-950/80 rounded-xl border border-amber-500/20 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Nákup materiál:</span>
              <span className="font-mono font-semibold text-slate-300">
                {formatCurrency(currentSlip?.totalMaterialCost || 0)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Marže na lístku:</span>
              <span className="font-mono font-semibold text-amber-400">
                +{currentMarkup} %
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Závoz / Paušál:</span>
              <span className="font-mono font-semibold text-slate-300">
                {formatCurrency(currentFixedFee)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Účtováno celkem:</span>
              <span className="font-mono font-black text-amber-400 text-sm">
                {formatCurrency(currentSlip?.totalBilledAmount || 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 7. Miscellaneous Extra Costs (Parking, Permits, Tolls) */}
      <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5 text-amber-400" />
            Ostatní poplatky & vedlejší náklady (parkovné, povolení)
          </label>
          <span className="text-xs font-mono font-bold text-slate-300">
            {formatCurrency(extrasTotal)}
          </span>
        </div>

        {/* Quick pills */}
        <div className="flex flex-wrap gap-1.5">
          {COMMON_NON_MATERIAL_EXTRAS.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAddOtherExtra(c.description, c.amount)}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 active:scale-95"
            >
              <Plus className="w-3 h-3 text-amber-400" />
              {c.description} ({c.amount} Kč)
            </button>
          ))}
        </div>

        {/* Other costs list */}
        {state.extraCosts.length > 0 && (
          <div className="space-y-1 pt-1">
            {state.extraCosts.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs"
              >
                <span className="font-medium text-slate-200 flex-1">{item.description}</span>
                <span className="font-mono font-bold text-amber-400">{formatCurrency(item.amount)}</span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'REMOVE_EXTRA', id: item.id })}
                  className="p-1 text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

import React, { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, Check, Settings2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getPeriodLabel } from "../utils/formatters";
import { PeriodSelection, PeriodType } from "../types";

interface PeriodSelectorProps {
  selectedPeriod: PeriodSelection;
  availableMonths: { key: string; label: string; pureLabel: string; count: number }[];
  onSelect: (period: PeriodSelection) => void;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  selectedPeriod,
  availableMonths,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(selectedPeriod.startDate || "");
  const [customEnd, setCustomEnd] = useState(selectedPeriod.endDate || "");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustom(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectType = (type: PeriodType, monthKey?: string) => {
    if (type === "custom") {
      setShowCustom(true);
      return;
    }
    onSelect({ type, monthKey });
    setIsOpen(false);
  };

  const applyCustomRange = () => {
    if (customStart && customEnd) {
      onSelect({
        type: "custom",
        startDate: customStart,
        endDate: customEnd
      });
      setIsOpen(false);
      setShowCustom(false);
    }
  };

  const presetPeriods: { type: PeriodType; label: string }[] = [
    { type: "current_month", label: "Mois en cours" },
    { type: "last_month", label: "Mois dernier" },
    { type: "this_year", label: "Cette année" },
    { type: "all", label: "Toute la période" },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 hover:bg-neutral-800 transition-all cursor-pointer group"
      >
        <Calendar className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
        <span className="text-[11px] sm:text-xs font-bold text-neutral-100 whitespace-nowrap">
          {getPeriodLabel(selectedPeriod)}
        </span>
        <ChevronDown className={`w-3 h-3 text-neutral-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-64 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-50 overflow-hidden"
          >
            {!showCustom ? (
              <div className="py-1.5">
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                  Raccourcis
                </div>
                {presetPeriods.map((period) => {
                  const isSelected = selectedPeriod.type === period.type;
                  return (
                    <button
                      key={period.type}
                      onClick={() => handleSelectType(period.type)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:bg-neutral-800 ${
                        isSelected ? "bg-emerald-500/10" : ""
                      }`}
                    >
                      <span className={`text-xs font-bold ${isSelected ? "text-emerald-400" : "text-neutral-200"}`}>
                        {period.label}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  );
                })}

                <div className="border-t border-neutral-800 my-1.5" />
                
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                  Archives mensuelles
                </div>
                <div className="max-h-40 overflow-y-auto custom-scrollbar">
                  {availableMonths.filter(m => m.key !== 'all').map((month) => {
                    const isSelected = selectedPeriod.type === "month" && selectedPeriod.monthKey === month.key;
                    return (
                      <button
                        key={month.key}
                        onClick={() => handleSelectType("month", month.key)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:bg-neutral-800 ${
                          isSelected ? "bg-emerald-500/10" : ""
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold ${isSelected ? "text-emerald-400" : "text-neutral-200"}`}>
                            {month.pureLabel}
                          </span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-neutral-800 my-1.5" />

                <button
                  onClick={() => setShowCustom(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-neutral-300 hover:bg-neutral-800 transition-colors"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Personnaliser les dates...
                </button>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <button 
                    onClick={() => setShowCustom(false)}
                    className="text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    <ChevronDown className="w-4 h-4 rotate-90" />
                  </button>
                  <span className="text-xs font-bold text-neutral-100">Dates personnalisées</span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">Du</label>
                    <input 
                      type="date" 
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">Au</label>
                    <input 
                      type="date" 
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                <button
                  onClick={applyCustomRange}
                  disabled={!customStart || !customEnd}
                  className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-neutral-950 font-bold text-xs transition-all cursor-pointer"
                >
                  Appliquer
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

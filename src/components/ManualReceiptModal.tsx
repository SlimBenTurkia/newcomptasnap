import React, { useState } from "react";
import { ReceiptItem, ReceiptCategory, PaymentMethod, TransactionType } from "../types";
import { X, Save, Calendar, Tag, CreditCard, AlignLeft, Euro } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ManualReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (receipt: ReceiptItem) => void;
  defaultDate?: string;
}

const CATEGORIES: ReceiptCategory[] = [
  "Restaurant", "Transport", "Hébergement", "Logiciel", "Matériel", 
  "Télécom", "Fournitures", "Honoraires", "Marketing", "Frais bancaires", 
  "Formation", "Autre"
];

const VAT_RATES = [0, 2.1, 5.5, 10, 20];

export const ManualReceiptModal: React.FC<ManualReceiptModalProps> = ({
  isOpen,
  onClose,
  onSave,
  defaultDate = new Date().toISOString().split("T")[0],
}) => {
  const [formData, setFormData] = useState({
    transactionType: "expense" as TransactionType,
    supplier: "",
    date: defaultDate,
    totalTTC: "",
    vatRate: "20",
    category: "Autre" as ReceiptCategory,
    paymentMethod: "Carte Bancaire",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(formData.totalTTC);
    const rate = parseFloat(formData.vatRate);
    const vatAmount = amount - (amount / (1 + rate / 100));

    const newReceipt: ReceiptItem = {
      id: `manual_${Date.now()}`,
      transactionType: formData.transactionType,
      supplier: formData.supplier || (formData.transactionType === "income" ? "Client Inconnu" : "Fournisseur Inconnu"),
      date: formData.date,
      totalTTC: amount || 0,
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      vatRate: rate,
      category: formData.category,
      paymentMethod: formData.paymentMethod as PaymentMethod,
      notes: formData.notes,
      status: "en_attente",
      taxDeductibility: "deductible",
      expenseType: formData.category,
      accountingCode: formData.transactionType === "income" ? "706000" : "606400",
      standardizedName: `Saisie_Manuelle_${formData.supplier}_${formData.date}.pdf`,
      fileName: "Saisie Manuelle",
      fileType: "pdf",
      source: "upload",
      aiExtracted: false,
      createdAt: new Date().toISOString(),
    };

    onSave(newReceipt);
    onClose();
    // Reset form
    setFormData({
      transactionType: "expense",
      supplier: "",
      date: defaultDate,
      totalTTC: "",
      vatRate: "20",
      category: "Autre",
      paymentMethod: "Carte Bancaire",
      notes: "",
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-neutral-100">Saisie Manuelle</h2>
                  <p className="text-xs text-neutral-500">Ajouter un justificatif sans document</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-neutral-800 text-neutral-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Transaction Type Toggle */}
              <div className="flex p-1 bg-neutral-950 border border-neutral-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, transactionType: "expense"})}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                    formData.transactionType === "expense"
                      ? "bg-neutral-800 text-neutral-100 shadow-lg"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  DÉPENSE
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, transactionType: "income"})}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                    formData.transactionType === "income"
                      ? "bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/10"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  REVENU / FACTURE
                </button>
              </div>

              <div className="space-y-4">
                {/* Supplier */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                    {formData.transactionType === "income" ? "Nom du Client" : "Nom du Fournisseur"}
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      value={formData.supplier}
                      onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                      placeholder="Ex: Amazon, Apple, Taxi G7..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Date */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <input
                        required
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-emerald-500/50 transition-all"
                      />
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Montant TTC</label>
                    <div className="relative">
                      <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <input
                        required
                        type="number"
                        step="0.01"
                        value={formData.totalTTC}
                        onChange={(e) => setFormData({...formData, totalTTC: e.target.value})}
                        placeholder="0.00"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-100 font-mono focus:outline-none focus:border-emerald-500/50 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* VAT Rate */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Taux TVA (%)</label>
                    <select
                      value={formData.vatRate}
                      onChange={(e) => setFormData({...formData, vatRate: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-emerald-500/50 transition-all"
                    >
                      {VAT_RATES.map(rate => (
                        <option key={rate} value={rate}>{rate}%</option>
                      ))}
                    </select>
                  </div>

                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Catégorie</label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value as ReceiptCategory})}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-100 appearance-none focus:outline-none focus:border-emerald-500/50 transition-all"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Moyen de Paiement</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-100 appearance-none focus:outline-none focus:border-emerald-500/50 transition-all"
                    >
                      <option value="Carte Bancaire">Carte Bancaire</option>
                      <option value="Espèces">Espèces</option>
                      <option value="Virement">Virement</option>
                      <option value="Prélèvement">Prélèvement</option>
                      <option value="Apple Pay">Apple Pay</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Notes / Description (Optionnel)</label>
                  <div className="relative">
                    <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-neutral-500 pointer-events-none" />
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      placeholder="Détails de la dépense..."
                      rows={2}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 transition-all active:scale-[0.98]"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer le justificatif</span>
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

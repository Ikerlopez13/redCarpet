import React from 'react';
import clsx from 'clsx';
import { X, Check, XCircle } from 'lucide-react';

interface AlertModalProps {
  type: string;
  onConfirm: () => void;
  onDismiss: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

const AlertModal: React.FC<AlertModalProps> = ({ type, onConfirm, onDismiss, onCancel, isOpen }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50">
      <div className="bg-zinc-900/90 rounded-2xl p-6 w-80 text-center border border-primary/30 shadow-xl animate-fade-in">
        <h2 className="text-xl font-bold mb-4 text-white">Alerta: {type}</h2>
        <p className="text-sm text-white/70 mb-6">¿Deseas confirmar esta alerta?</p>
        <div className="flex justify-between gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-1 bg-primary text-white py-2 rounded-lg hover:bg-primary/80 transition"
          >
            <Check size={16} /> Confirmar
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 flex items-center justify-center gap-1 bg-zinc-700 text-white py-2 rounded-lg hover:bg-zinc-600 transition"
          >
            <X size={16} /> Desestimar
          </button>
        </div>
        <button
          onClick={onCancel}
          className="mt-4 text-xs text-white/50 hover:text-white transition"
        >
          Cancelar alerta
        </button>
        <button
          onClick={onCancel}
          className="absolute top-2 right-2 text-white/40 hover:text-white"
          aria-label="Cerrar Modal"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default AlertModal;

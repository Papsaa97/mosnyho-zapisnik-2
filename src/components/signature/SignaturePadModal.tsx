import React, { useState, useRef, useEffect } from 'react';
import { 
  PenTool, 
  RotateCcw, 
  RotateCw, 
  Trash2, 
  Check, 
  X, 
  UserCheck 
} from 'lucide-react';
import { SignaturePad, SignaturePadHandle } from './SignaturePad';
import { ProtocolSignature, SignatureRole } from '../../types';
import { useToast } from '../../utils/toast';
import { triggerHaptic } from '../../utils/haptics';
export { DualSignatureProtocol } from './dualSignatureProtocol';

export interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signature: ProtocolSignature) => void;
  role: SignatureRole;
  defaultSignerName?: string;
  existingSignature?: ProtocolSignature;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  isOpen,
  onClose,
  onSave,
  role,
  defaultSignerName = '',
  existingSignature,
}) => {
  const { showToast } = useToast();
  const padRef = useRef<SignaturePadHandle | null>(null);

  const [signerName, setSignerName] = useState<string>('');
  const [hasStrokes, setHasStrokes] = useState<boolean>(false);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  // Sync initial state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSignerName(existingSignature?.signerName || defaultSignerName || '');
      setHasStrokes(false);
      setCanUndo(false);
      setCanRedo(false);
      // Give DOM time to mount canvas then clear
      setTimeout(() => {
        padRef.current?.clear();
      }, 50);
    }
  }, [isOpen, existingSignature, defaultSignerName]);

  if (!isOpen) return null;

  const roleTitle = role === 'contractor' 
    ? 'Podpis zhotovitele (Montér / Svářeč)' 
    : 'Podpis objednatele (Stavbyvedoucí / TDI)';

  const roleSubtitle = role === 'contractor'
    ? 'Stvrzení provedení montážních a svářečských prací'
    : 'Ověření a převzetí dokončeného díla / protokolu';

  const handleStrokeChange = (hasAny: boolean) => {
    setHasStrokes(hasAny);
    setCanUndo(padRef.current?.canUndo() || false);
    setCanRedo(padRef.current?.canRedo() || false);
  };

  const handleUndo = () => {
    triggerHaptic('light');
    padRef.current?.undo();
    setCanUndo(padRef.current?.canUndo() || false);
    setCanRedo(padRef.current?.canRedo() || false);
    setHasStrokes(!padRef.current?.isEmpty());
  };

  const handleRedo = () => {
    triggerHaptic('light');
    padRef.current?.redo();
    setCanUndo(padRef.current?.canUndo() || false);
    setCanRedo(padRef.current?.canRedo() || false);
    setHasStrokes(!padRef.current?.isEmpty());
  };

  const handleClear = () => {
    triggerHaptic('medium');
    padRef.current?.clear();
    setCanUndo(false);
    setCanRedo(false);
    setHasStrokes(false);
  };

  const handleConfirm = () => {
    const trimmedName = signerName.trim();
    if (!trimmedName) {
      triggerHaptic('error');
      showToast('Prosím zadejte jméno podepisující osoby.', 'warning');
      return;
    }

    const trimmedDataUrl = padRef.current?.getTrimmedDataUrl(8, 0);
    if (!trimmedDataUrl || padRef.current?.isEmpty()) {
      triggerHaptic('error');
      showToast('Prosím podepište se před potvrzením.', 'warning');
      return;
    }

    const signature: ProtocolSignature = {
      role,
      signerName: trimmedName,
      dataUrl: trimmedDataUrl,
      signedAt: new Date().toISOString(),
    };

    triggerHaptic('success');
    onSave(signature);
    showToast(`Podpis byl úspěšně zaznamenán ✓`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${
              role === 'contractor' 
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            }`}>
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h2 id="signature-modal-title" className="text-base font-bold text-white leading-tight">
                {roleTitle}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {roleSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Zavřít"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Signer Name Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              Jméno a příjmení podepisujícího *
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder={role === 'contractor' ? 'např. Jan Novák (Montér)' : 'např. Ing. Karel Dvořák (TDI)'}
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all font-medium"
            />
          </div>

          {/* Canvas Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Podepište se prstem nebo stylusem na displej:</span>
              <span className="text-[11px] font-mono text-slate-500">Dotykové plátno</span>
            </div>

            <div className="relative bg-white rounded-xl border-2 border-slate-600 shadow-inner overflow-hidden w-full flex items-center justify-center min-h-[200px]">
              {/* Subtle signature guideline */}
              <div className="absolute left-6 right-6 bottom-10 border-b border-dashed border-slate-300 pointer-events-none flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono select-none">Podpisová linka</span>
                <span className="text-[10px] text-slate-300 font-mono select-none">✕</span>
              </div>

              <SignaturePad
                ref={padRef}
                width={520}
                height={210}
                strokeColor="#0f172a"
                strokeWidth={2.8}
                onStrokeChange={handleStrokeChange}
                className="w-full h-full"
              />
            </div>

            {/* Drawing controls */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  title="Vrátit poslední tah"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Zpět</span>
                </button>

                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  title="Opakovat tah"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Vpřed</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleClear}
                disabled={!hasStrokes}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/50 text-rose-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                title="Vymazat celý podpis"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vymazat</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Potvrdit podpis</span>
          </button>
        </div>
      </div>
    </div>
  );
};

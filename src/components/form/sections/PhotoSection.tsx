import React, { useRef, useState, useCallback } from 'react';
import { Camera, ImagePlus, Trash2, Maximize2, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { ShiftFormState, ShiftFormAction } from '../shiftFormReducer';
import { EntryPhoto } from '../../../types';
import { validateImageFile, processFieldPhoto, MAX_PHOTO_BYTES } from '../../../services/imageCompressionService';
import { useToast } from '../../../utils/toast';
import { triggerHaptic } from '../../../utils/haptics';

interface PhotoSectionProps {
  state: ShiftFormState;
  dispatch: React.Dispatch<ShiftFormAction>;
  contractorName?: string;
}

export const PhotoSection: React.FC<PhotoSectionProps> = ({
  state,
  dispatch,
  contractorName = ''
}) => {
  const { showToast } = useToast();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [previewPhoto, setPreviewPhoto] = useState<EntryPhoto | null>(null);

  const handleFilesSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const fileList = Array.from(files);
    setIsProcessing(true);

    try {
      let addedCount = 0;
      for (const file of fileList) {
        const validation = validateImageFile(file);
        if (!validation.valid) {
          showToast(validation.error || 'Neplatný soubor obrázku', 'error');
          continue;
        }

        const result = await processFieldPhoto({
          file,
          projectCode: state.projectCode || 'Zakázka',
          projectName: state.projectName || 'Montážní práce',
          welderName: contractorName,
          caption: '',
        });

        const newPhoto: EntryPhoto = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          entryId: '',
          createdAt: new Date().toISOString(),
          caption: '',
          dataUrl: result.fullDataUrl,
          thumbnailUrl: result.thumbnailDataUrl,
          sizeBytes: result.sizeBytes,
          width: result.width,
          height: result.height,
        };

        dispatch({ type: 'ADD_PHOTO', photo: newPhoto });
        addedCount++;
      }

      if (addedCount > 0) {
        triggerHaptic('success');
        showToast(`Přidáno ${addedCount} fotografií (zkomprimováno pod 500 KB) ✓`, 'success');
      }
    } catch (err) {
      console.error('Error processing photo:', err);
      showToast('Chyba při zpracování fotografie', 'error');
      triggerHaptic('error');
    } finally {
      setIsProcessing(false);
      // Reset input value so identical file can be picked again
      e.target.value = '';
    }
  }, [state.projectCode, state.projectName, contractorName, dispatch, showToast]);

  const photos = state.photos || [];

  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-4">
      {/* Hidden File Inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFilesSelected}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-amber-400" />
          Terénní fotodokumentace svarů a montáže
        </label>
        <span className="text-[11px] text-slate-400 font-mono">
          {photos.length} {photos.length === 1 ? 'snímek' : photos.length >= 2 && photos.length <= 4 ? 'snímky' : 'snímků'}
        </span>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Automatická offline komprese pod 500 KB a vypálení časového i projektového vodoznaku přímo na zařízení.
      </p>

      {/* Dual Action Buttons (Glove-Friendly, min 48px height) */}
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            cameraInputRef.current?.click();
          }}
          disabled={isProcessing}
          className="min-h-[48px] px-4 py-3 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border border-amber-500/40 hover:border-amber-400 text-amber-300 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm disabled:opacity-50"
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          ) : (
            <Camera className="w-5 h-5 text-amber-400" />
          )}
          <span>Vyfotit svar</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            galleryInputRef.current?.click();
          }}
          disabled={isProcessing}
          className="min-h-[48px] px-4 py-3 bg-slate-850 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          ) : (
            <ImagePlus className="w-5 h-5 text-slate-400" />
          )}
          <span>Vybrat z galerie</span>
        </button>
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3 text-xs text-amber-300 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400 flex-shrink-0" />
          <span>Optimalizuji snímek, vytvářím miniaturu a razítkuji vodoznak...</span>
        </div>
      )}

      {/* Photo Grid / Cards */}
      {photos.length > 0 && (
        <div className="space-y-3 pt-2">
          {photos.map((photo, index) => {
            const sizeKb = Math.round(photo.sizeBytes / 1024);
            const isUnderLimit = photo.sizeBytes < MAX_PHOTO_BYTES;

            return (
              <div
                key={photo.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between"
              >
                {/* Thumbnail Miniature + Enlarge trigger */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative group flex-shrink-0 cursor-pointer" onClick={() => setPreviewPhoto(photo)}>
                    <img
                      src={photo.thumbnailUrl}
                      alt={photo.caption || `Fotodokumentace ${index + 1}`}
                      className="w-20 h-14 object-cover rounded-lg border border-slate-700 group-hover:border-amber-400 transition-colors"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                      <Maximize2 className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  {/* Caption Input */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={photo.caption || ''}
                      onChange={(e) => dispatch({ type: 'UPDATE_PHOTO_CAPTION', id: photo.id, caption: e.target.value })}
                      placeholder="Popis snímku (např. TIG kořen svaru č. 3)..."
                      className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
                    />
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 font-mono">
                      <span className={`px-1.5 py-0.5 rounded font-bold ${isUnderLimit ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'}`}>
                        {sizeKb} KB
                      </span>
                      <span>•</span>
                      <span>{photo.width} × {photo.height}</span>
                      <span>•</span>
                      <span>{new Date(photo.createdAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                {/* Actions: View & Remove */}
                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(photo)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Zvětšit s vodoznakem"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('warning');
                      dispatch({ type: 'REMOVE_PHOTO', id: photo.id });
                    }}
                    className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                    title="Odstranit fotku"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enlarged Photo Modal Preview */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Detail fotodokumentace s vodoznakem
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image Preview */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/60">
              <img
                src={previewPhoto.dataUrl}
                alt={previewPhoto.caption || 'Zvětšená fotografie'}
                className="max-h-[70vh] w-auto object-contain rounded-lg border border-slate-800 shadow-lg"
              />
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-200">
                {previewPhoto.caption || 'Bez popisu'}
              </span>
              <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                <span>{previewPhoto.width} × {previewPhoto.height} px</span>
                <span>•</span>
                <span>{Math.round(previewPhoto.sizeBytes / 1024)} KB</span>
                <span>•</span>
                <span>{new Date(previewPhoto.createdAt).toLocaleString('cs-CZ')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

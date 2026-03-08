'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * Modal konfirmasi dengan opsi verifikasi PIN.
 *
 * @param {Object}   props
 * @param {boolean}  props.open          - Tampilkan/sembunyikan modal
 * @param {Function} props.onClose       - Callback tutup modal
 * @param {Function} props.onConfirm     - Callback konfirmasi (menerima PIN jika requirePin=true)
 * @param {string}   [props.title]       - Judul dialog
 * @param {string}   [props.message]     - Pesan / isi dialog
 * @param {string}   [props.confirmText] - Label tombol konfirmasi
 * @param {string}   [props.cancelText]  - Label tombol batal
 * @param {string}   [props.variant]     - 'danger' | 'warning' | 'info'
 * @param {boolean}  [props.requirePin]  - Apakah perlu input PIN
 * @param {boolean}  [props.loading]     - Tampilkan loading state
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Konfirmasi',
  message = 'Apakah Anda yakin ingin melanjutkan?',
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  variant = 'danger',
  requirePin = false,
  loading = false,
}) {
  const [pin, setPin] = useState('');
  const pinRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPin('');
      if (requirePin) {
        setTimeout(() => pinRef.current?.focus(), 100);
      }
    }
  }, [open, requirePin]);

  if (!open) return null;

  const variantColors = {
    danger:  { bg: 'bg-red-50',    text: 'text-red-700',    btn: 'bg-red-600 hover:bg-red-700',    icon: '🗑️' },
    warning: { bg: 'bg-yellow-50', text: 'text-yellow-700', btn: 'bg-yellow-600 hover:bg-yellow-700', icon: '⚠️' },
    info:    { bg: 'bg-blue-50',   text: 'text-blue-700',   btn: 'bg-blue-600 hover:bg-blue-700',  icon: 'ℹ️' },
  };
  const v = variantColors[variant] || variantColors.danger;

  const handleConfirm = () => {
    if (requirePin && pin.length !== 6) return;
    onConfirm(requirePin ? pin : undefined);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">{v.icon}</span>
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        </div>

        {/* Message */}
        <div className={`p-3 rounded-lg ${v.bg}`}>
          <p className={`text-sm ${v.text}`}>{message}</p>
        </div>

        {/* PIN Input */}
        {requirePin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Masukkan PIN 6 digit
            </label>
            <input
              ref={pinRef}
              type="password"
              maxLength={6}
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="input-field text-center text-xl tracking-[0.5em] font-mono"
              placeholder="••••••"
              disabled={loading}
              autoComplete="off"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn-secondary"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || (requirePin && pin.length !== 6)}
            className={`${v.btn} text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
              </svg>
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

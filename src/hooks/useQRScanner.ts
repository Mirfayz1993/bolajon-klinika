'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * USB QR/Barcode scanner global listener.
 * Scanner klaviatura kabi ishlaydi — tez-tez harflar yozadi va Enter yuboradi.
 * Agar skanerlangan matn /patients/{id} URL bo'lsa, bemor sahifasiga o'tadi.
 */
export function useQRScanner() {
  const router = useRouter();
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const SCANNER_SPEED_MS = 50; // Scanner inson yozishidan tezroq: <50ms oralig'i

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Agar harflar orasidagi vaqt katta bo'lsa — yangi scan boshlanmoqda
      if (timeDiff > 500) {
        bufferRef.current = '';
      }

      if (e.key === 'Enter') {
        const scanned = bufferRef.current.trim();
        bufferRef.current = '';

        if (!scanned) return;

        // /patients/{id} pattern ni tekshiramiz (UUID hyphens ham qo'llab-quvvatlanadi)
        const match = scanned.match(/\/patients\/([a-zA-Z0-9-]+)/);
        if (match) {
          e.preventDefault();
          e.stopPropagation();
          router.push(`/patients/${match[1]}`);
        }
      } else if (e.key.length === 1) {
        // Faqat scanner tezligida kelgan harflarni qabul qilamiz
        if (timeDiff < SCANNER_SPEED_MS || bufferRef.current.length === 0) {
          bufferRef.current += e.key;
        } else {
          // Inson yozishi — buffer tozalanadi
          bufferRef.current = e.key;
        }
      }
    }

    // capture: true — input fieldga yetib bormasdan oldin ushlaydi
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [router]);
}

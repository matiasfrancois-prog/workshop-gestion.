"use client";
import { useEffect, useRef, useState } from "react";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => Detector;
  }
}

/**
 * Campo para cargar IMEI / series:
 *  - Lector de código de barras USB/Bluetooth (escribe + Enter)
 *  - Pegar una lista (uno por línea, o separados por espacio o coma)
 *  - Cámara del celular (Android/Chrome)
 */
export default function Escaner({ onCodigos, placeholder = "Escanear o escribir IMEI y Enter" }: { onCodigos: (c: string[]) => void; placeholder?: string }) {
  const [valor, setValor] = useState("");
  const [camara, setCamara] = useState(false);
  const [soporta, setSoporta] = useState(false);
  useEffect(() => setSoporta(typeof window !== "undefined" && !!window.BarcodeDetector), []);

  function enviar(texto: string) {
    const codigos = texto
      .split(/[\s,;]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (codigos.length) onCodigos(codigos);
    setValor("");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="input h-11 font-mono text-[15px]"
          value={valor}
          placeholder={placeholder}
          autoCapitalize="characters"
          autoCorrect="off"
          onChange={(e) => setValor(e.target.value)}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            if (/[\s,;]/.test(t.trim())) {
              e.preventDefault();
              enviar(t);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              enviar(valor);
            }
          }}
        />
        <button type="button" className="btn-secundario h-11 px-3" onClick={() => enviar(valor)}>
          +
        </button>
        {soporta && (
          <button type="button" className="btn-secundario h-11 px-3" onClick={() => setCamara(true)} aria-label="Escanear con cámara">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" /></svg>
          </button>
        )}
      </div>
      {camara && <Camara onCodigo={(c) => onCodigos([c])} onCerrar={() => setCamara(false)} />}
    </div>
  );
}

function Camara({ onCodigo, onCerrar }: { onCodigo: (c: string) => void; onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [leidos, setLeidos] = useState<string[]>([]);
  const vistos = useRef(new Set<string>());

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const det = new window.BarcodeDetector!({ formats: ["code_128", "ean_13", "code_39", "qr_code", "upc_a", "ean_8"] });
        timer = setInterval(async () => {
          if (!video.current) return;
          const res = await det.detect(video.current).catch(() => []);
          for (const r of res) {
            const c = r.rawValue.trim().toUpperCase();
            if (c && !vistos.current.has(c)) {
              vistos.current.add(c);
              setLeidos((l) => [c, ...l]);
              navigator.vibrate?.(60);
              onCodigo(c);
            }
          }
        }, 350);
      } catch {
        onCerrar();
      }
    })();
    return () => {
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <video ref={video} className="flex-1 object-cover" playsInline muted />
      <div className="bg-white p-4 space-y-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <p className="text-sm text-suave">Leídos: {leidos.length}</p>
        <p className="font-mono text-xs truncate">{leidos.slice(0, 3).join(" · ")}</p>
        <button type="button" className="btn-primario w-full" onClick={onCerrar}>Listo</button>
      </div>
    </div>
  );
}

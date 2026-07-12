import { useState, useEffect } from 'react';
import { Download, Share2, PlusSquare, X } from 'lucide-react';

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Detect iOS
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    // Detect if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

    if (isStandalone) {
      setShow(false);
      return;
    }

    if (isIos) {
      setPlatform('ios');
      // Show prompt after a short delay so user can see landing first
      const dismissed = localStorage.getItem('pwa-dismissed');
      if (!dismissed) {
        setTimeout(() => setShow(true), 3000);
      }
    } else {
      setPlatform('android');
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem('pwa-dismissed');
      if (!dismissed) {
        setTimeout(() => setShow(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-dismissed', 'true');
  };

  if (!show) return null;

  return (
    <div id="pwa-install-prompt" className="fixed bottom-20 left-4 right-4 z-50 bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-fade-in sm:max-w-md sm:mx-auto sm:bottom-6">
      <button onClick={handleDismiss} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white" id="pwa-close-btn">
        <X size={16} />
      </button>

      <div className="flex items-start gap-3">
        <div className="p-3 bg-teal-500/20 text-teal-400 rounded-xl">
          <Download size={22} />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-slate-100 text-sm">Instale o Aplicativo</h4>
          <p className="text-xs text-slate-300 mt-1">
            {platform === 'ios' 
              ? 'Acesse este app a qualquer momento de sua tela inicial como um aplicativo nativo.'
              : 'Adicione o Meu Plano Financeiro à sua tela inicial para controle offline rápido.'}
          </p>

          {platform === 'ios' ? (
            <div className="mt-3 bg-slate-800/80 rounded-lg p-2 text-[11px] text-slate-300 space-y-1.5 border border-slate-700/50">
              <div className="flex items-center gap-1.5">
                <span className="font-medium">1.</span> Toque no botão de compartilhar <Share2 size={12} className="inline text-blue-400" /> no Safari.
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-medium">2.</span> Escolha <span className="font-medium text-white">"Adicionar à Tela de Início"</span> <PlusSquare size={12} className="inline text-slate-200" />.
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-medium">3.</span> Confirme tocando em <span className="font-semibold text-teal-400">"Adicionar"</span> no canto superior direito.
              </div>
            </div>
          ) : (
            <button 
              onClick={handleInstallClick}
              className="mt-3 w-full py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold rounded-xl transition duration-200 shadow-md"
              id="pwa-action-btn"
            >
              Adicionar à Tela Inicial
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

// Tipos fortes para senhas exibidas no painel
type SenhaStatus = "aguardando" | "chamando" | "atendida" | "cancelada";
type SenhaTipo = "normal" | "preferencial" | "proprietario" | "check-in" | "check-out" | "hospede";
type Senha = Tables<'senhas'>;

// Declarar webkitAudioContext sem usar any
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

const formatTempo = (inicio: string) => {
  const agora = new Date().getTime();
  const horaInicio = new Date(inicio).getTime();
  const diffMs = agora - horaInicio;
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);
  return `${diffMins}:${String(diffSecs).padStart(2, '0')}`;
};

function normalizeTipo(tipo: string): string {
  return tipo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function Painel() {
  const [chamando, setChamando] = useState<Senha[]>([]);
  const [proximas, setProximas] = useState<Senha[]>([]);
  const [finalizadas, setFinalizadas] = useState<Senha[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [tempos, setTempos] = useState<Record<string, string>>({});
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const prevIdsRef = useRef<string[]>([]);

  // Persistência do estado de áudio para manter a voz ligada mesmo após refresh
  useEffect(() => {
    const saved = localStorage.getItem('painel_audio_enabled');
    setAudioEnabled(saved !== null ? saved === 'true' : true);
  }, []);

  useEffect(() => {
    localStorage.setItem('painel_audio_enabled', String(audioEnabled));
  }, [audioEnabled]);

  const beep = () => {
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      o.start();
      o.stop(ctx.currentTime + 0.6);
    } catch (error) {
      console.error("Erro ao emitir beep:", error);
    }
  };

  const anunciarSenha = (senha: Senha) => {
    if (!audioEnabled || !window.speechSynthesis) return;

    try {
      const tipoNorm = normalizeTipo(senha.tipo);
      const prefixoMap: Record<string, string> = {
        "normal": "normal",
        "preferencial": "preferencial",
        "proprietario": "proprietário",
        "check-in": "check-in",
        "check-out": "check-out",
        "hospede": "hóspede",
      };

      const numeroFormatado = `${getPrefixo(senha.tipo)} ${String(senha.numero).padStart(3, "0")}`;
      const textoBase = `Senha ${numeroFormatado}, tipo ${prefixoMap[tipoNorm] || senha.tipo}`;
      const texto = senha.guiche ? `${textoBase}, encaminhar ao guichê ${senha.guiche}.` : `${textoBase}.`;
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = "pt-BR";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Erro ao anunciar:", e);
    }
  };  const anunciarGrupo = (senhas: Senha[]) => {
    if (!audioEnabled || !window.speechSynthesis) return;

    try {
      const numeros = senhas.map((s) => `${getPrefixo(s.tipo)} ${String(s.numero).padStart(3, "0")}`);
      const guichesUnicos = Array.from(new Set(senhas.map(s => s.guiche).filter(Boolean))) as (string | number)[];
      const fraseGuiches = guichesUnicos.length
        ? (guichesUnicos.length === 1
            ? ` Encaminhar ao guichê ${guichesUnicos[0]}.`
            : ` Encaminhar aos guichês ${guichesUnicos.join(', ')}.`)
        : '';
      const texto = `Chamando as senhas ${numeros.join(', ')}.${fraseGuiches}`;
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = "pt-BR";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Erro ao anunciar em grupo:", e);
    }
  };

  const carregar = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('senhas')
        .select('*')
        .order('updated_at', { ascending: true });

      if (error) throw error;

      const chamandoAtual = data?.filter(s => s.status === 'chamando') || [];
      const aguardando = data?.filter(s => s.status === 'aguardando') || [];
      const agoraMs = Date.now();
      const cincoMinMs = 5 * 60 * 1000;
      const finalizadasRecentes = data?.filter(s => {
        if (!s.hora_chamada) return false;
        const chamadaMs = new Date(s.hora_chamada).getTime();
        return s.status === 'atendida' && (agoraMs - chamadaMs) <= cincoMinMs;
      }) || [];

      // Detectar novas senhas chamando
      const newIds = chamandoAtual.map(s => s.id).sort();
      const prevIds = prevIdsRef.current;
      const hasNew = newIds.some(id => !prevIds.includes(id));

      setChamando(chamandoAtual);
      setProximas(aguardando.slice(0, 8));
      setFinalizadas(finalizadasRecentes);

      // Atualizar tempos
      const novosTempos: Record<string, string> = {};
      [...chamandoAtual, ...aguardando, ...finalizadasRecentes].forEach(s => {
        novosTempos[s.id] = formatTempo(s.hora_retirada);
      });
      setTempos(novosTempos);

      if (prevIds.length && hasNew && audioEnabled) {
        beep();
        const novos = chamandoAtual.filter(s => !prevIds.includes(s.id));
        if (novos.length > 1) {
          anunciarGrupo(novos);
        } else if (novos.length === 1) {
          anunciarSenha(novos[0]);
        }
      }

      prevIdsRef.current = newIds;
    } catch (e) {
      console.error("Erro ao carregar:", e);
    }
  }, [audioEnabled]);

  useEffect(() => {
    if (!window.speechSynthesis) return;

    const chooseVoice = (voices: SpeechSynthesisVoice[]) => {
      const pt = voices.filter(v => v.lang?.toLowerCase().startsWith('pt'));
      const ptBr = voices.filter(v => v.lang?.toLowerCase().startsWith('pt-br'));
      const googlePtBr = ptBr.find(v => /google/i.test(v.name));
      const femaleNamed = [...ptBr, ...pt].find(v => /(female|mulher|ana|maria|raquel|lu[cç]iana|camila|bruna|paula)/i.test(v.name));
      setVoice(googlePtBr || femaleNamed || ptBr[0] || pt[0] || null);
    };

    const loadVoices = () => chooseVoice(window.speechSynthesis.getVoices());
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 1000); // Atualiza a cada 1s para cronômetro
    const channel = supabase
      .channel('painel-senhas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'senhas' }, () => {
        carregar();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [carregar]);

  function getPrefixo(tipo: string) {
    const t = normalizeTipo(tipo);
    switch (t) {
      case "preferencial": return "P";
      case "proprietario": return "PR";
      case "check-in": return "CI";
      case "check-out": return "CO";
      case "hospede": return "H";
      default: return "N";
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background imagem opcional */}
      {import.meta.env.VITE_BACKGROUND_IMAGE_URL && (
        <div className="absolute inset-0 bg-cover bg-center bg-custom-bg" />
      )}

      {/* Vídeo de fundo */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <iframe
          title="Vídeo de fundo do painel de chamadas"
          className="absolute top-1/2 left-1/2 w-[177.77777778vh] h-[56.25vw] min-h-full min-w-full -translate-x-1/2 -translate-y-1/2"
          src="https://www.youtube.com/embed/_TUU487uR38?autoplay=1&mute=1&loop=1&playlist=_TUU487uR38&start=35&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1"
          allow="autoplay; encrypted-media"
          frameBorder="0"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Conteúdo */}
      <div className="relative z-10 min-h-screen flex">
        {/* Coluna Esquerda - Informações */}
        <div className="w-full md:w-1/2 p-6 space-y-4 overflow-hidden">
          {/* Header com botão discreto e logo */}
          <div className="flex justify-between items-start">
            <div>
              {import.meta.env.VITE_LOGO_URL && (
                <img src={import.meta.env.VITE_LOGO_URL} alt="Logo" className="h-10 mb-2" />
              )}
              <h1 className="text-3xl md:text-5xl font-bold text-white drop-shadow-lg">Painel de Chamadas</h1>
            </div>
            <Button
              onClick={() => setAudioEnabled(!audioEnabled)}
              variant="ghost"
              size="sm"
              className="bg-black/30 hover:bg-black/50 text-white border-white/20 backdrop-blur-sm"
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          </div>

          {/* Senhas Chamando Agora */}
          <Card className="bg-black/60 backdrop-blur-md border-destructive/50 shadow-elevated">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4 blink-red">Senhas Chamando Agora</h2>
              {chamando.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {chamando.map((senha) => (
                    <div key={senha.id} className="bg-destructive/20 border-2 border-destructive rounded-xl p-4 pulse-glow">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-4xl font-bold text-white mb-1">
                            {getPrefixo(senha.tipo)}{String(senha.numero).padStart(3, "0")}
                          </div>
                          <div className="text-lg font-semibold text-white">Guichê {senha.guiche}</div>
                          <div className="text-sm text-white/80">{senha.atendente}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-mono text-white/90">{tempos[senha.id]}</div>
                          <div className="text-xs text-white/70">tempo</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-lg text-white/70">Aguardando chamadas...</p>
                </div>
              )}
            </div>
          </Card>

          {/* Próximas Senhas */}
          <Card className="bg-black/50 backdrop-blur-md border-white/20 shadow-elevated">
            <div className="p-4">
              <h2 className="text-xl font-bold mb-3 text-white">Próximas Senhas</h2>
              {proximas.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {proximas.map((senha) => (
                    <div key={senha.id} className="bg-white/10 rounded-lg p-3 text-center backdrop-blur-sm">
                      <div className="text-xl font-bold text-white mb-1">
                        {getPrefixo(senha.tipo)}{String(senha.numero).padStart(3, "0")}
                      </div>
                      <div className="text-xs font-mono text-white/70">{tempos[senha.id]}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-white/60">Nenhuma senha aguardando</p>
                </div>
              )}
            </div>
          </Card>

          {/* Senhas Chamadas */}
          <Card className="bg-black/50 backdrop-blur-md border-white/20 shadow-elevated">
            <div className="p-4">
              <h2 className="text-xl font-bold mb-3 text-white">Senhas Chamadas</h2>
              {finalizadas.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {finalizadas.map((senha) => (
                    <div key={senha.id} className="bg-success/20 border border-success/30 rounded-lg p-3 text-center backdrop-blur-sm">
                      <div className="text-xl font-bold text-white mb-1">
                        {getPrefixo(senha.tipo)}{String(senha.numero).padStart(3, "0")}
                      </div>
                      <div className="text-xs font-mono text-white/70">{tempos[senha.id]}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-white/60">Nenhuma senha finalizada</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

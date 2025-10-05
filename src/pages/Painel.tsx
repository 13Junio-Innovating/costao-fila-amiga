import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";

export default function Painel() {
  const [chamando, setChamando] = useState<any[]>([]);
  const [proximas, setProximas] = useState<any[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const prevIdsRef = useRef<string[]>([]);

  const beep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    } catch {}
  };

  const anunciarSenha = (senha: any) => {
    if (!audioEnabled || !window.speechSynthesis) return;

    try {
      const prefixoMap: Record<string, string> = {
        "normal": "normal",
        "preferencial": "preferencial",
        "proprietario": "proprietário",
        "check-in": "check-in",
        "check-out": "check-out"
      };

      const texto = `Senha ${senha.numero}, tipo ${prefixoMap[senha.tipo] || senha.tipo}, guichê ${senha.guiche}`;
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = "pt-BR";
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Erro ao anunciar:", e);
    }
  };

  async function carregar() {
    try {
      const { data, error } = await supabase
        .from('senhas')
        .select('*')
        .order('hora_retirada', { ascending: true });

      if (error) throw error;

      const chamandoAtual = data?.filter(s => s.status === 'chamando') || [];
      const aguardando = data?.filter(s => s.status === 'aguardando') || [];

      // Detectar novas senhas chamando
      const newIds = chamandoAtual.map(s => s.id).sort();
      const prevIds = prevIdsRef.current;
      const hasNew = newIds.some(id => !prevIds.includes(id));

      setChamando(chamandoAtual);
      setProximas(aguardando.slice(0, 8));

      if (prevIds.length && hasNew && audioEnabled) {
        beep();
        const novos = chamandoAtual.filter(s => !prevIds.includes(s.id));
        novos.forEach(anunciarSenha);
      }

      prevIdsRef.current = newIds;
    } catch (e) {
      console.error("Erro ao carregar:", e);
    }
  }

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 3000);
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
  }, [audioEnabled]);

  const getPrefixo = (tipo: string) => {
    switch (tipo) {
      case "preferencial": return "P";
      case "proprietario": return "PR";
      case "check-in": return "CI";
      case "check-out": return "CO";
      default: return "N";
    }
  };

  return (
    <div className="min-h-screen gradient-ocean p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold text-white">Painel de Chamadas</h1>
          <Button
            onClick={() => setAudioEnabled(!audioEnabled)}
            variant={audioEnabled ? "default" : "outline"}
            size="lg"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20"
          >
            {audioEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            <span className="ml-2">{audioEnabled ? "Áudio Ativado" : "Ativar Áudio"}</span>
          </Button>
        </div>

        {/* Senhas Chamando */}
        <Card className="p-8 shadow-elevated">
          <h2 className="text-2xl font-bold mb-6">Senhas Chamando Agora</h2>
          {chamando.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {chamando.map((senha) => (
                <div key={senha.id} className="bg-primary/5 border-2 border-primary rounded-xl p-6 text-center pulse-glow">
                  <div className="text-6xl font-bold text-primary mb-2">
                    {getPrefixo(senha.tipo)}{String(senha.numero).padStart(3, "0")}
                  </div>
                  <div className="text-xl font-semibold mb-1">Guichê {senha.guiche}</div>
                  <div className="text-sm text-muted-foreground">{senha.atendente}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-xl text-muted-foreground">Aguardando chamadas...</p>
            </div>
          )}
        </Card>

        {/* Próximas Senhas */}
        <Card className="p-8 shadow-elevated">
          <h2 className="text-2xl font-bold mb-6">Próximas Senhas</h2>
          {proximas.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {proximas.map((senha) => (
                <div key={senha.id} className="bg-muted rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {getPrefixo(senha.tipo)}{String(senha.numero).padStart(3, "0")}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhuma senha aguardando</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

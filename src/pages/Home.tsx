import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Star, Users, Home as HomeIcon, LogIn, LogOut, Printer, Check } from "lucide-react";

export default function Home() {
  const [novaSenha, setNovaSenha] = useState<{
    id?: string;
    numero: number;
    tipo: "normal" | "preferencial" | "proprietario" | "check-in" | "check-out" | "hospede";
    status: string;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  async function gerarSenha(tipo: "normal" | "preferencial" | "proprietario" | "check-in" | "check-out" | "hospede") {
    setIsGenerating(true);
    try {
      // Obter próximo número
      const { data: numeroData, error: numeroError } = await supabase
        .rpc('get_proximo_numero_senha', { tipo_senha: tipo });

      if (numeroError) throw numeroError;
      if (typeof numeroData !== "number") throw new Error("Número de senha inválido.");

      // Inserir senha
      const { data, error } = await supabase
        .from('senhas')
        .insert([{ numero: numeroData, tipo: tipo, status: 'aguardando' }])
        .select()
        .single();

      if (error) throw error;

      setNovaSenha({
        id: data?.id as string,
        numero: data?.numero as number,
        tipo: data?.tipo as "normal" | "preferencial" | "proprietario" | "check-in" | "check-out" | "hospede",
        status: data?.status as string,
      });
      toast({
        title: "Senha gerada!",
        description: `Sua senha foi gerada com sucesso.`,
      });
    } catch (e: unknown) {
      console.error("Erro ao gerar senha:", e);
      let description = "";
      if (e && typeof e === "object") {
        const maybeErr = e as { message?: string; details?: string; hint?: string; code?: string };
        description = [maybeErr.message, maybeErr.details, maybeErr.hint, maybeErr.code].filter(Boolean).join(" — ");
      }
      if (!description) {
        description = e instanceof Error ? e.message : String(e);
      }
      // Mensagem amigável quando o enum do banco não possui 'hospede'
      if (/invalid input value for enum/i.test(description) && /senha_tipo/i.test(description)) {
        description = "O tipo 'Hóspede' ainda não está habilitado no banco (enum senha_tipo). Aplique as migrações para adicionar 'hospede' ou execute no SQL: ALTER TYPE senha_tipo ADD VALUE 'hospede';";
      }
      toast({
        title: "Erro ao gerar senha",
        description,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  const imprimirSenha = () => {
    if (!novaSenha) return;

    const getPrefixoETipo = (tipo: string) => {
      switch (tipo) {
        case "preferencial": return { prefixo: "P", nome: "Atendimento Preferencial" };
        case "proprietario": return { prefixo: "PR", nome: "Proprietário" };
        case "check-in": return { prefixo: "CI", nome: "Check-in" };
        case "check-out": return { prefixo: "CO", nome: "Check-out" };
        case "hospede": return { prefixo: "H", nome: "Hóspede" };
        default: return { prefixo: "N", nome: "Atendimento Normal" };
      }
    };

    const { prefixo, nome } = getPrefixoETipo(novaSenha.tipo);
    const numero = `${prefixo}${String(novaSenha.numero).padStart(3, "0")}`;
    const w = window.open("", "_blank");

    if (!w || !w.document) {
      toast({
        title: "Erro ao imprimir",
        description: "Não foi possível abrir a janela de impressão.",
        variant: "destructive",
      });
      return;
    }

    w.document.write(`
      <html><head><title>${numero}</title>
      <style>
        body{font-family:Arial; padding:20px; text-align:center}
        .ticket{border:2px dashed hsl(192 85% 42%); padding:30px; width:300px; margin:20px auto; background:hsl(192 40% 98%)}
        .numero{font-size:48px; font-weight:bold; color:hsl(192 85% 42%); margin:20px 0}
      </style></head><body>
      <div class="ticket">
        <div>Resort Costão do Santinho</div>
        <div>${nome}</div>
        <div class="numero">${numero}</div>
        <div>Aguarde ser chamado</div>
      </div></body></html>
    `);
    w.document.close();
    w.print();
  };

  function getPrefixo(tipo: string) {
    switch (tipo) {
      case "preferencial": return "P";
      case "proprietario": return "PR";
      case "check-in": return "CI";
      case "check-out": return "CO";
      case "hospede": return "H";
      default: return "N";
    }
  }

  function getTipoNome(tipo: string) {
    switch (tipo) {
      case "preferencial": return "Atendimento Preferencial";
      case "proprietario": return "Proprietário";
      case "check-in": return "Check-in";
      case "check-out": return "Check-out";
      case "hospede": return "Hóspede";
      default: return "Atendimento Normal";
    }
  }

  return (
    <div className="min-h-screen gradient-ocean relative overflow-hidden">
      {/* Background vídeo YouTube */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <iframe
          className="absolute top-1/2 left-1/2 w-[177.77777778vh] h-[56.25vw] min-h-full min-w-full -translate-x-1/2 -translate-y-1/2"
          src="https://www.youtube.com/embed/_TUU487uR38?autoplay=1&mute=1&loop=1&playlist=_TUU487uR38&start=35&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1"
          allow="autoplay; encrypted-media"
          frameBorder="0"
          title="Tour Virtual Costão do Santinho"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        <div className="text-center mb-12 animate-fade-in">
          {import.meta.env.VITE_LOGO_URL && (
            <div className="flex justify-center mb-6">
              <img src={import.meta.env.VITE_LOGO_URL} alt="Logo" className="h-14 w-auto" />
            </div>
          )}
          <h1 className="text-5xl font-bold text-white mb-4">Resort Costão do Santinho</h1>
          <p className="text-xl text-white/90">Sistema de Chamadas</p>
        </div>

        {!novaSenha ? (
          <div className="max-w-4xl mx-auto">
            <Card className="p-8 shadow-elevated animate-scale-in bg-black/50 backdrop-blur-md border-white/20">
              <h2 className="text-2xl font-bold text-center mb-8 text-white">Selecione o tipo de atendimento</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Button
                  onClick={() => gerarSenha("normal")}
                  disabled={isGenerating}
                  className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                  size="lg"
                >
                  <Users className="w-10 h-10" />
                  Atendimento Normal
                </Button>

                <Button
                  onClick={() => gerarSenha("preferencial")}
                  disabled={isGenerating}
                  className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                  size="lg"
                >
                  <Star className="w-10 h-10" />
                  Atendimento Preferencial
                </Button>

                <Button
                  onClick={() => gerarSenha("proprietario")}
                  disabled={isGenerating}
                  className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                  size="lg"
                >
                  <HomeIcon className="w-10 h-10" />
                  Proprietário
                </Button>

                <Button
                  onClick={() => gerarSenha("check-in")}
                  disabled={isGenerating}
                  className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                  size="lg"
                >
                  <LogIn className="w-10 h-10" />
                  Check-in
                </Button>

                <Button
                  onClick={() => gerarSenha("check-out")}
                  disabled={isGenerating}
                  className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                  size="lg"
                >
                  <LogOut className="w-10 h-10" />
                  Check-out
                </Button>

                <Button
                  onClick={() => gerarSenha("hospede")}
                  disabled={isGenerating}
                  className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                  size="lg"
                >
                  <Users className="w-10 h-10" />
                  Hóspede
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="max-w-md mx-auto">
            <Card className="p-8 text-center shadow-elevated animate-scale-in bg-black/50 backdrop-blur-md border-white/20">
              <div className="mb-6">
                <Check className="w-16 h-16 text-success mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2 text-white">Senha Gerada!</h2>
                <p className="text-white/80">{getTipoNome(novaSenha.tipo)}</p>
              </div>
              
              <div className="bg-white/10 border-2 border-white/20 rounded-lg p-8 mb-6">
                <div className="text-6xl font-bold text-white">
                  {getPrefixo(novaSenha.tipo)}{String(novaSenha.numero).padStart(3, "0")}
                </div>
              </div>

              <p className="text-sm text-white/70 mb-6">
                Aguarde ser chamado. Fique atento ao painel de senhas.
              </p>

              <div className="flex gap-3">
                <Button onClick={imprimirSenha} className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/20" variant="outline">
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
                <Button onClick={() => setNovaSenha(null)} className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/20">
                  Nova Senha
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

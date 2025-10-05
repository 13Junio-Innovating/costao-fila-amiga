import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Star, Users, Home as HomeIcon, LogIn, LogOut, Printer, Check } from "lucide-react";

export default function Home() {
  const [novaSenha, setNovaSenha] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  async function gerarSenha(tipo: "normal" | "preferencial" | "proprietario" | "check-in" | "check-out") {
    setIsGenerating(true);
    try {
      // Obter próximo número
      const { data: numeroData, error: numeroError } = await supabase
        .rpc('get_proximo_numero_senha', { tipo_senha: tipo });

      if (numeroError) throw numeroError;

      // Inserir senha
      const { data, error } = await supabase
        .from('senhas')
        .insert([{
          numero: numeroData,
          tipo: tipo,
          status: 'aguardando'
        }])
        .select()
        .single();

      if (error) throw error;

      setNovaSenha(data);
      toast({
        title: "Senha gerada!",
        description: `Sua senha foi gerada com sucesso.`,
      });
    } catch (e: any) {
      toast({
        title: "Erro ao gerar senha",
        description: e.message,
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

  const getPrefixo = (tipo: string) => {
    switch (tipo) {
      case "preferencial": return "P";
      case "proprietario": return "PR";
      case "check-in": return "CI";
      case "check-out": return "CO";
      default: return "N";
    }
  };

  const getTipoNome = (tipo: string) => {
    switch (tipo) {
      case "preferencial": return "Atendimento Preferencial";
      case "proprietario": return "Proprietário";
      case "check-in": return "Check-in";
      case "check-out": return "Check-out";
      default: return "Atendimento Normal";
    }
  };

  return (
    <div className="min-h-screen gradient-ocean relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-5xl font-bold text-white mb-4">Resort Costão do Santinho</h1>
          <p className="text-xl text-white/90">Sistema de Chamadas</p>
        </div>

        {!novaSenha ? (
          <div className="max-w-4xl mx-auto">
            <Card className="p-8 shadow-elevated animate-scale-in">
              <h2 className="text-2xl font-bold text-center mb-8">Selecione o tipo de atendimento</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Button
                  onClick={() => gerarSenha("normal")}
                  disabled={isGenerating}
                  className="h-32 text-lg flex flex-col gap-3 bg-primary hover:bg-primary/90"
                  size="lg"
                >
                  <Users className="w-10 h-10" />
                  Atendimento Normal
                </Button>

                <Button
                  onClick={() => gerarSenha("preferencial")}
                  disabled={isGenerating}
                  className="h-32 text-lg flex flex-col gap-3 bg-secondary hover:bg-secondary/90"
                  size="lg"
                >
                  <Star className="w-10 h-10" />
                  Atendimento Preferencial
                </Button>

                <Button
                  onClick={() => gerarSenha("proprietario")}
                  disabled={isGenerating}
                  className="h-32 text-lg flex flex-col gap-3 bg-accent hover:bg-accent/90"
                  size="lg"
                >
                  <HomeIcon className="w-10 h-10" />
                  Proprietário
                </Button>

                <Button
                  onClick={() => gerarSenha("check-in")}
                  disabled={isGenerating}
                  className="h-32 text-lg flex flex-col gap-3 bg-success hover:bg-success/90"
                  size="lg"
                >
                  <LogIn className="w-10 h-10" />
                  Check-in
                </Button>

                <Button
                  onClick={() => gerarSenha("check-out")}
                  disabled={isGenerating}
                  className="h-32 text-lg flex flex-col gap-3 bg-warning hover:bg-warning/90"
                  size="lg"
                >
                  <LogOut className="w-10 h-10" />
                  Check-out
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="max-w-md mx-auto">
            <Card className="p-8 text-center shadow-elevated animate-scale-in">
              <div className="mb-6">
                <Check className="w-16 h-16 text-success mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Senha Gerada!</h2>
                <p className="text-muted-foreground">{getTipoNome(novaSenha.tipo)}</p>
              </div>
              
              <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-8 mb-6">
                <div className="text-6xl font-bold text-primary">
                  {getPrefixo(novaSenha.tipo)}{String(novaSenha.numero).padStart(3, "0")}
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-6">
                Aguarde ser chamado. Fique atento ao painel de senhas.
              </p>

              <div className="flex gap-3">
                <Button onClick={imprimirSenha} className="flex-1" variant="outline">
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
                <Button onClick={() => setNovaSenha(null)} className="flex-1">
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

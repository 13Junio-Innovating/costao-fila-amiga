import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
// removido o import de tema local (usar apenas o botão no cabeçalho)
import SenhaCard from "@/components/SenhaCard";
import type { Tables } from "@/integrations/supabase/types";

export default function Atendente() {
  const [senhas, setSenhas] = useState<Tables<'senhas'>[]>([]);
  const [guiche, setGuiche] = useState<string | null>(null);
  const [atendente, setAtendente] = useState("");
  const { toast } = useToast();
  // tema local removido: usar apenas o toggle no cabeçalho

  async function carregar() {
    try {
      const { data, error } = await supabase
        .from('senhas')
        .select('*')
        .order('hora_retirada', { ascending: true });

      if (error) throw error;
      setSenhas(data || []);
    } catch (e: unknown) {
      console.error("Erro ao carregar:", e);
      const description = e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message)
          : String(e);
      toast({ title: "Erro ao carregar", description, variant: "destructive" });
    }
  }

  useEffect(() => {
    carregar();
    const channel = supabase
      .channel('atendente-senhas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'senhas' }, () => {
        carregar();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const chamarProxima = async () => {
    if (!guiche || !atendente) {
      toast({ title: "Campos obrigatórios", description: "Informe guichê e atendente.", variant: "destructive" });
      return;
    }

    try {
      const aguardando = senhas.filter(s => s.status === 'aguardando')
        .sort((a, b) => {
          if (a.tipo === 'preferencial' && b.tipo !== 'preferencial') return -1;
          if (b.tipo === 'preferencial' && a.tipo !== 'preferencial') return 1;
          return new Date(a.hora_retirada).getTime() - new Date(b.hora_retirada).getTime();
        });

      if (aguardando.length === 0) {
        toast({ title: "Sem senhas aguardando", description: "Não há senhas na fila.", variant: "destructive" });
        return;
      }

      const proxima = aguardando[0];

      const { error } = await supabase
        .from('senhas')
        .update({
          status: 'chamando',
          guiche,
          atendente,
          hora_chamada: new Date().toISOString()
        })
        .eq('id', proxima.id);

      if (error) throw error;

      toast({ title: "Senha chamada!", description: `Senha ${proxima.numero} chamada.` });
    } catch (e: unknown) {
      const description = e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message)
          : String(e);
      toast({ title: "Erro ao chamar", description, variant: "destructive" });
    }
  };

  const finalizar = async (id: string) => {
    try {
      const { error } = await supabase
        .from('senhas')
        .update({
          status: 'atendida',
          hora_atendimento: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Senha finalizada!", description: "Atendimento concluído." });
    } catch (e: unknown) {
      const description = e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message)
          : String(e);
      toast({ title: "Erro ao finalizar", description, variant: "destructive" });
    }
  };

  const voltar = async (id: string) => {
    try {
      const { error } = await supabase
        .from('senhas')
        .update({
          status: 'aguardando',
          guiche: null,
          atendente: null,
          hora_chamada: null
        })
        .eq('id', id);

    if (error) throw error;

    toast({ title: "Senha voltou para fila", description: "Senha retornou para aguardando." });
    } catch (e: unknown) {
      const description = e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message)
          : String(e);
      toast({ title: "Erro ao voltar", description, variant: "destructive" });
    }
  };

  const chamando = senhas.filter(s => s.status === 'chamando');

  return (
    <Layout showAdminLink={false} showPainelLink={false} showRelatoriosLink={false} showThemeToggle={true}>
      <div className="container mx-auto p-6 space-y-6">
        {/* Controles de atendimento */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Chamar Próxima Senha</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="guiche">Guichê</Label>
              <Select value={guiche ?? undefined} onValueChange={(value) => setGuiche(value)}>
                <SelectTrigger id="guiche" className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="7">7</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="9">9</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="atendente">Atendente</Label>
              <Input id="atendente" value={atendente} onChange={(e) => setAtendente(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={chamarProxima}>Chamar Próxima</Button>
            </div>
          </div>
        </Card>

        {/* Senhas em atendimento */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Em atendimento</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chamando.map((senha) => (
              <div key={senha.id} className="space-y-3">
                <SenhaCard senha={senha} />
                <div className="flex gap-2">
                  <Button onClick={() => finalizar(senha.id)} className="flex-1">Finalizar</Button>
                  <Button variant="outline" onClick={() => voltar(senha.id)} className="flex-1">Voltar para fila</Button>
                </div>
              </div>
            ))}
            {chamando.length === 0 && (
              <p className="text-muted-foreground">Nenhuma senha em atendimento no momento.</p>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
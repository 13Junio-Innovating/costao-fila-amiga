import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { Download, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Relatorios() {
  const [senhas, setSenhas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState("hoje");
  const { toast } = useToast();

  async function carregar() {
    setLoading(true);
    try {
      let query = supabase
        .from('senhas')
        .select('*')
        .order('hora_retirada', { ascending: false });

      if (periodo === "hoje") {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        query = query.gte('hora_retirada', hoje.toISOString());
      }

      const { data, error } = await query.limit(2000);

      if (error) throw error;

      setSenhas(data || []);
    } catch (e: any) {
      toast({
        title: "Erro ao carregar",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [periodo]);

  const getPrefixo = (tipo: string) => {
    switch (tipo) {
      case "preferencial": return "P";
      case "proprietario": return "PR";
      case "check-in": return "CI";
      case "check-out": return "CO";
      default: return "N";
    }
  };

  const numero = (s: any) => `${getPrefixo(s.tipo)}${String(s.numero).padStart(3, "0")}`;
  const fmt = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "-";

  function exportarCSV() {
    if (!senhas.length) {
      toast({
        title: "Sem dados",
        description: "Não há dados para exportar.",
        variant: "destructive",
      });
      return;
    }

    const sep = ";";
    const header = `sep=${sep}\r\nNumero;Tipo;Status;Retirada;Chamada;Atendimento;Guiche;Atendente`;
    const rows = senhas.map(s => {
      const numeroText = `="${numero(s)}"`;
      const cols = [
        numeroText,
        s.tipo,
        s.status,
        fmt(s.hora_retirada),
        fmt(s.hora_chamada),
        fmt(s.hora_atendimento),
        s.guiche || "",
        s.atendente || ""
      ];
      return cols.map(v => `"${String(v).replace(/"/g, '""')}"`).join(sep);
    });
    const csv = [header, ...rows].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${periodo}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Exportado!",
      description: "Arquivo CSV baixado com sucesso.",
    });
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="todos">Todos (limite 2000)</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={carregar} variant="outline" disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
            <Button onClick={exportarCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Senhas ({senhas.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Número</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Retirada</th>
                  <th className="text-left p-3">Chamada</th>
                  <th className="text-left p-3">Atendimento</th>
                  <th className="text-left p-3">Guichê</th>
                  <th className="text-left p-3">Atendente</th>
                </tr>
              </thead>
              <tbody>
                {senhas.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-mono font-bold">{numero(s)}</td>
                    <td className="p-3">{s.tipo}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        s.status === 'aguardando' ? 'bg-warning/10 text-warning' :
                        s.status === 'chamando' ? 'bg-primary/10 text-primary' :
                        s.status === 'atendida' ? 'bg-success/10 text-success' :
                        'bg-destructive/10 text-destructive'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3 text-sm">{fmt(s.hora_retirada)}</td>
                    <td className="p-3 text-sm">{fmt(s.hora_chamada)}</td>
                    <td className="p-3 text-sm">{fmt(s.hora_atendimento)}</td>
                    <td className="p-3">{s.guiche || "-"}</td>
                    <td className="p-3">{s.atendente || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {senhas.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma senha encontrada
              </div>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}

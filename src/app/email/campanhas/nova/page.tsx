"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type EmpresaResumo = { nif: string; nome: string; email: string };
type Listas = { elegiveis: EmpresaResumo[]; excluidasTermino: EmpresaResumo[]; jaNoKanban: EmpresaResumo[] };
type Opcao = { id: string; nome: string };

const MESES = [
  { val: "1", label: "Janeiro" }, { val: "2", label: "Fevereiro" },
  { val: "3", label: "Março" }, { val: "4", label: "Abril" },
  { val: "5", label: "Maio" }, { val: "6", label: "Junho" },
  { val: "7", label: "Julho" }, { val: "8", label: "Agosto" },
  { val: "9", label: "Setembro" }, { val: "10", label: "Outubro" },
  { val: "11", label: "Novembro" }, { val: "12", label: "Dezembro" },
];

export default function NovaCampanhaPage() {
  const router = useRouter();

  const [mes, setMes] = useState("");
  const [listas, setListas] = useState<Listas | null>(null);
  const [loadingListas, setLoadingListas] = useState(false);
  const [selecionadosKanban, setSelecionadosKanban] = useState<Set<string>>(new Set());

  const [contas, setContas] = useState<Opcao[]>([]);
  const [modelos, setModelos] = useState<Opcao[]>([]);
  const [nomeCampanha, setNomeCampanha] = useState("");
  const [contaEmailId, setContaEmailId] = useState("");
  const [modeloEmailId, setModeloEmailId] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [testeEmails, setTesteEmails] = useState("");
  const [testando, setTestando] = useState(false);
  const [testeResultados, setTesteResultados] = useState<Array<{ destinatario: string; ok: boolean; erro?: string }> | null>(null);
  const [testeErro, setTesteErro] = useState("");
  const [criandoTeste, setCriandoTeste] = useState(false);

  useEffect(() => {
    fetch("/api/email/contas").then((r) => r.json()).then((cs: Array<Opcao & { ativo: boolean }>) =>
      setContas(cs.filter((c) => c.ativo)));
    fetch("/api/email/modelos").then((r) => r.json()).then(setModelos);
  }, []);

  useEffect(() => {
    if (!mes) { setListas(null); return; }
    setLoadingListas(true);
    setSelecionadosKanban(new Set());
    fetch(`/api/email/campanhas/preview?mes=${mes}`)
      .then((r) => r.json())
      .then(setListas)
      .finally(() => setLoadingListas(false));
  }, [mes]);

  function toggleKanban(nif: string) {
    setSelecionadosKanban((prev) => {
      const next = new Set(prev);
      if (next.has(nif)) next.delete(nif); else next.add(nif);
      return next;
    });
  }

  const totalIncluido = (listas?.elegiveis.length ?? 0) + selecionadosKanban.size;

  async function handleCriar() {
    setError("");
    if (!nomeCampanha.trim() || !mes || !contaEmailId || !modeloEmailId) {
      setError("Preencha o nome, o mês, a conta e o modelo.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/email/campanhas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: nomeCampanha,
        mesFiltro: mes,
        contaEmailId,
        modeloEmailId,
        nifsAdicionaisKanban: Array.from(selecionadosKanban),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Erro ao criar campanha"); return; }
    router.push(`/email/campanhas/${data.id}`);
  }

  async function handleEnviarTeste() {
    setTesteErro("");
    setTesteResultados(null);

    const destinatarios = Array.from(new Set(
      testeEmails.split(/[\n,;]/).map((e) => e.trim()).filter(Boolean)
    ));

    if (!contaEmailId || !modeloEmailId || destinatarios.length === 0) {
      setTesteErro("Escolha a conta, o modelo e indique pelo menos um email de destino.");
      return;
    }

    setTestando(true);
    const res = await fetch("/api/email/campanhas/teste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contaEmailId, modeloEmailId, destinatarios }),
    });
    const data = await res.json();
    setTestando(false);

    if (!res.ok) { setTesteErro(data.error ?? "Erro ao enviar o teste."); return; }
    setTesteResultados(data.resultados);
  }

  async function handleCriarCampanhaTeste() {
    setTesteErro("");

    const destinatarios = Array.from(new Set(
      testeEmails.split(/[\n,;]/).map((e) => e.trim()).filter(Boolean)
    ));

    if (!contaEmailId || !modeloEmailId || destinatarios.length === 0) {
      setTesteErro("Escolha a conta, o modelo e indique pelo menos um email de destino.");
      return;
    }

    setCriandoTeste(true);
    const res = await fetch("/api/email/campanhas/teste-campanha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contaEmailId, modeloEmailId, emails: destinatarios }),
    });
    const data = await res.json();
    setCriandoTeste(false);

    if (!res.ok) { setTesteErro(data.error ?? "Erro ao criar campanha de teste."); return; }
    router.push(`/email/campanhas/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <img src="/logo-b2p.png" alt="B2P Energy" style={{ height: "65px", width: "auto" }} />
        <Link href="/email/campanhas" className="text-gray-400 hover:text-gray-600 text-sm">← Campanhas</Link>
        <h1 className="text-lg font-semibold text-gray-900">Nova Campanha de Email</h1>
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da campanha *</label>
              <input value={nomeCampanha} onChange={(e) => setNomeCampanha(e.target.value)}
                placeholder="Ex: Setembro 2026"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mês de início de contrato *</label>
              <select value={mes} onChange={(e) => setMes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecione o mês...</option>
                {MESES.map((m) => <option key={m.val} value={m.val}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conta de envio *</label>
              <select value={contaEmailId} onChange={(e) => setContaEmailId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecione...</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo de email *</label>
              <select value={modeloEmailId} onChange={(e) => setModeloEmailId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecione...</option>
                {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Testar envio</label>
            <p className="text-xs text-gray-400 mb-2">
              Envia o modelo escolhido, com a assinatura da conta selecionada, para os emails abaixo — útil para verificar antes de disparar a campanha real.
              Separa por vírgula, ponto e vírgula ou uma linha por email.
            </p>
            <textarea value={testeEmails} onChange={(e) => setTesteEmails(e.target.value)}
              placeholder={"teste1@exemplo.pt\nteste2@exemplo.pt"}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={handleEnviarTeste}
                disabled={testando || !contaEmailId || !modeloEmailId}
                className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                {testando ? "A enviar..." : "Enviar teste rápido"}
              </button>
              <button type="button" onClick={handleCriarCampanhaTeste}
                disabled={criandoTeste || !contaEmailId || !modeloEmailId}
                className="border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                {criandoTeste ? "A criar..." : "Criar campanha de teste (ver ecrã de resultados)"}
              </button>
            </div>

            {testeErro && <p className="text-xs text-red-600 mt-2">{testeErro}</p>}

            {testeResultados && (
              <div className="mt-3 space-y-1">
                {testeResultados.map((r) => (
                  <p key={r.destinatario} className={`text-xs ${r.ok ? "text-green-700" : "text-red-600"}`}>
                    {r.ok ? "✓" : "✗"} {r.destinatario}{!r.ok && r.erro ? ` — ${r.erro}` : ""}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {loadingListas && <p className="text-sm text-gray-400">A calcular listas...</p>}

        {listas && !loadingListas && (
          <>
            <ListaEmpresas
              titulo={`Elegíveis para envio (${listas.elegiveis.length})`}
              cor="green"
              empresas={listas.elegiveis}
            />

            {listas.jaNoKanban.length > 0 && (
              <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
                  <h3 className="text-sm font-semibold text-amber-800">
                    Já no Kanban ({listas.jaNoKanban.length}) — excluídas por defeito
                  </h3>
                  <p className="text-xs text-amber-700 mt-0.5">Marque as que quer incluir mesmo assim no envio.</p>
                </div>
                <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {listas.jaNoKanban.map((e) => (
                    <label key={e.nif} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={selecionadosKanban.has(e.nif)}
                        onChange={() => toggleKanban(e.nif)} />
                      <span className="font-medium text-gray-900">{e.nome}</span>
                      <span className="text-gray-500">{e.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {listas.excluidasTermino.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden opacity-75">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-600">
                    Excluídas — já com data de término / contacto telefónico ({listas.excluidasTermino.length})
                  </h3>
                </div>
                <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {listas.excluidasTermino.map((e) => (
                    <div key={e.nif} className="px-4 py-2 text-sm text-gray-500">{e.nome} — {e.email}</div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-600">
            Total a incluir na campanha: <span className="font-semibold text-gray-900">{totalIncluido}</span>
          </p>
          <button onClick={handleCriar} disabled={saving || totalIncluido === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg disabled:opacity-50">
            {saving ? "A criar..." : "Criar campanha"}
          </button>
        </div>
      </main>
    </div>
  );
}

function ListaEmpresas({ titulo, empresas }: { titulo: string; cor: string; empresas: EmpresaResumo[] }) {
  return (
    <div className="bg-white rounded-xl border border-green-200 overflow-hidden">
      <div className="px-4 py-3 bg-green-50 border-b border-green-200">
        <h3 className="text-sm font-semibold text-green-800">{titulo}</h3>
      </div>
      <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
        {empresas.length === 0 ? (
          <p className="text-sm text-gray-400 px-4 py-3">Nenhuma empresa elegível para este mês.</p>
        ) : empresas.map((e) => (
          <div key={e.nif} className="px-4 py-2 text-sm">
            <span className="font-medium text-gray-900">{e.nome}</span>{" "}
            <span className="text-gray-500">{e.email}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

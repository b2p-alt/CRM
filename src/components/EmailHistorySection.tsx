type EnvioHistorico = {
  id: string;
  status: "PENDENTE" | "ENVIANDO" | "ENVIADO" | "FALHOU";
  enviadoEm: string | null;
  abertoEm: string | null;
  campanha: { nome: string; modeloEmail: { nome: string } };
};

const STATUS_LABEL: Record<EnvioHistorico["status"], string> = {
  PENDENTE: "Pendente",
  ENVIANDO: "A enviar",
  ENVIADO: "Enviado",
  FALHOU: "Falhou",
};

export default function EmailHistorySection({ envios }: { envios: EnvioHistorico[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {envios.length === 0 ? (
        <p className="text-sm text-gray-400">Sem emails enviados ainda</p>
      ) : (
        envios.map((envio) => (
          <div key={envio.id} className="border-l-2 border-blue-200 pl-3">
            <p className="text-sm text-gray-800">
              {envio.campanha.nome} <span className="text-gray-400">· {envio.campanha.modeloEmail.nome}</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {STATUS_LABEL[envio.status]}
              {envio.enviadoEm && ` · enviado em ${new Date(envio.enviadoEm).toLocaleString("pt-PT")}`}
              {envio.abertoEm && ` · aberto em ${new Date(envio.abertoEm).toLocaleString("pt-PT")}`}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

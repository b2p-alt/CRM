"use client";

import { useState } from "react";
import { ParsedRecord } from "@/lib/importar/types";
import { EnrichData } from "@/lib/importar/racius";
import Step1Upload from "./Step1Upload";
import Step2Ocr from "./Step2Ocr";
import Step3Review from "./Step3Review";
import Step4Duplicados from "./Step4Duplicados";
import Step4bEnriquecimento from "./Step4bEnriquecimento";
import Step5Confirmar from "./Step5Confirmar";

export type WizardState = {
  jobId: string;
  distrito: string;
  records: ParsedRecord[];
  existingNifs: string[];
  existingCpes: string[];
  enrichResults: Record<string, EnrichData>;
};

const STEPS = ["Upload", "OCR", "Revisão", "Duplicados", "Contactos", "Importar"];

export default function ImportarWizard() {
  const [step, setStep]   = useState(0);
  const [state, setState] = useState<Partial<WizardState>>({});

  function patch(p: Partial<WizardState>) {
    setState((s) => ({ ...s, ...p }));
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8 flex-wrap">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition ${
              i === step
                ? "bg-blue-600 text-white"
                : i < step
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-400"
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                i === step ? "bg-white text-blue-600" : i < step ? "bg-green-600 text-white" : "bg-gray-300 text-gray-500"
              }`}>
                {i < step ? "✓" : i + 1}
              </span>
              {label}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-0.5 mx-1 ${i < step ? "bg-green-300" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        {step === 0 && (
          <Step1Upload
            onDone={(jobId, distrito) => { patch({ jobId, distrito }); setStep(1); }}
          />
        )}
        {step === 1 && state.jobId && (
          <Step2Ocr
            jobId={state.jobId}
            onDone={(records) => { patch({ records }); setStep(2); }}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && state.records && (
          <Step3Review
            records={state.records}
            onDone={(records) => { patch({ records }); setStep(3); }}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && state.records && (
          <Step4Duplicados
            records={state.records}
            onDone={(existingNifs, existingCpes) => { patch({ existingNifs, existingCpes }); setStep(4); }}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && state.records && (
          <Step4bEnriquecimento
            records={state.records}
            onDone={(enrichResults) => { patch({ enrichResults }); setStep(5); }}
            onSkip={() => { patch({ enrichResults: {} }); setStep(5); }}
            onBack={() => setStep(3)}
          />
        )}
        {step === 5 && state.records && state.distrito && (
          <Step5Confirmar
            records={state.records}
            distrito={state.distrito}
            existingNifs={state.existingNifs ?? []}
            existingCpes={state.existingCpes ?? []}
            enrichResults={state.enrichResults ?? {}}
            onBack={() => setStep(4)}
          />
        )}
      </div>
    </div>
  );
}

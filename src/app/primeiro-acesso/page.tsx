"use client";

import { useState } from "react";
import Link from "next/link";

type Step = "email" | "password" | "done";

export default function PrimeiroAcessoPage() {
  const [step, setStep]         = useState<Step>("email");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch(`/api/primeiro-acesso?email=${encodeURIComponent(email)}`);
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error);
    } else {
      setStep("password");
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("As passwords não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A password deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/primeiro-acesso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
    } else {
      setStep("done");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <img src="/logo-b2p.png" alt="B2P Energy" style={{ height: "56px", width: "auto" }} className="mb-6" />

        {step === "email" && (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Primeiro acesso</h1>
            <p className="text-sm text-gray-500 mb-6">
              Introduza o seu email para confirmar o registo e criar a sua password.
            </p>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50">
                {loading ? "A verificar..." : "Continuar"}
              </button>
            </form>
          </>
        )}

        {step === "password" && (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Criar password</h1>
            <p className="text-sm text-gray-500 mb-6">
              Conta encontrada para <span className="font-medium text-gray-700">{email}</span>. Escolha a sua password.
            </p>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova password</label>
                <input
                  type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar password</label>
                <input
                  type="password" required value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50">
                {loading ? "A guardar..." : "Ativar conta"}
              </button>
            </form>
          </>
        )}

        {step === "done" && (
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Conta ativada!</h1>
            <p className="text-sm text-gray-500 mb-6">A sua password foi definida com sucesso. Já pode iniciar sessão.</p>
            <Link href="/login"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm text-center">
              Ir para o login
            </Link>
          </div>
        )}

        {step !== "done" && (
          <p className="text-center text-xs text-gray-400 mt-6">
            Já tem conta?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">Iniciar sessão</Link>
          </p>
        )}
      </div>
    </div>
  );
}

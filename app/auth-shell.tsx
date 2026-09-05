"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowUpRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import Dashboard from "./dashboard";
import { supabase } from "../lib/supabase";

export default function AuthShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setMessage("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const email = String(values.email || "").trim();
    const password = String(values.password || "");
    const fullName = String(values.fullName || "").trim();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (result.error) setMessage(result.error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : result.error.message);
    else if (mode === "register" && !result.data.session) setMessage("Cadastro criado. Confirme o e-mail para entrar.");
    setWorking(false);
  }

  if (loading) return <div className="auth-loading">Carregando...</div>;
  if (session) return <Dashboard displayName={session.user.user_metadata.full_name || session.user.email || "Meu orçamento"} apiToken={session.access_token} onSignOut={() => supabase.auth.signOut()} />;

  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><span><ArrowUpRight /></span><strong>Plano no Azul</strong></div>
    <div className="auth-copy"><h1>{mode === "login" ? "Acesse sua conta" : "Crie sua conta"}</h1><p>Controle seus gastos, metas, contas e ganhos em um só lugar.</p></div>
    <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(""); }}>Entrar</button><button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setMessage(""); }}>Criar conta</button></div>
    <form onSubmit={submit}>
      {mode === "register" && <label>Seu nome<div className="auth-input"><input name="fullName" required placeholder="Como deseja ser chamado" /></div></label>}
      <label>E-mail<div className="auth-input"><Mail/><input name="email" type="email" required autoComplete="email" placeholder="voce@email.com" /></div></label>
      <label>Senha<div className="auth-input"><LockKeyhole/><input name="password" type={showPassword ? "text" : "password"} required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Mínimo de 6 caracteres"/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff/> : <Eye/>}</button></div></label>
      {message && <p className="auth-message">{message}</p>}
      <button className="auth-submit" disabled={working}>{working ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar minha conta"}</button>
    </form>
    <small>Seus dados ficam protegidos e separados dos demais usuários.</small>
  </section></main>;
}

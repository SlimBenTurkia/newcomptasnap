import React, { useState } from "react";
import { Logo } from "./Logo";
import { authErrorMessage } from "../lib/firebase";

interface LandingPageProps {
  /** Connexion Google */
  onSignIn: () => void;
  isRetryingAuth: boolean;
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onEmailSignUp: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
}

type View = "welcome" | "login" | "signup";

export function LandingPage({
  onSignIn,
  isRetryingAuth,
  onEmailSignIn,
  onEmailSignUp,
  onResetPassword,
}: LandingPageProps) {
  const [view, setView] = useState<View>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const go = (next: View) => {
    setError(null);
    setInfo(null);
    setView(next);
  };

  const isSignup = view === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setInfo(null);
    if (!email.trim()) return setError("Saisissez votre adresse e-mail.");
    if (!password) return setError("Saisissez votre mot de passe.");
    setBusy(true);
    try {
      if (isSignup) await onEmailSignUp(email, password);
      else await onEmailSignIn(email, password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) return setError("Saisissez d'abord votre adresse e-mail ci-dessus.");
    setBusy(true);
    try {
      await onResetPassword(email);
      setInfo("E-mail envoyé. Ouvrez le lien reçu pour choisir un nouveau mot de passe.");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-deep text-brand-snow flex justify-center">
      <main className="w-full max-w-[420px] min-h-screen flex flex-col">
        {view === "welcome" ? (
          <>
            <div className="px-6 pt-[52px]">
              <Logo size={72} withName nameClassName="text-[30px]" />
            </div>
            <h1 className="mx-6 mt-8 mb-2 text-[46px] leading-none tracking-[-0.04em] font-extrabold">
              Chaque dépense laisse une trace.
            </h1>
            <p className="mx-6 mb-7 text-brand-muted text-base">Gardez-la. Classée, lue, prête.</p>

            <div className="ticket mx-7 -rotate-3" aria-hidden="true">
              <div className="leader"><span>Reçus scannés</span><i /><span>auto</span></div>
              <div className="leader"><span>Factures suivies</span><i /><span>0 oubli</span></div>
              <div className="leader"><span>Comptable</span><i /><span>prêt</span></div>
              <div className="leader font-bold text-[17px] border-t-2 border-[var(--ink)] mt-1.5 pt-3">
                <span>TOTAL</span><i /><span>en ordre</span>
              </div>
            </div>

            <div className="mt-auto mx-6 mb-8 pt-10 flex flex-col gap-3">
              <button className="btn" onClick={() => go("signup")}>Créer un compte</button>
              <button className="btn ghost" onClick={() => go("login")}>Se connecter</button>
            </div>
          </>
        ) : (
          <>
            <div className="k px-6 pt-14">
              <button
                onClick={() => go("welcome")}
                className="bg-transparent border-0 text-brand-snow min-h-11 p-0 cursor-pointer font-mono uppercase"
              >
                ← Retour
              </button>
            </div>
            <h1 className="mx-6 mt-4 mb-6 text-[46px] leading-none tracking-[-0.04em] font-extrabold">
              {isSignup ? "Ouvrons votre dossier." : "Content de vous revoir."}
            </h1>

            <form onSubmit={submit} className="ticket mx-4" noValidate>
              <label className="k block" htmlFor="auth-email">Adresse e-mail</label>
              <input
                id="auth-email"
                className="field"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="nom@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label className="k block mt-[18px]" htmlFor="auth-password">Mot de passe</label>
              <input
                id="auth-password"
                className="field"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {!isSignup && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={forgot}
                    disabled={busy}
                    className="k bg-transparent border-0 underline font-bold min-h-11 cursor-pointer" style={{ color: "var(--ink)" }}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}
              {isSignup && <p className="k mt-2 mb-2 normal-case tracking-normal">6 caractères minimum.</p>}

              <div role="alert" aria-live="polite" className="min-h-6">
                {error && <p className="text-sm font-bold text-brand-late mb-2">{error}</p>}
                {info && <p className="text-sm font-bold text-brand-ok mb-2">{info}</p>}
              </div>

              <button type="submit" className="btn w-full" disabled={busy || isRetryingAuth}>
                {busy ? "Un instant…" : isSignup ? "Créer un compte" : "Se connecter"}
              </button>
              <button
                type="button"
                className="btn on-paper w-full mt-2.5"
                onClick={onSignIn}
                disabled={busy || isRetryingAuth}
              >
                {isRetryingAuth ? "Connexion…" : "Continuer avec Google"}
              </button>
            </form>

            <div className="k mt-auto mx-6 mb-10 pt-10 text-center text-brand-muted">
              {isSignup ? "Déjà un compte ? " : "Pas de compte ? "}
              <button
                onClick={() => go(isSignup ? "login" : "signup")}
                className="bg-transparent border-0 p-0 font-bold text-brand-vibrant cursor-pointer font-mono uppercase tracking-[0.08em] min-h-11"
              >
                {isSignup ? "Se connecter" : "Créer un compte"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

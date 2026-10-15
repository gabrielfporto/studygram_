import { useState, type FormEvent } from 'react';
import { supabase, callbackUrl } from '../lib/client';

export function Auth({ recovery = false, onRecovered }: { recovery?: boolean; onRecovered: () => void }) {
  const [mode, setMode] = useState<'login'|'signup'|'reset'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = recovery ? await supabase.auth.updateUser({ password })
        : mode === 'login' ? await supabase.auth.signInWithPassword({ email, password })
        : mode === 'signup' ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl() } })
        : await supabase.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl() });
      if (result.error) throw result.error;
      if (recovery) onRecovered();
      else if (mode === 'signup') setMessage('Confira seu e-mail para confirmar a conta. Depois, entre com sua senha.');
      else if (mode === 'reset') setMessage('Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.');
    } catch (error) {
      const code = (error as { code?: string }).code;
      setMessage(code === 'invalid_credentials' ? 'E-mail ou senha incorretos.' : code === 'email_not_confirmed' ? 'Confirme seu e-mail antes de entrar.' : 'Não foi possível continuar. Verifique os dados e tente novamente; o serviço pode limitar envios de e-mail.');
    } finally { setBusy(false); }
  }
  return <main className="auth-layout"><section className="auth-story"><a className="brand" href={import.meta.env.BASE_URL}><span className="brand-mark">s</span>studygram<span className="beta">INÍCIO</span></a>
    <div><p className="eyebrow">CLAREZA PARA ESTUDAR</p><h1>Seu próximo passo.<br/><span>No seu tempo.</span></h1><p className="lead">Um plano que se adapta à sua rotina.<br/>Abra, entenda a prioridade e comece.</p><div className="orbit" aria-hidden="true"><span/><i/><b/></div></div>
    <p className="caption">Menos tempo organizando. Mais espaço para aprender.</p></section>
    <section className="auth-panel"><div className="auth-form"><p className="eyebrow">SEU ESPAÇO DE ESTUDOS</p>
      <h2>{recovery ? 'Escolha uma nova senha' : mode === 'signup' ? 'Vamos começar' : mode === 'reset' ? 'Recuperar acesso' : 'Bom ter você aqui'}</h2>
      <p className="muted">{mode === 'signup' ? 'Crie sua conta para montar o primeiro plano.' : 'Entre para continuar de onde parou.'}</p>
      <form onSubmit={submit}>
        {!recovery && <label>E-mail<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>}
        {(recovery || mode !== 'reset') && <label>Senha<input type="password" minLength={8} required autoComplete={mode === 'signup' || recovery ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)}/></label>}
        <button disabled={busy} className="primary full">{busy ? 'Aguarde…' : recovery ? 'Salvar nova senha' : mode === 'signup' ? 'Criar conta' : mode === 'reset' ? 'Enviar link' : 'Entrar →'}</button>
      </form>
      {message && <p role="status" className="notice">{message}</p>}
      {!recovery && <div className="auth-links"><button className="text-button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>{mode === 'login' ? 'Criar uma conta' : 'Voltar para entrar'}</button>{mode === 'login' && <button className="text-button" onClick={() => setMode('reset')}>Esqueci minha senha</button>}</div>}
    </div></section></main>;
}

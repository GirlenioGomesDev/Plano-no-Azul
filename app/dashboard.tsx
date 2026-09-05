"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Car, Check, CircleDollarSign, CreditCard, FileUp, Flag, Fuel, Gauge, LayoutDashboard, Menu, Pencil, Plus, Target, Trash2, WalletCards, Wrench, X } from "lucide-react";

type Tx = { id: number; description: string; amount: number; type: "income" | "expense"; category: string; date: string };
type Goal = { id: number; name: string; targetAmount: number; savedAmount: number; dueDate?: string };
type Commitment = { id: number; name: string; kind: "bill" | "debt"; amount: number; dueDate: string; installmentsTotal?: number; installmentsPaid?: number; status: "pending" | "paid" };
type DriverDay = { id: number; date: string; grossEarnings: number; rides: number; hoursWorked: number; odometerStart: number; odometerEnd: number; kilometers: number; fuelCost: number; maintenanceCost: number; otherCost: number; notes: string };
type Card = { id: number; name: string; lastFour: string; color: string; creditLimit: number; closingDay: number; dueDay: number };
type CardPurchase = { id: number; cardId: number; description: string; totalAmount: number; installments: number; purchaseDate: string; category: string };
type Data = { transactions: Tx[]; goals: Goal[]; commitments: Commitment[]; driverDays: DriverDay[]; cards: Card[]; cardPurchases: CardPurchase[] };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const today = new Date().toISOString().slice(0, 10);

export default function Dashboard({ displayName }: { displayName: string }) {
  const [data, setData] = useState<Data>({ transactions: [], goals: [], commitments: [], driverDays: [], cards: [], cardPurchases: [] });
  const [view, setView] = useState("visao");
  const [modal, setModal] = useState<null | "transaction" | "goal" | "commitment" | "driverDay" | "card">(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState<{ entity: "transaction" | "commitment" | "cardPurchase"; item: Tx | Commitment | CardPurchase } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const response = await fetch("/api/finance", { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setData(body);
    else setMessage("Não foi possível carregar seus dados.");
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    const month = today.slice(0, 7);
    const current = data.transactions.filter((t) => t.date.startsWith(month));
    const income = current.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = current.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const pending = data.commitments.filter((c) => c.status === "pending").reduce((s, c) => s + c.amount, 0);
    return { income, expense, balance: income - expense, available: income - expense - pending, pending };
  }, [data]);

  async function save(payload: Record<string, unknown>) {
    const response = await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Não foi possível salvar.");
    await load(); setModal(null); setMessage("Salvo com sucesso.");
    window.setTimeout(() => setMessage(""), 2500);
  }

  async function update(payload: Record<string, unknown>) {
    const response = await fetch("/api/finance", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Não foi possível atualizar.");
    await load(); setEditing(null); setMessage("Atualizado com sucesso.");
    window.setTimeout(() => setMessage(""), 2500);
  }

  async function remove(entity: "transaction" | "commitment" | "cardPurchase", id: number) {
    const response = await fetch("/api/finance", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, id }) });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error || "Não foi possível excluir.");
      window.setTimeout(() => setMessage(""), 3500);
      return;
    }
    await load(); setEditing(null); setMessage("Registro excluído.");
    window.setTimeout(() => setMessage(""), 2500);
  }

  async function importStatement(file: File) {
    const text = await file.text();
    let items: Array<Record<string, unknown>> = [];
    if (file.name.toLowerCase().endsWith(".ofx")) {
      const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
      items = blocks.map((block) => {
        const value = Number((block.match(/<TRNAMT>([^<\r\n]+)/i)?.[1] ?? "0").replace(",", "."));
        const rawDate = block.match(/<DTPOSTED>(\d{8})/i)?.[1] ?? today.replaceAll("-", "");
        return { description: block.match(/<MEMO>([^<\r\n]+)/i)?.[1] ?? "Movimentação importada", amount: Math.abs(value), type: value >= 0 ? "income" : "expense", category: "Importado", date: `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}` };
      });
    } else {
      const lines = text.split(/\r?\n/).filter(Boolean);
      const separator = lines[0]?.includes(";") ? ";" : ",";
      items = lines.slice(1).map((line) => {
        const cols = line.split(separator).map((x) => x.replace(/^"|"$/g, "").trim());
        const date = cols.find((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)) ?? today;
        const raw = cols.find((x) => /^-?\d+[.,]\d{2}$/.test(x.replaceAll(".", ""))) ?? "0";
        const value = Number(raw.replaceAll(".", "").replace(",", "."));
        return { description: cols.find((x) => x && x !== date && x !== raw) ?? "Movimentação importada", amount: Math.abs(value), type: value >= 0 ? "income" : "expense", category: "Importado", date };
      });
    }
    items = items.filter((x) => Number(x.amount) > 0);
    if (!items.length) return setMessage("Não encontrei movimentações válidas nesse arquivo.");
    try { await save({ entity: "transactions", items }); setMessage(`${items.length} movimentações importadas.`); }
    catch { setMessage("Não foi possível importar o arquivo."); }
  }

  const nav = [
    ["visao", "Visão geral", LayoutDashboard], ["movimentacoes", "Movimentações", WalletCards],
    ["contas", "Contas e dívidas", CalendarDays], ["cartoes", "Cartões", CreditCard], ["metas", "Metas", Target], ["motorista", "99 Motorista", Car],
  ] as const;

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
      <div className="brand"><span className="brand-mark"><ArrowUpRight /></span><span>Plano no Azul</span></div>
      <button className="close-menu" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X /></button>
      <nav>{nav.map(([id, label, Icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => { setView(id); setMenuOpen(false); }}><Icon />{label}</button>)}</nav>
      <div className="sidebar-note"><span>Seu mês</span><strong>{summary.available >= 0 ? "Dentro do plano" : "Atenção ao limite"}</strong><small>{money.format(summary.available)} livres após compromissos</small></div>
    </aside>
    {menuOpen && <button className="backdrop" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}

    <main className="content">
      <header><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu /></button><div><p>Olá, {displayName.split(" ")[0]}</p><h1>{nav.find(([id]) => id === view)?.[1]}</h1></div><div className="header-actions"><input ref={fileRef} hidden type="file" accept=".csv,.ofx,text/csv" onChange={(e) => e.target.files?.[0] && importStatement(e.target.files[0])}/><button className="secondary" onClick={() => fileRef.current?.click()}><FileUp />Importar extrato</button><button className="primary" onClick={() => setModal("transaction")}><Plus />Novo lançamento</button></div></header>
      {message && <div className="toast">{message}</div>}

      {view === "visao" && <>
        <section className="hero-balance"><div><span>Disponível para gastar</span><strong>{money.format(summary.available)}</strong><small>Depois das despesas e contas pendentes</small></div><div className="month-score"><span>Saúde do mês</span><b>{summary.income === 0 ? "—" : Math.max(0, Math.round((summary.available / summary.income) * 100)) + "%"}</b></div></section>
        <section className="summary-grid">
          <article><div className="icon income"><ArrowUpRight /></div><span>Ganhos no mês</span><strong>{money.format(summary.income)}</strong></article>
          <article><div className="icon expense"><ArrowDownRight /></div><span>Gastos no mês</span><strong>{money.format(summary.expense)}</strong></article>
          <article><div className="icon pending"><CalendarDays /></div><span>A vencer</span><strong>{money.format(summary.pending)}</strong></article>
        </section>
        <section className="two-columns"><TransactionList items={data.transactions.slice(0, 6)} loading={loading} onEdit={(item) => setEditing({ entity: "transaction", item })}/><CommitmentList items={data.commitments.slice(0, 5)} onAdd={() => setModal("commitment")} onEdit={(item) => setEditing({ entity: "commitment", item })} onPay={(item) => update({ entity: "commitment", id: item.id, action: "pay" })} /></section>
        <GoalList items={data.goals} onAdd={() => setModal("goal")} />
      </>}
      {view === "movimentacoes" && <TransactionList items={data.transactions} loading={loading} onEdit={(item) => setEditing({ entity: "transaction", item })} full />}
      {view === "contas" && <CommitmentList items={data.commitments} onAdd={() => setModal("commitment")} onEdit={(item) => setEditing({ entity: "commitment", item })} onPay={(item) => update({ entity: "commitment", id: item.id, action: "pay" })} full />}
      {view === "cartoes" && <CardsView cards={data.cards} purchases={data.cardPurchases} onAdd={() => setModal("card")} onPurchase={() => setModal("transaction")} onEdit={(item) => setEditing({ entity: "cardPurchase", item })} />}
      {view === "metas" && <GoalList items={data.goals} onAdd={() => setModal("goal")} full />}
      {view === "motorista" && <DriverView items={data.driverDays} onAdd={() => setModal("driverDay")} />}
    </main>
    {modal && <Modal type={modal} cards={data.cards} onClose={() => setModal(null)} onSave={save} />}
    {editing && <EditModal editing={editing} onClose={() => setEditing(null)} onSave={update} onDelete={() => remove(editing.entity, editing.item.id)} />}
  </div>;
}

function TransactionList({ items, loading, full, onEdit }: { items: Tx[]; loading: boolean; full?: boolean; onEdit: (item: Tx) => void }) {
  return <section className={`panel ${full ? "full" : ""}`}><div className="panel-title"><div><h2>Movimentações</h2><p>Entradas e saídas recentes</p></div></div>
    {loading ? <div className="empty">Carregando...</div> : !items.length ? <div className="empty"><CircleDollarSign/><strong>Nenhuma movimentação</strong><span>Adicione ou importe seu primeiro lançamento.</span></div> :
    <div className="list">{items.map((t) => <div className="list-row" key={t.id}><div className={`mini-icon ${t.type}`}>{t.type === "income" ? <ArrowUpRight/> : <ArrowDownRight/>}</div><div className="grow"><strong>{t.description}</strong><span>{t.category} · {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}</span></div><b className={t.type}>{t.type === "income" ? "+" : "-"} {money.format(t.amount)}</b><button className="edit-button" onClick={() => onEdit(t)} aria-label="Editar movimentação"><Pencil/></button></div>)}</div>}
  </section>;
}

function CommitmentList({ items, onAdd, onEdit, onPay, full }: { items: Commitment[]; onAdd: () => void; onEdit: (item: Commitment) => void; onPay: (item: Commitment) => void; full?: boolean }) {
  return <section className={`panel ${full ? "full" : ""}`}><div className="panel-title"><div><h2>Contas e dívidas</h2><p>Próximos compromissos</p></div><button className="round" onClick={onAdd}><Plus/></button></div>
    {!items.length ? <div className="empty"><CalendarDays/><strong>Nenhum vencimento</strong><span>Cadastre contas fixas, parcelas ou dívidas.</span></div> :
    <div className="list">{items.map((c) => <div className={`list-row ${c.status === "paid" ? "paid-row" : ""}`} key={c.id}><div className="date-box"><b>{c.dueDate.slice(8,10)}</b><span>{new Date(c.dueDate + "T12:00:00").toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span></div><div className="grow"><strong>{c.name}</strong><span>{c.kind === "debt" ? `Dívida${c.installmentsTotal ? ` · ${c.installmentsPaid ?? 0}/${c.installmentsTotal}` : ""}` : "Conta"} · {c.status === "paid" ? "Pago" : "Pendente"}</span></div><b>{money.format(c.amount)}</b>{c.status !== "paid" && <button className="pay-button" onClick={() => onPay(c)} title={c.installmentsTotal ? "Pagar próxima parcela" : "Marcar como pago"}><Check/><span>{c.installmentsTotal ? "Pagar parcela" : "Pagar"}</span></button>}<button className="edit-button" onClick={() => onEdit(c)} aria-label="Editar conta ou dívida"><Pencil/></button></div>)}</div>}
  </section>;
}

function GoalList({ items, onAdd, full }: { items: Goal[]; onAdd: () => void; full?: boolean }) {
  return <section className={`panel goals-panel ${full ? "full" : ""}`}><div className="panel-title"><div><h2>Metas</h2><p>Um passo de cada vez</p></div><button className="secondary small" onClick={onAdd}><Plus/>Nova meta</button></div>
    {!items.length ? <div className="empty horizontal"><Flag/><div><strong>Crie seu primeiro objetivo</strong><span>Defina um valor e acompanhe sua evolução.</span></div></div> :
    <div className="goals-grid">{items.map((g) => { const pct = Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100)); return <article key={g.id}><div><strong>{g.name}</strong><span>{pct}%</span></div><div className="progress"><i style={{ width: `${pct}%` }}/></div><p>{money.format(g.savedAmount)} de {money.format(g.targetAmount)}</p></article>; })}</div>}
  </section>;
}

function CardsView({ cards, purchases, onAdd, onPurchase, onEdit }: { cards: Card[]; purchases: CardPurchase[]; onAdd: () => void; onPurchase: () => void; onEdit: (item: CardPurchase) => void }) {
  const current = new Date();
  const monthDiff = (date: string) => {
    const d = new Date(date + "T12:00:00");
    return (current.getFullYear() - d.getFullYear()) * 12 + current.getMonth() - d.getMonth();
  };
  const details = cards.map((card) => {
    const own = purchases.filter((p) => p.cardId === card.id);
    const used = own.reduce((sum, p) => {
      const elapsed = Math.max(0, Math.min(p.installments, monthDiff(p.purchaseDate)));
      return sum + Math.max(0, p.totalAmount - (p.totalAmount / p.installments) * elapsed);
    }, 0);
    const invoice = own.reduce((sum, p) => {
      const elapsed = monthDiff(p.purchaseDate);
      return sum + (elapsed >= 0 && elapsed < p.installments ? p.totalAmount / p.installments : 0);
    }, 0);
    return { card, own, used, invoice, available: Math.max(0, card.creditLimit - used) };
  });
  return <div className="cards-page">
    <section className="cards-heading"><div><h2>Meus cartões</h2><p>Representação dos seus limites e compras parceladas.</p></div><div><button className="secondary" onClick={onAdd}><Plus/>Adicionar cartão</button><button className="primary" onClick={onPurchase}><CreditCard/>Registrar compra</button></div></section>
    {!cards.length ? <section className="panel"><div className="empty"><CreditCard/><strong>Nenhum cartão adicionado</strong><span>Cadastre apenas nome, limite e datas. Não pedimos dados reais.</span><button className="primary empty-action" onClick={onAdd}>Adicionar primeiro cartão</button></div></section> :
    <><section className="card-grid">{details.map(({ card, available, invoice, used }) => <article className={`credit-card ${card.color}`} key={card.id}><div className="card-top"><span>{card.name}</span><CreditCard/></div><div className="card-limit"><span>Limite disponível</span><strong>{money.format(available)}</strong><div className="limit-track"><i style={{ width: `${Math.min(100, (used / card.creditLimit) * 100)}%` }}/></div><small>{money.format(used)} usados de {money.format(card.creditLimit)}</small></div><div className="card-bottom"><span>•••• {card.lastFour}</span><span>Vence dia {card.dueDay}</span></div><div className="invoice-badge"><span>Fatura aproximada</span><b>{money.format(invoice)}</b></div></article>)}</section>
    <section className="panel card-purchases"><div className="panel-title"><div><h2>Compras no cartão</h2><p>À vista e parceladas</p></div></div>
      {!purchases.length ? <div className="empty"><WalletCards/><strong>Nenhuma compra registrada</strong><span>Use “Registrar compra” e escolha cartão de crédito.</span></div> :
      <div className="driver-table"><div className="purchase-row purchase-labels"><span>Compra</span><span>Cartão</span><span>Data</span><span>Parcelas</span><span>Valor total</span><span>Parcela</span><span></span></div>
      {purchases.map((p) => { const card = cards.find((x) => x.id === p.cardId); return <div className="purchase-row" key={p.id}><strong>{p.description}</strong><span>{card?.name ?? "Cartão"}</span><span>{new Date(p.purchaseDate + "T12:00:00").toLocaleDateString("pt-BR")}</span><span>{p.installments}x</span><span>{money.format(p.totalAmount)}</span><b>{money.format(p.totalAmount / p.installments)}</b><button className="edit-button" onClick={() => onEdit(p)} aria-label="Editar compra"><Pencil/></button></div>; })}</div>}
    </section></>}
  </div>;
}

function DriverView({ items, onAdd }: { items: DriverDay[]; onAdd: () => void }) {
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const startOfWeek = new Date(now); startOfWeek.setHours(0, 0, 0, 0); startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const net = (x: DriverDay) => x.grossEarnings - x.fuelCost - x.maintenanceCost - x.otherCost;
  const month = items.filter((x) => x.date.startsWith(monthKey));
  const week = items.filter((x) => new Date(x.date + "T12:00:00") >= startOfWeek);
  const total = (rows: DriverDay[], field: "gross" | "net" | "rides" | "km" | "fuel") => rows.reduce((s, x) => s + (field === "gross" ? x.grossEarnings : field === "net" ? net(x) : field === "rides" ? x.rides : field === "km" ? x.kilometers : x.fuelCost), 0);
  const costs = total(month, "gross") - total(month, "net");
  return <div className="driver-page">
    <section className="driver-head"><div><span>99 Motorista</span><h2>Seu trabalho dando lucro de verdade</h2><p>Ganhos menos combustível, manutenção e outros custos.</p></div><button className="driver-add" onClick={onAdd}><Plus/>Registrar dia</button></section>
    <section className="driver-summary">
      <article className="driver-profit"><span>Lucro líquido no mês</span><strong>{money.format(total(month, "net"))}</strong><small>Semana atual: {money.format(total(week, "net"))}</small></article>
      <article><div className="driver-icon"><CircleDollarSign/></div><span>Faturamento bruto</span><strong>{money.format(total(month, "gross"))}</strong></article>
      <article><div className="driver-icon orange"><Fuel/></div><span>Custos no mês</span><strong>{money.format(costs)}</strong></article>
      <article><div className="driver-icon cyan"><Car/></div><span>Corridas realizadas</span><strong>{total(month, "rides")}</strong></article>
    </section>
    <section className="driver-insights">
      <article><Gauge/><div><span>Ganho por km</span><strong>{total(month, "km") ? money.format(total(month, "gross") / total(month, "km")) : "—"}</strong></div></article>
      <article><Fuel/><div><span>Custo de combustível</span><strong>{money.format(total(month, "fuel"))}</strong></div></article>
      <article><Wrench/><div><span>Reserva para manutenção</span><strong>{money.format(month.reduce((s, x) => s + x.maintenanceCost, 0))}</strong></div></article>
    </section>
    <section className="panel driver-history"><div className="panel-title"><div><h2>Histórico de trabalho</h2><p>Resultado de cada dia registrado</p></div></div>
      {!items.length ? <div className="empty"><Car/><strong>Nenhum dia registrado</strong><span>Registre ganhos e custos para descobrir seu lucro real.</span></div> :
      <div className="driver-table"><div className="driver-row driver-labels"><span>Data</span><span>Corridas</span><span>Quilômetros</span><span>Ganho bruto</span><span>Custos</span><span>Lucro</span></div>
      {items.map((x) => <div className="driver-row" key={x.id}><strong>{new Date(x.date + "T12:00:00").toLocaleDateString("pt-BR")}</strong><span>{x.rides}</span><span>{x.kilometers.toLocaleString("pt-BR")} km</span><span>{money.format(x.grossEarnings)}</span><span className="expense">{money.format(x.fuelCost + x.maintenanceCost + x.otherCost)}</span><b className={net(x) >= 0 ? "income" : "expense"}>{money.format(net(x))}</b></div>)}</div>}
    </section>
  </div>;
}

function EditModal({ editing, onClose, onSave, onDelete }: { editing: { entity: "transaction" | "commitment" | "cardPurchase"; item: Tx | Commitment | CardPurchase }; onClose: () => void; onSave: (x: Record<string, unknown>) => Promise<void>; onDelete: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true);
    try { await onSave({ entity: editing.entity, id: editing.item.id, ...Object.fromEntries(new FormData(e.currentTarget).entries()) }); }
    finally { setSaving(false); }
  }
  const categories = <><option>Alimentação</option><option>Moradia</option><option>Transporte</option><option>Saúde</option><option>Lazer</option><option>Salário</option><option>Outros</option></>;
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}><div className="modal-head"><div><h2>Editar {editing.entity === "transaction" ? "movimentação" : editing.entity === "commitment" ? "conta ou parcela" : "compra no cartão"}</h2><p>As alterações atualizam seus cálculos automaticamente.</p></div><button type="button" onClick={onClose}><X/></button></div>
    {editing.entity === "transaction" && (() => { const item = editing.item as Tx; return <><label>Descrição<input name="description" required defaultValue={item.description}/></label><div className="form-grid"><label>Tipo<select name="type" defaultValue={item.type}><option value="expense">Despesa</option><option value="income">Receita</option></select></label><label>Valor<input name="amount" required min="0.01" step="0.01" type="number" defaultValue={item.amount}/></label></div><div className="form-grid"><label>Categoria<select name="category" defaultValue={item.category}>{categories}</select></label><label>Data<input name="date" required type="date" defaultValue={item.date}/></label></div></>; })()}
    {editing.entity === "commitment" && (() => { const item = editing.item as Commitment; return <><label>Nome<input name="name" required defaultValue={item.name}/></label><div className="form-grid"><label>Valor da parcela/conta<input name="amount" required min="0.01" step="0.01" type="number" defaultValue={item.amount}/></label><label>Vencimento atual<input name="dueDate" required type="date" defaultValue={item.dueDate}/></label></div><div className="form-grid"><label>Total de parcelas<input name="installmentsTotal" min="1" type="number" defaultValue={item.installmentsTotal ?? 1}/></label><label>Parcelas já pagas<input name="installmentsPaid" min="0" type="number" defaultValue={item.installmentsPaid ?? 0}/></label></div><label>Situação<select name="status" defaultValue={item.status}><option value="pending">Pendente</option><option value="paid">Pago</option></select></label></>; })()}
    {editing.entity === "cardPurchase" && (() => { const item = editing.item as CardPurchase; return <><label>Descrição<input name="description" required defaultValue={item.description}/></label><div className="form-grid"><label>Valor total<input name="totalAmount" required min="0.01" step="0.01" type="number" defaultValue={item.totalAmount}/></label><label>Quantidade de parcelas<input name="installments" required min="1" max="48" type="number" defaultValue={item.installments}/></label></div><div className="form-grid"><label>Categoria<select name="category" defaultValue={item.category}>{categories}</select></label><label>Data da compra<input name="purchaseDate" required type="date" defaultValue={item.purchaseDate}/></label></div></>; })()}
    {confirmingDelete && <p className="delete-warning">Toque novamente para confirmar. Esta ação não poderá ser desfeita.</p>}
    <div className="modal-actions split-actions"><button type="button" className={`delete-button ${confirmingDelete ? "confirming" : ""}`} disabled={deleting} onClick={async () => { if (!confirmingDelete) { setConfirmingDelete(true); return; } setDeleting(true); try { await onDelete(); } finally { setDeleting(false); } }}><Trash2/>{deleting ? "Excluindo..." : confirmingDelete ? "Confirmar exclusão" : "Excluir"}</button><div><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving || deleting}>{saving ? "Salvando..." : "Salvar alterações"}</button></div></div>
  </form></div>;
}

function Modal({ type, cards, onClose, onSave }: { type: "transaction" | "goal" | "commitment" | "driverDay" | "card"; cards: Card[]; onClose: () => void; onSave: (x: Record<string, unknown>) => Promise<void> }) {
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true);
    const values = Object.fromEntries(new FormData(e.currentTarget).entries());
    try { await onSave({ entity: type, ...values }); } finally { setSaving(false); }
  }
  const title = type === "transaction" ? "Novo lançamento" : type === "goal" ? "Nova meta" : type === "driverDay" ? "Registrar dia na 99" : type === "card" ? "Adicionar cartão" : "Nova conta ou dívida";
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}><div className="modal-head"><div><h2>{title}</h2><p>Preencha apenas as informações principais.</p></div><button type="button" onClick={onClose}><X/></button></div>
    {type === "transaction" && <><label>Descrição<input name="description" required placeholder="Ex.: Salário ou supermercado"/></label><div className="form-grid"><label>Tipo<select name="type"><option value="expense">Despesa</option><option value="income">Receita</option></select></label><label>Valor total<input name="amount" required min="0.01" step="0.01" type="number" placeholder="0,00"/></label></div><div className="form-grid"><label>Categoria<select name="category"><option>Alimentação</option><option>Moradia</option><option>Transporte</option><option>Saúde</option><option>Lazer</option><option>Salário</option><option>Outros</option></select></label><label>Data<input name="date" required type="date" defaultValue={today}/></label></div><label>Forma de pagamento<select name="paymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="cash">À vista / débito / Pix</option><option value="credit">Parcelado no cartão</option><option value="installment">Parcelado sem cartão</option></select></label>{paymentMethod === "credit" && <div className="credit-fields"><div className="form-grid"><label>Cartão<select name="cardId" required><option value="">Escolha o cartão</option>{cards.map((card) => <option value={card.id} key={card.id}>{card.name} •••• {card.lastFour}</option>)}</select></label><label>Parcelas<input name="installments" required min="1" max="48" type="number" defaultValue="1"/></label></div>{!cards.length && <p className="form-warning">Adicione um cartão antes de registrar uma compra parcelada.</p>}</div>}{paymentMethod === "installment" && <div className="credit-fields"><div className="form-grid"><label>Quantidade de parcelas<input name="installments" required min="2" max="60" type="number" defaultValue="2"/></label><label>Primeiro vencimento<input name="firstDueDate" required type="date" defaultValue={today}/></label></div><p className="installment-note">A compra aparecerá em Contas e dívidas com o valor de cada parcela.</p></div>}</>}
    {type === "goal" && <><label>Nome da meta<input name="name" required placeholder="Ex.: Reserva de emergência"/></label><div className="form-grid"><label>Valor da meta<input name="targetAmount" required min="1" step="0.01" type="number"/></label><label>Quanto já guardou<input name="savedAmount" min="0" step="0.01" type="number" defaultValue="0"/></label></div><label>Prazo desejado<input name="dueDate" type="date"/></label></>}
    {type === "commitment" && <><label>Nome<input name="name" required placeholder="Ex.: Fatura do cartão"/></label><div className="form-grid"><label>Tipo<select name="kind"><option value="bill">Conta</option><option value="debt">Dívida/parcelamento</option></select></label><label>Valor da parcela/conta<input name="amount" required min="0.01" step="0.01" type="number"/></label></div><div className="form-grid"><label>Vencimento<input name="dueDate" required type="date" defaultValue={today}/></label><label>Total de parcelas<input name="installmentsTotal" min="1" type="number" placeholder="Opcional"/></label></div></>}
    {type === "driverDay" && <><div className="form-grid"><label>Data<input name="date" required type="date" defaultValue={today}/></label><label>Ganho bruto<input name="grossEarnings" required min="0" step="0.01" type="number" placeholder="0,00"/></label></div><div className="form-grid"><label>Quantidade de corridas<input name="rides" required min="0" type="number" placeholder="0"/></label><label>Horas trabalhadas<input name="hoursWorked" min="0" step="0.1" type="number" placeholder="0"/></label></div><div className="form-grid"><label>KM ao iniciar<input name="odometerStart" required min="0" step="0.1" type="number" placeholder="Ex.: 45210"/></label><label>KM ao finalizar<input name="odometerEnd" required min="0" step="0.1" type="number" placeholder="Ex.: 45342"/></label></div><div className="form-grid"><label>Combustível<input name="fuelCost" min="0" step="0.01" type="number" placeholder="0,00"/></label><label>Manutenção/reserva<input name="maintenanceCost" min="0" step="0.01" type="number" placeholder="0,00"/></label></div><label>Outros custos<input name="otherCost" min="0" step="0.01" type="number" placeholder="0,00"/></label><label>Observação<input name="notes" placeholder="Opcional"/></label></>}
    {type === "card" && <><label>Nome do cartão<input name="name" required placeholder="Ex.: Cartão principal"/></label><div className="form-grid"><label>Últimos 4 números<input name="lastFour" required pattern="[0-9]{4}" maxLength={4} inputMode="numeric" placeholder="1234"/></label><label>Limite total<input name="creditLimit" required min="1" step="0.01" type="number" placeholder="0,00"/></label></div><div className="form-grid"><label>Dia do fechamento<input name="closingDay" required min="1" max="31" type="number" defaultValue="1"/></label><label>Dia do vencimento<input name="dueDay" required min="1" max="31" type="number" defaultValue="10"/></label></div><label>Cor do cartão<select name="color"><option value="blue">Azul</option><option value="black">Preto</option><option value="purple">Roxo</option><option value="green">Verde</option></select></label></>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button></div>
  </form></div>;
}

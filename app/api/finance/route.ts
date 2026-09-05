import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { cardPurchases, commitments, creditCards, driverDays, goals, transactions } from "../../../db/schema";

async function userId() {
  const h = await headers();
  return h.get("oai-authenticated-user-id") ?? h.get("oai-authenticated-user-email") ?? "owner";
}

export async function GET() {
  try {
    const uid = await userId();
    const db = getDb();
    const [tx, goalRows, commitmentRows, driverRows, cardRows, purchaseRows] = await Promise.all([
      db.select().from(transactions).where(eq(transactions.userId, uid)).orderBy(desc(transactions.date), desc(transactions.id)).limit(250),
      db.select().from(goals).where(eq(goals.userId, uid)),
      db.select().from(commitments).where(eq(commitments.userId, uid)).orderBy(commitments.dueDate),
      db.select().from(driverDays).where(eq(driverDays.userId, uid)).orderBy(desc(driverDays.date), desc(driverDays.id)).limit(365),
      db.select().from(creditCards).where(eq(creditCards.userId, uid)).orderBy(desc(creditCards.id)),
      db.select().from(cardPurchases).where(eq(cardPurchases.userId, uid)).orderBy(desc(cardPurchases.purchaseDate), desc(cardPurchases.id)).limit(500),
    ]);
    return Response.json({ transactions: tx, goals: goalRows, commitments: commitmentRows, driverDays: driverRows, cards: cardRows, cardPurchases: purchaseRows });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível carregar seus dados." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const uid = await userId();
    const body = await request.json() as Record<string, unknown>;
    const entity = String(body.entity ?? "");
    const db = getDb();
    if (entity === "transaction" || entity === "transactions") {
      const incoming = entity === "transactions" ? body.items : [body];
      if (!Array.isArray(incoming) || !incoming.length) return Response.json({ error: "Nenhum lançamento informado." }, { status: 400 });
      const values = incoming.slice(0, 500).map((item: any) => ({
        userId: uid,
        description: String(item.description || "Movimentação").trim(),
        amount: Math.abs(Number(item.amount)) / Math.max(1, Number(item.installments || 1)),
        type: item.type === "income" ? "income" as const : "expense" as const,
        category: String(item.category || "Outros"),
        date: String(item.date || new Date().toISOString().slice(0, 10)),
      })).filter((item) => Number.isFinite(item.amount) && item.amount > 0);
      if (!values.length) return Response.json({ error: "Valores inválidos." }, { status: 400 });
      if (entity === "transaction" && body.paymentMethod === "installment") {
        const installmentCount = Math.max(2, Number(body.installments || 2));
        await db.insert(commitments).values({
          userId: uid,
          name: String(body.description) + " · parcelado",
          kind: "debt",
          amount: Math.abs(Number(body.amount)) / installmentCount,
          dueDate: String(body.firstDueDate || body.date),
          installmentsTotal: installmentCount,
          installmentsPaid: 0,
          status: "pending",
        });
      } else {
        await db.insert(transactions).values(values);
      }
      if (entity === "transaction" && body.paymentMethod === "credit" && body.cardId) {
        const cardId = Number(body.cardId);
        const owned = await db.select({ id: creditCards.id }).from(creditCards).where(and(eq(creditCards.id, cardId), eq(creditCards.userId, uid))).limit(1);
        if (!owned.length) return Response.json({ error: "Cartão inválido." }, { status: 400 });
        await db.insert(cardPurchases).values({ userId: uid, cardId, description: String(body.description), totalAmount: Math.abs(Number(body.amount)), installments: Math.max(1, Number(body.installments || 1)), purchaseDate: String(body.date), category: String(body.category || "Outros") });
      }
    } else if (entity === "driverDay") {
      const gross = Number(body.grossEarnings);
      const fuel = Number(body.fuelCost || 0);
      const maintenance = Number(body.maintenanceCost || 0);
      const other = Number(body.otherCost || 0);
      if (!Number.isFinite(gross) || gross < 0) return Response.json({ error: "Informe um ganho válido." }, { status: 400 });
      const odometerStart = Number(body.odometerStart || 0);
      const odometerEnd = Number(body.odometerEnd || 0);
      if (odometerEnd < odometerStart) return Response.json({ error: "A quilometragem final deve ser maior que a inicial." }, { status: 400 });
      await db.insert(driverDays).values({
        userId: uid, date: String(body.date), grossEarnings: gross,
        rides: Number(body.rides || 0), hoursWorked: Number(body.hoursWorked || 0),
        odometerStart, odometerEnd, kilometers: odometerEnd - odometerStart, fuelCost: fuel,
        maintenanceCost: maintenance, otherCost: other, notes: String(body.notes || ""),
      });
      const net = gross - fuel - maintenance - other;
      if (net > 0) await db.insert(transactions).values({ userId: uid, description: "Lucro 99 Motorista", amount: net, type: "income", category: "99 Motorista", date: String(body.date) });
    } else if (entity === "card") {
      const limit = Number(body.creditLimit);
      if (!Number.isFinite(limit) || limit <= 0) return Response.json({ error: "Informe um limite válido." }, { status: 400 });
      await db.insert(creditCards).values({ userId: uid, name: String(body.name), lastFour: String(body.lastFour || "0000").slice(-4), color: String(body.color || "blue"), creditLimit: limit, closingDay: Number(body.closingDay || 1), dueDay: Number(body.dueDay || 10) });
    } else if (entity === "goal") {
      await db.insert(goals).values({ userId: uid, name: String(body.name), targetAmount: Number(body.targetAmount), savedAmount: Number(body.savedAmount || 0), dueDate: body.dueDate ? String(body.dueDate) : null });
    } else if (entity === "commitment") {
      await db.insert(commitments).values({ userId: uid, name: String(body.name), kind: body.kind === "debt" ? "debt" : "bill", amount: Number(body.amount), dueDate: String(body.dueDate), installmentsTotal: body.installmentsTotal ? Number(body.installmentsTotal) : null, installmentsPaid: body.installmentsPaid ? Number(body.installmentsPaid) : 0 });
    } else {
      return Response.json({ error: "Tipo de registro inválido." }, { status: 400 });
    }
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível salvar." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const uid = await userId();
  const body = await request.json() as Record<string, unknown>;
  if (!body.id) return Response.json({ error: "Registro inválido." }, { status: 400 });
  const id = Number(body.id);
  const db = getDb();
  try {
    if (body.entity === "transaction") {
      const amount = Math.abs(Number(body.amount));
      if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: "Informe um valor válido." }, { status: 400 });
      await db.update(transactions).set({ description: String(body.description), amount, category: String(body.category), date: String(body.date), type: body.type === "income" ? "income" : "expense" }).where(and(eq(transactions.id, id), eq(transactions.userId, uid)));
    } else if (body.entity === "cardPurchase") {
      const totalAmount = Math.abs(Number(body.totalAmount));
      const installmentCount = Math.max(1, Number(body.installments || 1));
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) return Response.json({ error: "Informe um valor válido." }, { status: 400 });
      await db.update(cardPurchases).set({ description: String(body.description), totalAmount, installments: installmentCount, purchaseDate: String(body.purchaseDate), category: String(body.category) }).where(and(eq(cardPurchases.id, id), eq(cardPurchases.userId, uid)));
    } else if (body.entity === "commitment") {
      const rows = await db.select().from(commitments).where(and(eq(commitments.id, id), eq(commitments.userId, uid))).limit(1);
      const current = rows[0];
      if (!current) return Response.json({ error: "Registro não encontrado." }, { status: 404 });
      if (body.action === "pay") {
        const total = current.installmentsTotal ?? 1;
        const paid = Math.min(total, (current.installmentsPaid ?? 0) + 1);
        const due = new Date(current.dueDate + "T12:00:00");
        due.setMonth(due.getMonth() + 1);
        await db.update(commitments).set({ installmentsPaid: paid, status: paid >= total ? "paid" : "pending", dueDate: due.toISOString().slice(0, 10) }).where(and(eq(commitments.id, id), eq(commitments.userId, uid)));
      } else {
        const amount = Math.abs(Number(body.amount));
        const total = body.installmentsTotal ? Math.max(1, Number(body.installmentsTotal)) : null;
        const paid = Math.min(total ?? 1, Math.max(0, Number(body.installmentsPaid || 0)));
        await db.update(commitments).set({ name: String(body.name), amount, dueDate: String(body.dueDate), installmentsTotal: total, installmentsPaid: paid, status: body.status === "paid" || (total && paid >= total) ? "paid" : "pending" }).where(and(eq(commitments.id, id), eq(commitments.userId, uid)));
      }
    } else {
      return Response.json({ error: "Tipo de edição inválido." }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível atualizar." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const uid = await userId();
  const body = await request.json() as { entity?: string; id?: number };
  if (!body.id) return Response.json({ error: "Registro inválido." }, { status: 400 });
  const id = Number(body.id);
  const db = getDb();
  try {
    if (body.entity === "transaction") {
      await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, uid)));
    } else if (body.entity === "commitment") {
      await db.delete(commitments).where(and(eq(commitments.id, id), eq(commitments.userId, uid)));
    } else if (body.entity === "cardPurchase") {
      await db.delete(cardPurchases).where(and(eq(cardPurchases.id, id), eq(cardPurchases.userId, uid)));
    } else {
      return Response.json({ error: "Tipo de registro inválido." }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível excluir." }, { status: 500 });
  }
}

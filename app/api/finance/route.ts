import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Authenticated = { db: SupabaseClient; uid: string };
async function authenticate(request: Request): Promise<Authenticated | Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return Response.json({ error: "Entre na sua conta novamente." }, { status: 401 });
  const db = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  return { db, uid: data.user.id };
}
function failed(error: unknown, fallback: string) { const message = typeof error === "object" && error && "message" in error ? String(error.message) : fallback; return Response.json({ error: message }, { status: 500 }); }
const tx = (x: any) => ({ id:x.id, description:x.description, amount:x.amount, type:x.type, category:x.category, date:x.date });
const goal = (x: any) => ({ id:x.id, name:x.name, targetAmount:x.target_amount, savedAmount:x.saved_amount, dueDate:x.due_date });
const commitment = (x: any) => ({ id:x.id, name:x.name, kind:x.kind, amount:x.amount, dueDate:x.due_date, installmentsTotal:x.installments_total, installmentsPaid:x.installments_paid, status:x.status });
const driver = (x: any) => ({ id:x.id, date:x.date, grossEarnings:x.gross_earnings, rides:x.rides, hoursWorked:x.hours_worked, odometerStart:x.odometer_start, odometerEnd:x.odometer_end, kilometers:x.kilometers, fuelCost:x.fuel_cost, maintenanceCost:x.maintenance_cost, otherCost:x.other_cost, notes:x.notes });
const card = (x: any) => ({ id:x.id, name:x.name, lastFour:x.last_four, color:x.color, creditLimit:x.credit_limit, closingDay:x.closing_day, dueDay:x.due_day });
const purchase = (x: any) => ({ id:x.id, cardId:x.card_id, description:x.description, totalAmount:x.total_amount, installments:x.installments, purchaseDate:x.purchase_date, category:x.category });

export async function GET(request: Request) {
  const auth = await authenticate(request); if (auth instanceof Response) return auth;
  try { const { db } = auth; const results = await Promise.all([
    db.from("transactions").select("*").order("date",{ascending:false}).order("id",{ascending:false}).limit(250), db.from("goals").select("*"), db.from("commitments").select("*").order("due_date"), db.from("driver_days").select("*").order("date",{ascending:false}).order("id",{ascending:false}).limit(365), db.from("credit_cards").select("*").order("id",{ascending:false}), db.from("card_purchases").select("*").order("purchase_date",{ascending:false}).order("id",{ascending:false}).limit(500)
  ]); const error=results.find(r=>r.error)?.error;if(error)throw error;return Response.json({transactions:(results[0].data||[]).map(tx),goals:(results[1].data||[]).map(goal),commitments:(results[2].data||[]).map(commitment),driverDays:(results[3].data||[]).map(driver),cards:(results[4].data||[]).map(card),cardPurchases:(results[5].data||[]).map(purchase)}); } catch(error){return failed(error,"Não foi possível carregar seus dados.");}
}

export async function POST(request: Request) {
  const auth=await authenticate(request);if(auth instanceof Response)return auth;
  try {const {db,uid}=auth,body=await request.json() as Record<string,any>,entity=String(body.entity||"");
    if(entity==="transaction"||entity==="transactions"){
      const incoming=entity==="transactions"?body.items:[body];if(!Array.isArray(incoming)||!incoming.length)return Response.json({error:"Nenhum lançamento informado."},{status:400});
      const values=incoming.slice(0,500).map((item:any)=>({user_id:uid,description:String(item.description||"Movimentação").trim(),amount:Math.abs(Number(item.amount))/Math.max(1,Number(item.installments||1)),type:item.type==="income"?"income":"expense",category:String(item.category||"Outros"),date:String(item.date||new Date().toISOString().slice(0,10))})).filter((item:any)=>Number.isFinite(item.amount)&&item.amount>0);if(!values.length)return Response.json({error:"Valores inválidos."},{status:400});
      if(entity==="transaction"&&body.paymentMethod==="installment"){const count=Math.max(2,Number(body.installments||2));const {error}=await db.from("commitments").insert({user_id:uid,name:String(body.description)+" · parcelado",kind:"debt",amount:Math.abs(Number(body.amount))/count,due_date:String(body.firstDueDate||body.date),installments_total:count,installments_paid:0,status:"pending"});if(error)throw error;}else{const {error}=await db.from("transactions").insert(values);if(error)throw error;}
      if(entity==="transaction"&&body.paymentMethod==="credit"&&body.cardId){const cardId=Number(body.cardId),{data:owned,error:cardError}=await db.from("credit_cards").select("id").eq("id",cardId).eq("user_id",uid).maybeSingle();if(cardError)throw cardError;if(!owned)return Response.json({error:"Cartão inválido."},{status:400});const {error}=await db.from("card_purchases").insert({user_id:uid,card_id:cardId,description:String(body.description),total_amount:Math.abs(Number(body.amount)),installments:Math.max(1,Number(body.installments||1)),purchase_date:String(body.date),category:String(body.category||"Outros")});if(error)throw error;}
    }else if(entity==="driverDay"){
      const gross=Number(body.grossEarnings),fuel=Number(body.fuelCost||0),maintenance=Number(body.maintenanceCost||0),other=Number(body.otherCost||0),start=Number(body.odometerStart||0),end=Number(body.odometerEnd||0);if(!Number.isFinite(gross)||gross<0)return Response.json({error:"Informe um ganho válido."},{status:400});if(end<start)return Response.json({error:"A quilometragem final deve ser maior que a inicial."},{status:400});
      const {error}=await db.from("driver_days").insert({user_id:uid,date:String(body.date),gross_earnings:gross,rides:Number(body.rides||0),hours_worked:Number(body.hoursWorked||0),odometer_start:start,odometer_end:end,kilometers:end-start,fuel_cost:fuel,maintenance_cost:maintenance,other_cost:other,notes:String(body.notes||"")});if(error)throw error;const net=gross-fuel-maintenance-other;if(net>0){const {error:e}=await db.from("transactions").insert({user_id:uid,description:"Lucro 99 Motorista",amount:net,type:"income",category:"99 Motorista",date:String(body.date)});if(e)throw e;}
    }else if(entity==="card"){const limit=Number(body.creditLimit);if(!Number.isFinite(limit)||limit<=0)return Response.json({error:"Informe um limite válido."},{status:400});const {error}=await db.from("credit_cards").insert({user_id:uid,name:String(body.name),last_four:String(body.lastFour||"0000").slice(-4),color:String(body.color||"blue"),credit_limit:limit,closing_day:Number(body.closingDay||1),due_day:Number(body.dueDay||10)});if(error)throw error;
    }else if(entity==="goal"){const {error}=await db.from("goals").insert({user_id:uid,name:String(body.name),target_amount:Number(body.targetAmount),saved_amount:Number(body.savedAmount||0),due_date:body.dueDate?String(body.dueDate):null});if(error)throw error;
    }else if(entity==="commitment"){const {error}=await db.from("commitments").insert({user_id:uid,name:String(body.name),kind:body.kind==="debt"?"debt":"bill",amount:Number(body.amount),due_date:String(body.dueDate),installments_total:body.installmentsTotal?Number(body.installmentsTotal):null,installments_paid:body.installmentsPaid?Number(body.installmentsPaid):0,status:"pending"});if(error)throw error;
    }else return Response.json({error:"Tipo de registro inválido."},{status:400});return Response.json({ok:true},{status:201});
  }catch(error){return failed(error,"Não foi possível salvar.");}
}

export async function PATCH(request: Request) {
  const auth=await authenticate(request);if(auth instanceof Response)return auth;
  try{const {db,uid}=auth,body=await request.json() as Record<string,any>,id=Number(body.id);if(!id)return Response.json({error:"Registro inválido."},{status:400});
    if(body.entity==="transaction"){const amount=Math.abs(Number(body.amount));if(!Number.isFinite(amount)||amount<=0)return Response.json({error:"Informe um valor válido."},{status:400});const {error}=await db.from("transactions").update({description:String(body.description),amount,category:String(body.category),date:String(body.date),type:body.type==="income"?"income":"expense"}).eq("id",id).eq("user_id",uid);if(error)throw error;
    }else if(body.entity==="cardPurchase"){const amount=Math.abs(Number(body.totalAmount));if(!Number.isFinite(amount)||amount<=0)return Response.json({error:"Informe um valor válido."},{status:400});const {error}=await db.from("card_purchases").update({description:String(body.description),total_amount:amount,installments:Math.max(1,Number(body.installments||1)),purchase_date:String(body.purchaseDate),category:String(body.category)}).eq("id",id).eq("user_id",uid);if(error)throw error;
    }else if(body.entity==="commitment"){const {data:current,error:readError}=await db.from("commitments").select("*").eq("id",id).eq("user_id",uid).maybeSingle();if(readError)throw readError;if(!current)return Response.json({error:"Registro não encontrado."},{status:404});let changes:any;if(body.action==="pay"){const total=current.installments_total??1,paid=Math.min(total,(current.installments_paid??0)+1),due=new Date(current.due_date+"T12:00:00");due.setMonth(due.getMonth()+1);changes={installments_paid:paid,status:paid>=total?"paid":"pending",due_date:due.toISOString().slice(0,10)};}else{const total=body.installmentsTotal?Math.max(1,Number(body.installmentsTotal)):null,paid=Math.min(total??1,Math.max(0,Number(body.installmentsPaid||0)));changes={name:String(body.name),amount:Math.abs(Number(body.amount)),due_date:String(body.dueDate),installments_total:total,installments_paid:paid,status:body.status==="paid"||(total&&paid>=total)?"paid":"pending"};}const {error}=await db.from("commitments").update(changes).eq("id",id).eq("user_id",uid);if(error)throw error;
    }else return Response.json({error:"Tipo de edição inválido."},{status:400});return Response.json({ok:true});
  }catch(error){return failed(error,"Não foi possível atualizar.");}
}

export async function DELETE(request: Request) {
  const auth=await authenticate(request);if(auth instanceof Response)return auth;
  try{const {db,uid}=auth,body=await request.json() as {entity?:string;id?:number};if(!body.id)return Response.json({error:"Registro inválido."},{status:400});const table=body.entity==="transaction"?"transactions":body.entity==="commitment"?"commitments":body.entity==="cardPurchase"?"card_purchases":null;if(!table)return Response.json({error:"Tipo de registro inválido."},{status:400});const {error}=await db.from(table).delete().eq("id",Number(body.id)).eq("user_id",uid);if(error)throw error;return Response.json({ok:true});}catch(error){return failed(error,"Não foi possível excluir.");}
}

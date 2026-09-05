import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  category: text("category").notNull().default("Outros"),
  date: text("date").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_transactions_user_date").on(table.userId, table.date)]);

export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  targetAmount: real("target_amount").notNull(),
  savedAmount: real("saved_amount").notNull().default(0),
  dueDate: text("due_date"),
}, (table) => [index("idx_goals_user").on(table.userId)]);

export const commitments = sqliteTable("commitments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["bill", "debt"] }).notNull(),
  amount: real("amount").notNull(),
  dueDate: text("due_date").notNull(),
  installmentsTotal: integer("installments_total"),
  installmentsPaid: integer("installments_paid").default(0),
  status: text("status", { enum: ["pending", "paid"] }).notNull().default("pending"),
}, (table) => [index("idx_commitments_user_due").on(table.userId, table.dueDate)]);

export const driverDays = sqliteTable("driver_days", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  grossEarnings: real("gross_earnings").notNull(),
  rides: integer("rides").notNull().default(0),
  hoursWorked: real("hours_worked").notNull().default(0),
  odometerStart: real("odometer_start").notNull().default(0),
  odometerEnd: real("odometer_end").notNull().default(0),
  kilometers: real("kilometers").notNull().default(0),
  fuelCost: real("fuel_cost").notNull().default(0),
  maintenanceCost: real("maintenance_cost").notNull().default(0),
  otherCost: real("other_cost").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_driver_days_user_date").on(table.userId, table.date)]);

export const creditCards = sqliteTable("credit_cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  lastFour: text("last_four").notNull().default("0000"),
  color: text("color").notNull().default("blue"),
  creditLimit: real("credit_limit").notNull(),
  closingDay: integer("closing_day").notNull().default(1),
  dueDay: integer("due_day").notNull().default(10),
}, (table) => [index("idx_credit_cards_user").on(table.userId)]);

export const cardPurchases = sqliteTable("card_purchases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  cardId: integer("card_id").notNull().references(() => creditCards.id),
  description: text("description").notNull(),
  totalAmount: real("total_amount").notNull(),
  installments: integer("installments").notNull().default(1),
  purchaseDate: text("purchase_date").notNull(),
  category: text("category").notNull().default("Outros"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_card_purchases_user_card").on(table.userId, table.cardId)]);

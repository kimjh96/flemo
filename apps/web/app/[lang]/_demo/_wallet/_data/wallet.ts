// Fake data for the wallet demo (a clean money app, Toss/shiflo sibling tone).
// Amounts are KRW; negative = spent, positive = received.
export interface Tx {
  id: string;
  merchant: string;
  emoji: string;
  amount: number;
  time: string;
  day: "today" | "yesterday";
}

export const BALANCE = 482000;

export const TRANSACTIONS: Tx[] = [
  { id: "1", merchant: "Starbucks", emoji: "☕", amount: -5800, time: "14:32", day: "today" },
  { id: "2", merchant: "Netflix", emoji: "🎬", amount: -13500, time: "09:10", day: "today" },
  { id: "3", merchant: "Jamie Park", emoji: "💸", amount: 50000, time: "08:45", day: "today" },
  { id: "4", merchant: "Uber", emoji: "🚕", amount: -12300, time: "22:18", day: "yesterday" },
  { id: "5", merchant: "App Store", emoji: "📱", amount: -1290, time: "16:02", day: "yesterday" },
  { id: "6", merchant: "GS25", emoji: "🏪", amount: -8400, time: "12:30", day: "yesterday" },
  { id: "7", merchant: "Salary", emoji: "🏦", amount: 2600000, time: "10:00", day: "yesterday" }
];

export function txById(id: string): Tx | undefined {
  return TRANSACTIONS.find((tx) => tx.id === id);
}

export function formatWon(amount: number): string {
  const sign = amount < 0 ? "-" : amount > 0 ? "+" : "";
  return `${sign}₩${Math.abs(amount).toLocaleString("ko-KR")}`;
}

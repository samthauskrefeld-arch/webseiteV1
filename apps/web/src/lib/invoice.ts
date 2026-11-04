export interface InvoiceRow {
  id: string;
  number: string;
  kind: "INVOICE" | "CANCELLATION";
  description: string;
  issueDate: string;
  dueDate: string;
  grossCents: number;
  status: "OPEN" | "PAID" | "CANCELLED" | "REFUNDED";
  isTest: boolean;
}
export const STATUS_LABEL = { OPEN: "offen", PAID: "bezahlt", CANCELLED: "storniert", REFUNDED: "erstattet" } as const;


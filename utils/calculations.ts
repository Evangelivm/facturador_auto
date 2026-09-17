import { InvoiceItem } from '@/types';

export const round = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export const calculateItemTotals = (
  cantidad: number,
  valorUnitario: number, // Price EXCLUDING IGV
  igvPercent: number = 18
): Partial<InvoiceItem> => {

  const subtotal = round(valorUnitario * cantidad);
  const igv = round(subtotal * (igvPercent / 100));
  const total = round(subtotal + igv);

  // Calculate price per unit including tax (for reference)
  const precio_unitario = round(total / cantidad);

  return {
    cantidad,
    valor_unitario: valorUnitario,
    precio_unitario,
    subtotal,
    igv,
    total,
    tipo_de_igv: 1 // Default to Gravado
  };
};

export const calculateInvoiceTotals = (items: InvoiceItem[]) => {
  const total_gravada = round(items.reduce((acc, item) => acc + item.subtotal, 0));
  const total_igv = round(items.reduce((acc, item) => acc + item.igv, 0));
  const total = round(items.reduce((acc, item) => acc + item.total, 0));

  return {
    total_gravada,
    total_igv,
    total
  };
};

// Returns DD/MM/YYYY for Text Input
export const getTodayForInput = (): string => {
  const date = new Date();
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Converts various formats to DD-MM-YYYY (API/Sunat)
export const formatToSunatDate = (dateStr: string): string => {
  if (!dateStr) return "";

  // If already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;

  // If DD/MM/YYYY -> Replace / with -
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr.replace(/\//g, '-');

  // If YYYY-MM-DD -> Flip
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  return dateStr;
};

// Kept for backward compatibility
export const formatDate = (date: Date): string => {
   return date.toISOString().split('T')[0];
};

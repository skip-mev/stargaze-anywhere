export interface Ask {
  sale_type: "auction" | "fixed_price";
  collection: string;
  token_id: number;
  seller: string;
  price: string;
  funds_recipient?: string;
  reserve_for?: string;
  finders_fee_bps?: number;
  expires_at: string;
  is_active: boolean;
}

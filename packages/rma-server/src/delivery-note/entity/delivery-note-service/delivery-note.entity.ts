import { Entity, Column, ObjectID, BaseEntity, ObjectIdColumn } from 'typeorm';

@Entity()
export class DeliveryNote extends BaseEntity {
  @ObjectIdColumn()
  _id: ObjectID;

  @Column()
  uuid: string;

  @Column()
  isSynced: boolean;

  @Column()
  name: string;

  @Column()
  modified_by: string;

  @Column()
  docstatus: number;

  @Column()
  title: string;

  @Column()
  naming_series: string;

  @Column()
  customer: string;

  @Column()
  customer_name: string;

  @Column()
  company: string;

  @Column()
  posting_date: string;

  @Column()
  posting_time: string;

  @Column()
  is_return: number;

  @Column()
  currency: string;

  @Column()
  conversion_rate: number;

  @Column()
  total_qty: number;

  @Column()
  base_total: number;

  @Column()
  base_net_total: number;

  @Column()
  total: number;

  @Column()
  net_total: number;

  @Column()
  base_grand_total: number;

  @Column()
  customer_group: string;

  @Column()
  territory: string;

  @Column()
  items: DeliveryNoteItems[];

  @Column()
  pricing_rules: DeliveryNotePricingRules[];

  @Column()
  packed_items: DeliveryNotePackedItems[];

  @Column()
  taxes: DeliveryNoteTaxes[];

  @Column()
  sales_team: DeliveryNoteSalesTeam[];
}
export class DeliveryNoteItems {
  name: string;
  item_code: string;
  item_name: string;
  description: string;
  is_nil_exempt: number;
  is_non_gst: number;
  item_group: string;
  image: string;
  qty: number;
  conversion_factor: number;
  stock_qty: number;
  price_list_rate: number;
  base_price_list_rate: number;
  rate: number;
  amount: number;
}
export class DeliveryNoteTaxes {
  name: string;
  docstatus: number;
  charge_type: string;
  account_head: string;
  description: string;
  cost_center: string;
  rate: number;
  tax_amount: number;
  total: number;
}
export class DeliveryNotePricingRules {}
export class DeliveryNotePackedItems {}
export class DeliveryNoteSalesTeam {}
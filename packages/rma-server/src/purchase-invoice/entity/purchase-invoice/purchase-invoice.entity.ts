import { Column, ObjectIdColumn, BaseEntity, ObjectID, Entity } from 'typeorm';

@Entity()
export class PurchaseInvoice extends BaseEntity {
  @ObjectIdColumn()
  _id: ObjectID;

  @Column()
  uuid: string;

  @Column()
  docstatus: number;

  @Column()
  is_paid: number;

  @Column()
  is_return: number;

  @Column()
  update_stock: number;

  @Column()
  total_qty: number;

  @Column()
  base_total: number;

  @Column()
  total: number;

  @Column()
  total_advance: number;

  @Column()
  outstanding_amount: number;

  @Column()
  paid_amount: number;

  @Column()
  name: string;

  @Column()
  title: string;

  @Column()
  supplier: string;

  @Column()
  supplier_name: string;

  @Column()
  naming_series: string;

  @Column()
  due_date: string;

  @Column()
  company: string;

  @Column()
  posting_date: string;

  @Column()
  posting_time: string;

  @Column()
  supplier_address: string;

  @Column()
  address_display: string;

  @Column()
  buying_price_list: string;

  @Column()
  in_words: string;

  @Column()
  credit_to: string;

  @Column()
  against_expense_account: string;

  @Column()
  items: PurchaseInvoiceItem[];

  @Column()
  pricing_rules: any[];

  @Column()
  supplied_items: any[];

  @Column()
  taxes: any[];

  @Column()
  advances: PurchaseInvoiceAdvances[];

  @Column()
  payment_schedule: PurchaseInvoicePaymentSchedule[];

  @Column()
  status: string;

  @Column()
  submitted: boolean;

  @Column()
  inQueue: boolean;

  @Column()
  isSynced: boolean;
}

export class PurchaseInvoicePaymentSchedule {
  name: string;
  due_date: string;
  invoice_portion: number;
  payment_amount: number;
}

export class PurchaseInvoiceAdvances {
  name: string;
  parenttype: string;
  reference_type: string;
  reference_name: string;
  reference_row: string;
  advance_amount: number;
  allocated_amount: number;
}

export class PurchaseInvoiceItem {
  name: string;
  item_code: string;
  item_name: string;
  description: string;
  item_group: string;
  image: string;
  warehouse: string;
  serial_no: string;
  expense_account: string;
  cost_center: string;
  received_qty: number;
  qty: number;
  rejected_qty: number;
  rate: number;
  amount: number;
}
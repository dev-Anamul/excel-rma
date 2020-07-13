import {
  IsNotEmpty,
  IsString,
  ValidateNested,
  IsNumber,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssignSerialDto {
  @IsNotEmpty()
  @IsString()
  sales_invoice_name: string;

  @IsNotEmpty()
  @IsString()
  set_warehouse: string;

  @IsNotEmpty()
  @IsNumber()
  total_qty: number;

  @IsNotEmpty()
  @IsNumber()
  total: number;

  @IsNotEmpty()
  @IsString()
  posting_date: string;

  @IsNotEmpty()
  @IsString()
  posting_time: string;

  @IsNotEmpty()
  @IsString()
  customer: string;

  @IsNotEmpty()
  @IsString()
  company: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => DeliveryNoteItemDto)
  items: DeliveryNoteItemDto[];
}

export class DeliveryNoteItemDto {
  @IsNotEmpty()
  @IsString()
  item_code: string;

  @IsNotEmpty()
  @IsString()
  item_name: string;

  @IsNotEmpty()
  @IsNumber()
  qty: number;

  @IsNotEmpty()
  @IsNumber()
  rate: number;

  @IsNotEmpty()
  @IsNumber()
  has_serial_no: number;

  @IsNotEmpty()
  @IsString()
  against_sales_invoice: string;

  @IsNotEmpty()
  @IsString()
  warranty_date: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsArray()
  serial_no: any;
}

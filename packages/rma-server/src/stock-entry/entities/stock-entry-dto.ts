import { STOCK_ENTRY } from '../../constants/app-strings';
import {
  IsNotEmpty,
  IsString,
  ValidateNested,
  IsNumber,
  IsOptional,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StockEntryDto {
  docstatus?: 1;
  @IsOptional()
  @IsString()
  uuid?: string;

  @IsNotEmpty()
  @IsString()
  stock_entry_type: string;

  @IsNotEmpty()
  @IsString()
  company: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  customer?: string;

  @IsOptional()
  @IsString()
  remarks: string;

  @IsNotEmpty()
  @IsString()
  posting_date: string;

  @IsNotEmpty()
  @IsString()
  posting_time: string;

  @IsNotEmpty()
  @IsString()
  territory: string;

  @IsNotEmpty()
  @IsString()
  doctype: string = STOCK_ENTRY;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => StockEntryItemDto)
  items: StockEntryItemDto[];
}

export class StockEntryItemDto {
  @IsOptional()
  @IsString()
  s_warehouse: string;

  @IsOptional()
  @IsString()
  basic_rate?: number;

  @IsNotEmpty()
  @IsString()
  t_warehouse: string;

  @IsNotEmpty()
  @IsString()
  transferWarehouse: string;

  @IsNotEmpty()
  @IsString()
  item_code: string;

  @IsNotEmpty()
  @IsNumber()
  has_serial_no: number;

  @IsNotEmpty()
  @IsString()
  item_name: string;

  @IsOptional()
  @IsString()
  warranty_date?: string;

  @IsNotEmpty()
  @IsNumber()
  qty: number;

  @IsNotEmpty()
  @IsArray()
  serial_no: string[];

  @IsOptional()
  @IsString()
  expense_account?: string;
}

import { IsOptional } from 'class-validator';

export class SerialQuantityListQueryDto {
  @IsOptional()
  offset: number;

  @IsOptional()
  limit: number;

  @IsOptional()
  filter_query: string;

  @IsOptional()
  sort: string;
}

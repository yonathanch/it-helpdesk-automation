import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  content: string;

  /** true = catatan internal, hanya terlihat agen/admin */
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}

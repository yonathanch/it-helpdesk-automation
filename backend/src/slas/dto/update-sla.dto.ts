import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateSlaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  responseMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  resolutionMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ApproveDraftDto {
  /**
   * Isi final balasan. Opsional — jika kosong memakai draft tersimpan
   * (ticket.aiDraft). Agen bisa mengedit draft sebelum kirim.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content?: string;
}

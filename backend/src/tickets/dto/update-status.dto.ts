import { TicketStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateStatusDto {
  @IsEnum(TicketStatus)
  status: TicketStatus;
}

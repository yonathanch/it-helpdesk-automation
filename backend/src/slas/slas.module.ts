import { Module } from '@nestjs/common';
import { SlasController } from './slas.controller';
import { SlasService } from './slas.service';

@Module({
  controllers: [SlasController],
  providers: [SlasService],
  exports: [SlasService],
})
export class SlasModule {}

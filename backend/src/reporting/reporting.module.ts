import { Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { SurveyController } from './survey.controller';
import { SurveyService } from './survey.service';

@Module({
  controllers: [ReportingController, SurveyController],
  providers: [ReportingService, SurveyService, ExportService],
  exports: [ReportingService, SurveyService, ExportService],
})
export class ReportingModule {}

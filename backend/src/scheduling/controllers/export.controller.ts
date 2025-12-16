import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Response } from 'express';

import { ExportService } from '../services/export.service';

@ApiTags('Schedule Export')
@Controller('scheduling/export')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('schedule/:scheduleId/pdf')
  @ApiOperation({ summary: 'Export schedule to PDF' })
  @ApiResponse({ status: 200, description: 'PDF file generated successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID to export' })
  @ApiQuery({ name: 'pageSize', required: false, enum: ['A4', 'A3', 'Letter'] })
  @ApiQuery({ name: 'orientation', required: false, enum: ['portrait', 'landscape'] })
  @ApiQuery({ name: 'includeStatistics', required: false, type: Boolean })
  async exportScheduleToPDF(
    @Param('scheduleId') scheduleId: string,
    @Query('pageSize') pageSize: string,
    @Query('orientation') orientation: string,
    @Query('includeStatistics') includeStatistics: string,
    @Res() res: Response,
    @Request() req
  ) {
    // Check access permissions
    this.checkExportPermissions(req.user.role);

    const options = {
      pageSize: pageSize as 'A4' | 'A3' | 'Letter' || 'A4',
      orientation: orientation as 'portrait' | 'landscape' || 'landscape',
      includeStatistics: includeStatistics === 'true',
    };

    const pdfBuffer = await this.exportService.exportScheduleToPDF(scheduleId, options);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="schedule-${scheduleId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }

  @Get('schedule/:scheduleId/excel')
  @ApiOperation({ summary: 'Export schedule to Excel' })
  @ApiResponse({ status: 200, description: 'Excel file generated successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID to export' })
  @ApiQuery({ name: 'includeStatistics', required: false, type: Boolean })
  @ApiQuery({ name: 'separateSheetsByEntity', required: false, type: Boolean })
  async exportScheduleToExcel(
    @Param('scheduleId') scheduleId: string,
    @Query('includeStatistics') includeStatistics: string,
    @Query('separateSheetsByEntity') separateSheetsByEntity: string,
    @Res() res: Response,
    @Request() req
  ) {
    // Check access permissions
    this.checkExportPermissions(req.user.role);

    const options = {
      includeStatistics: includeStatistics === 'true',
      separateSheetsByEntity: separateSheetsByEntity === 'true',
    };

    const excelBuffer = await this.exportService.exportScheduleToExcel(scheduleId, options);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="schedule-${scheduleId}.xlsx"`,
      'Content-Length': excelBuffer.length,
    });

    res.send(excelBuffer);
  }

  @Get('schedule/:scheduleId/csv')
  @ApiOperation({ summary: 'Export schedule to CSV' })
  @ApiResponse({ status: 200, description: 'CSV file generated successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID to export' })
  @ApiQuery({ name: 'delimiter', required: false, description: 'CSV delimiter (default: comma)' })
  @ApiQuery({ name: 'includeHeaders', required: false, type: Boolean })
  async exportScheduleToCSV(
    @Param('scheduleId') scheduleId: string,
    @Query('delimiter') delimiter: string,
    @Query('includeHeaders') includeHeaders: string,
    @Res() res: Response,
    @Request() req
  ) {
    // Check access permissions
    this.checkExportPermissions(req.user.role);

    const options = {
      delimiter: delimiter || ',',
      includeHeaders: includeHeaders !== 'false',
    };

    const csvData = await this.exportService.exportScheduleToCSV(scheduleId, options);

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="schedule-${scheduleId}.csv"`,
    });

    res.send(csvData);
  }

  @Get('schedule/:scheduleId/ical')
  @ApiOperation({ summary: 'Export schedule to iCal format' })
  @ApiResponse({ status: 200, description: 'iCal file generated successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID to export' })
  @ApiQuery({ name: 'timezone', required: false, description: 'Timezone for events (default: UTC)' })
  @ApiQuery({ name: 'organizerEmail', required: false, description: 'Organizer email for events' })
  async exportScheduleToICal(
    @Param('scheduleId') scheduleId: string,
    @Query('timezone') timezone: string,
    @Query('organizerEmail') organizerEmail: string,
    @Res() res: Response,
    @Request() req
  ) {
    // Check access permissions
    this.checkExportPermissions(req.user.role);

    const options = {
      timezone: timezone || 'UTC',
      organizerEmail,
    };

    const icalData = await this.exportService.exportScheduleToICal(scheduleId, options);

    res.set({
      'Content-Type': 'text/calendar',
      'Content-Disposition': `attachment; filename="schedule-${scheduleId}.ics"`,
    });

    res.send(icalData);
  }

  // Teacher-specific exports
  @Get('teacher/:teacherId/schedule/:scheduleId/:format')
  @ApiOperation({ summary: 'Export teacher schedule in specified format' })
  @ApiResponse({ status: 200, description: 'Teacher schedule exported successfully' })
  @ApiResponse({ status: 404, description: 'Teacher or schedule not found' })
  @ApiParam({ name: 'teacherId', description: 'Teacher ID' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID' })
  @ApiParam({ name: 'format', enum: ['pdf', 'excel', 'csv', 'ical'], description: 'Export format' })
  async exportTeacherSchedule(
    @Param('teacherId') teacherId: string,
    @Param('scheduleId') scheduleId: string,
    @Param('format') format: string,
    @Res() res: Response,
    @Request() req
  ) {
    // Teachers can only export their own schedule
    if (req.user.role === UserRole.TEACHER && teacherId !== req.user.id) {
      throw new BadRequestException('Teachers can only export their own schedule');
    }

    // Check access permissions
    this.checkExportPermissions(req.user.role);

    if (!['pdf', 'excel', 'csv', 'ical'].includes(format)) {
      throw new BadRequestException('Invalid export format');
    }

    const exportData = await this.exportService.exportTeacherSchedule(
      teacherId,
      scheduleId,
      format as 'pdf' | 'excel' | 'csv' | 'ical'
    );

    this.setResponseHeaders(res, format, `teacher-${teacherId}-schedule`);
    res.send(exportData);
  }

  // Class-specific exports
  @Get('class/:classId/schedule/:scheduleId/:format')
  @ApiOperation({ summary: 'Export class schedule in specified format' })
  @ApiResponse({ status: 200, description: 'Class schedule exported successfully' })
  @ApiResponse({ status: 404, description: 'Class or schedule not found' })
  @ApiParam({ name: 'classId', description: 'Class ID' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID' })
  @ApiParam({ name: 'format', enum: ['pdf', 'excel', 'csv', 'ical'], description: 'Export format' })
  async exportClassSchedule(
    @Param('classId') classId: string,
    @Param('scheduleId') scheduleId: string,
    @Param('format') format: string,
    @Res() res: Response,
    @Request() req
  ) {
    // Check access permissions
    this.checkExportPermissions(req.user.role);

    if (!['pdf', 'excel', 'csv', 'ical'].includes(format)) {
      throw new BadRequestException('Invalid export format');
    }

    const exportData = await this.exportService.exportClassSchedule(
      classId,
      scheduleId,
      format as 'pdf' | 'excel' | 'csv' | 'ical'
    );

    this.setResponseHeaders(res, format, `class-${classId}-schedule`);
    res.send(exportData);
  }

  // Bulk export endpoints
  @Get('school/:schoolId/schedules/bulk/:format')
  @ApiOperation({ summary: 'Export all schedules for a school in specified format' })
  @ApiResponse({ status: 200, description: 'Bulk export completed successfully' })
  @ApiResponse({ status: 404, description: 'School not found' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiParam({ name: 'format', enum: ['pdf', 'excel', 'csv'], description: 'Export format' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by schedule status' })
  async exportSchoolSchedulesBulk(
    @Param('schoolId') schoolId: string,
    @Param('format') format: string,
    @Query('status') status: string,
    @Res() res: Response,
    @Request() req
  ) {
    // Only super admins and school admins can do bulk exports
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new BadRequestException('Access denied');
    }

    if (!['pdf', 'excel', 'csv'].includes(format)) {
      throw new BadRequestException('Invalid export format');
    }

    // This would be implemented to export multiple schedules
    // For now, return a placeholder
    res.set({
      'Content-Type': 'application/json',
    });

    res.json({
      message: 'Bulk export functionality not yet implemented',
      schoolId,
      format,
      status,
    });
  }

  // Export templates
  @Get('templates/:type')
  @ApiOperation({ summary: 'Get export templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  @ApiParam({ name: 'type', enum: ['schedule', 'teacher', 'class'], description: 'Template type' })
  getExportTemplates(
    @Param('type') type: string,
    @Request() req
  ) {
    // Check access permissions
    this.checkExportPermissions(req.user.role);

    const templates = {
      schedule: {
        pdf: {
          name: 'Full Schedule PDF',
          description: 'Complete schedule with all sessions, teachers, and rooms',
          options: ['pageSize', 'orientation', 'includeStatistics'],
        },
        excel: {
          name: 'Full Schedule Excel',
          description: 'Multi-sheet Excel with overview, timetable, teachers, and rooms',
          options: ['includeStatistics', 'separateSheetsByEntity'],
        },
        csv: {
          name: 'Schedule CSV',
          description: 'Simple CSV format with all session data',
          options: ['delimiter', 'includeHeaders'],
        },
        ical: {
          name: 'Schedule Calendar',
          description: 'iCalendar format for importing into calendar applications',
          options: ['timezone', 'organizerEmail'],
        },
      },
      teacher: {
        pdf: {
          name: 'Teacher Schedule PDF',
          description: 'Individual teacher schedule with personal timetable',
          options: ['pageSize', 'orientation'],
        },
        excel: {
          name: 'Teacher Schedule Excel',
          description: 'Teacher-specific Excel with weekly view',
          options: ['includeStatistics'],
        },
      },
      class: {
        pdf: {
          name: 'Class Schedule PDF',
          description: 'Class timetable with all subjects and teachers',
          options: ['pageSize', 'orientation'],
        },
        excel: {
          name: 'Class Schedule Excel',
          description: 'Class-specific Excel with subject details',
          options: ['includeStatistics'],
        },
      },
    };

    return templates[type] || { error: 'Invalid template type' };
  }

  // Helper methods
  private checkExportPermissions(userRole: UserRole) {
    // All authenticated users can export schedules they have access to
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER, UserRole.STUDENT].includes(userRole)) {
      throw new BadRequestException('Access denied');
    }
  }

  private setResponseHeaders(res: Response, format: string, filename: string) {
    const contentTypes = {
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      ical: 'text/calendar',
    };

    const extensions = {
      pdf: 'pdf',
      excel: 'xlsx',
      csv: 'csv',
      ical: 'ics',
    };

    res.set({
      'Content-Type': contentTypes[format] || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}.${extensions[format] || 'txt'}"`,
    });
  }
}


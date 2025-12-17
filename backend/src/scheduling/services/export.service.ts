import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ScheduleService } from './schedule.service';
import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import ical from 'ical-generator';
import * as moment from 'moment';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private prisma: PrismaService,
    private scheduleService: ScheduleService,
  ) {}

  async exportScheduleToPDF(scheduleId: string, options: PDFExportOptions = {}): Promise<Buffer> {
    try {
      this.logger.log(`Exporting schedule ${scheduleId} to PDF`);

      // Get schedule with all related data
      const schedule = await this.scheduleService.findById(scheduleId);
      
      if (!schedule) {
        throw new NotFoundException('Schedule not found');
      }

      // Create PDF document
      const doc = new PDFDocument({
        size: options.pageSize || 'A4',
        layout: options.orientation || 'landscape',
        margin: 50,
      });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      
      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          this.logger.log(`PDF export completed for schedule ${scheduleId}`);
          resolve(pdfBuffer);
        });

        doc.on('error', reject);

        // Generate PDF content
        this.generatePDFContent(doc, schedule, options);
        doc.end();
      });
    } catch (error) {
      this.logger.error(`Failed to export schedule ${scheduleId} to PDF: ${error.message}`);
      throw error;
    }
  }

  async exportScheduleToExcel(scheduleId: string, options: ExcelExportOptions = {}): Promise<Buffer> {
    try {
      this.logger.log(`Exporting schedule ${scheduleId} to Excel`);

      // Get schedule with all related data
      const schedule = await this.scheduleService.findById(scheduleId);
      
      if (!schedule) {
        throw new NotFoundException('Schedule not found');
      }

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'School Management System';
      workbook.created = new Date();

      // Add worksheets
      await this.addScheduleOverviewSheet(workbook, schedule);
      await this.addTimeTableSheet(workbook, schedule);
      await this.addTeacherScheduleSheet(workbook, schedule);
      await this.addRoomScheduleSheet(workbook, schedule);
      
      if (options.includeStatistics) {
        await this.addStatisticsSheet(workbook, schedule);
      }

      // Generate Excel buffer
      const buffer = await workbook.xlsx.writeBuffer();
      
      this.logger.log(`Excel export completed for schedule ${scheduleId}`);
      return buffer as any;
    } catch (error) {
      this.logger.error(`Failed to export schedule ${scheduleId} to Excel: ${error.message}`);
      throw error;
    }
  }

  async exportScheduleToCSV(scheduleId: string, options: CSVExportOptions = {}): Promise<string> {
    try {
      this.logger.log(`Exporting schedule ${scheduleId} to CSV`);

      // Get schedule with all related data
      const schedule = await this.scheduleService.findById(scheduleId);
      
      if (!schedule) {
        throw new NotFoundException('Schedule not found');
      }

      const csvData = this.generateCSVData(schedule, options);
      
      this.logger.log(`CSV export completed for schedule ${scheduleId}`);
      return csvData;
    } catch (error) {
      this.logger.error(`Failed to export schedule ${scheduleId} to CSV: ${error.message}`);
      throw error;
    }
  }

  async exportScheduleToICal(scheduleId: string, options: ICalExportOptions = {}): Promise<string> {
    try {
      this.logger.log(`Exporting schedule ${scheduleId} to iCal`);

      // Get schedule with all related data
      const schedule = await this.scheduleService.findById(scheduleId);
      
      if (!schedule) {
        throw new NotFoundException('Schedule not found');
      }

      // Create calendar
      const calendar = ical({
        name: `${schedule.school.name} - ${schedule.name}`,
        description: schedule.description || 'School Schedule',
        timezone: options.timezone || 'UTC',
        url: options.calendarUrl,
      });

      // Add events for each session
      for (const session of schedule.sessions) {
        const startDateTime = this.combineDateTime(session.date, session.timeSlot.startTime);
        const endDateTime = this.combineDateTime(session.date, session.timeSlot.endTime);

        calendar.createEvent({
          start: startDateTime,
          end: endDateTime,
          summary: `${session.subject.name} - ${session.class.name}`,
          description: this.generateEventDescription(session),
          location: session.room.name,
          categories: [
            { name: session.subject.name },
            { name: session.type },
          ],
          organizer: {
            name: `${session.teacher.firstName} ${session.teacher.lastName}`,
            email: options.organizerEmail,
          },
        });
      }

      const icalString = calendar.toString();
      
      this.logger.log(`iCal export completed for schedule ${scheduleId}`);
      return icalString;
    } catch (error) {
      this.logger.error(`Failed to export schedule ${scheduleId} to iCal: ${error.message}`);
      throw error;
    }
  }

  // Teacher-specific exports
  async exportTeacherSchedule(teacherId: string, scheduleId: string, format: 'pdf' | 'excel' | 'csv' | 'ical'): Promise<Buffer | string> {
    try {
      this.logger.log(`Exporting teacher ${teacherId} schedule from ${scheduleId} to ${format}`);

      // Get teacher's sessions from the schedule
      const sessions = await this.prisma.scheduleSession.findMany({
        where: {
          scheduleId,
          teacherId,
        },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          class: { select: { id: true, name: true, grade: true } },
          room: { select: { id: true, name: true, type: true } },
          timeSlot: { select: { id: true, name: true, startTime: true, endTime: true, dayOfWeek: true } },
          schedule: {
            include: {
              school: { select: { id: true, name: true } },
            },
          },
        },
      });

      const teacherSchedule = {
        ...sessions[0]?.schedule,
        sessions,
        teacher: await this.prisma.user.findUnique({
          where: { id: teacherId },
          select: { id: true, firstName: true, lastName: true },
        }),
      };

      switch (format) {
        case 'pdf':
          return this.exportTeacherScheduleToPDF(teacherSchedule);
        case 'excel':
          return this.exportTeacherScheduleToExcel(teacherSchedule);
        case 'csv':
          return this.exportTeacherScheduleToCSV(teacherSchedule);
        case 'ical':
          return this.exportTeacherScheduleToICal(teacherSchedule);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      this.logger.error(`Failed to export teacher schedule: ${error.message}`);
      throw error;
    }
  }

  // Class-specific exports
  async exportClassSchedule(classId: string, scheduleId: string, format: 'pdf' | 'excel' | 'csv' | 'ical'): Promise<Buffer | string> {
    try {
      this.logger.log(`Exporting class ${classId} schedule from ${scheduleId} to ${format}`);

      // Get class sessions from the schedule
      const sessions = await this.prisma.scheduleSession.findMany({
        where: {
          scheduleId,
          classId,
        },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
          room: { select: { id: true, name: true, type: true } },
          timeSlot: { select: { id: true, name: true, startTime: true, endTime: true, dayOfWeek: true } },
          schedule: {
            include: {
              school: { select: { id: true, name: true } },
            },
          },
        },
      });

      const classSchedule = {
        ...sessions[0]?.schedule,
        sessions,
        class: await this.prisma.class.findUnique({
          where: { id: classId },
          select: { id: true, name: true, grade: true },
        }),
      };

      switch (format) {
        case 'pdf':
          return this.exportClassScheduleToPDF(classSchedule);
        case 'excel':
          return this.exportClassScheduleToExcel(classSchedule);
        case 'csv':
          return this.exportClassScheduleToCSV(classSchedule);
        case 'ical':
          return this.exportClassScheduleToICal(classSchedule);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      this.logger.error(`Failed to export class schedule: ${error.message}`);
      throw error;
    }
  }

  // Private helper methods
  private generatePDFContent(doc: PDFKit.PDFDocument, schedule: any, options: PDFExportOptions) {
    // Header
    doc.fontSize(20).text(`${schedule.school.name}`, { align: 'center' });
    doc.fontSize(16).text(`${schedule.name}`, { align: 'center' });
    doc.fontSize(12).text(`${moment(schedule.startDate).format('MMMM DD, YYYY')} - ${moment(schedule.endDate).format('MMMM DD, YYYY')}`, { align: 'center' });
    doc.moveDown(2);

    // Group sessions by day
    const sessionsByDay = this.groupSessionsByDay(schedule.sessions);
    
    for (const [day, daySessions] of Object.entries(sessionsByDay)) {
      doc.fontSize(14).text(day, { underline: true });
      doc.moveDown(0.5);

      // Sort sessions by time
      const sortedSessions = (daySessions as any[]).sort((a, b) => 
        a.timeSlot.startTime.localeCompare(b.timeSlot.startTime)
      );

      for (const session of sortedSessions) {
        const sessionText = `${session.timeSlot.startTime} - ${session.timeSlot.endTime}: ${session.subject.name} (${session.class.name}) - ${session.teacher.firstName} ${session.teacher.lastName} - Room ${session.room.name}`;
        doc.fontSize(10).text(sessionText);
      }
      
      doc.moveDown(1);
    }

    // Footer
    doc.fontSize(8).text(`Generated on ${moment().format('MMMM DD, YYYY HH:mm')}`, { align: 'center' });
  }

  private async addScheduleOverviewSheet(workbook: ExcelJS.Workbook, schedule: any) {
    const worksheet = workbook.addWorksheet('Overview');
    
    // Header
    worksheet.addRow(['School Schedule Overview']);
    worksheet.addRow(['School:', schedule.school.name]);
    worksheet.addRow(['Schedule:', schedule.name]);
    worksheet.addRow(['Period:', `${moment(schedule.startDate).format('MMMM DD, YYYY')} - ${moment(schedule.endDate).format('MMMM DD, YYYY')}`]);
    worksheet.addRow(['Status:', schedule.status]);
    worksheet.addRow(['Total Sessions:', schedule.sessions.length]);
    worksheet.addRow([]);

    // Style header
    worksheet.getCell('A1').font = { bold: true, size: 16 };
    worksheet.getCell('A2').font = { bold: true };
    worksheet.getCell('A3').font = { bold: true };
    worksheet.getCell('A4').font = { bold: true };
    worksheet.getCell('A5').font = { bold: true };
    worksheet.getCell('A6').font = { bold: true };
  }

  private async addTimeTableSheet(workbook: ExcelJS.Workbook, schedule: any) {
    const worksheet = workbook.addWorksheet('Timetable');
    
    // Get unique time slots and days
    const timeSlots: any[] = [...new Set(schedule.sessions.map((s: any) => s.timeSlot))];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Create header row
    const headerRow = ['Time'];
    headerRow.push(...days);
    worksheet.addRow(headerRow);
    
    // Style header
    const headerRowObj = worksheet.getRow(1);
    headerRowObj.font = { bold: true };
    headerRowObj.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    
    // Add time slot rows
    timeSlots.sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
    
    for (const timeSlot of timeSlots) {
      const row = [`${timeSlot.startTime} - ${timeSlot.endTime}`];
      
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const daySession = schedule.sessions.find((s: any) => 
          s.timeSlotId === timeSlot.id && s.timeSlot.dayOfWeek === (dayIndex + 1) % 7
        );
        
        if (daySession) {
          row.push(`${daySession.subject.name}\n${daySession.class.name}\n${daySession.teacher.firstName} ${daySession.teacher.lastName}\nRoom ${daySession.room.name}`);
        } else {
          row.push('');
        }
      }
      
      worksheet.addRow(row);
    }
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });
  }

  private async addTeacherScheduleSheet(workbook: ExcelJS.Workbook, schedule: any) {
    const worksheet = workbook.addWorksheet('Teachers');
    
    // Header
    worksheet.addRow(['Teacher', 'Subject', 'Class', 'Room', 'Day', 'Time', 'Duration']);
    
    // Style header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    
    // Add teacher sessions
    const sortedSessions = schedule.sessions.sort((a: any, b: any) => {
      const teacherCompare = `${a.teacher.lastName}, ${a.teacher.firstName}`.localeCompare(`${b.teacher.lastName}, ${b.teacher.firstName}`);
      if (teacherCompare !== 0) return teacherCompare;
      
      const dayCompare = a.timeSlot.dayOfWeek - b.timeSlot.dayOfWeek;
      if (dayCompare !== 0) return dayCompare;
      
      return a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
    });
    
    for (const session of sortedSessions) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      worksheet.addRow([
        `${session.teacher.firstName} ${session.teacher.lastName}`,
        session.subject.name,
        session.class.name,
        session.room.name,
        dayNames[session.timeSlot.dayOfWeek],
        `${session.timeSlot.startTime} - ${session.timeSlot.endTime}`,
        `${session.duration} min`,
      ]);
    }
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });
  }

  private async addRoomScheduleSheet(workbook: ExcelJS.Workbook, schedule: any) {
    const worksheet = workbook.addWorksheet('Rooms');
    
    // Header
    worksheet.addRow(['Room', 'Subject', 'Class', 'Teacher', 'Day', 'Time', 'Duration']);
    
    // Style header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    
    // Add room sessions
    const sortedSessions = schedule.sessions.sort((a: any, b: any) => {
      const roomCompare = a.room.name.localeCompare(b.room.name);
      if (roomCompare !== 0) return roomCompare;
      
      const dayCompare = a.timeSlot.dayOfWeek - b.timeSlot.dayOfWeek;
      if (dayCompare !== 0) return dayCompare;
      
      return a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
    });
    
    for (const session of sortedSessions) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      worksheet.addRow([
        session.room.name,
        session.subject.name,
        session.class.name,
        `${session.teacher.firstName} ${session.teacher.lastName}`,
        dayNames[session.timeSlot.dayOfWeek],
        `${session.timeSlot.startTime} - ${session.timeSlot.endTime}`,
        `${session.duration} min`,
      ]);
    }
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });
  }

  private async addStatisticsSheet(workbook: ExcelJS.Workbook, schedule: any) {
    const worksheet = workbook.addWorksheet('Statistics');
    
    // Calculate statistics
    const totalSessions = schedule.sessions.length;
    const uniqueTeachers = new Set(schedule.sessions.map((s: any) => s.teacherId)).size;
    const uniqueRooms = new Set(schedule.sessions.map((s: any) => s.roomId)).size;
    const uniqueSubjects = new Set(schedule.sessions.map((s: any) => s.subjectId)).size;
    const uniqueClasses = new Set(schedule.sessions.map((s: any) => s.classId)).size;
    
    // Add statistics
    worksheet.addRow(['Schedule Statistics']);
    worksheet.addRow(['Total Sessions:', totalSessions]);
    worksheet.addRow(['Teachers Involved:', uniqueTeachers]);
    worksheet.addRow(['Rooms Used:', uniqueRooms]);
    worksheet.addRow(['Subjects Scheduled:', uniqueSubjects]);
    worksheet.addRow(['Classes Involved:', uniqueClasses]);
    worksheet.addRow([]);
    
    // Sessions by day
    const sessionsByDay = this.groupSessionsByDay(schedule.sessions);
    worksheet.addRow(['Sessions by Day:']);
    for (const [day, sessions] of Object.entries(sessionsByDay)) {
      worksheet.addRow([day, (sessions as any[]).length]);
    }
    
    // Style
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A8').font = { bold: true };
  }

  private generateCSVData(schedule: any, options: CSVExportOptions): string {
    const headers = [
      'Date',
      'Day',
      'Time',
      'Subject',
      'Class',
      'Teacher',
      'Room',
      'Duration',
      'Type',
      'Status',
    ];
    
    const rows = [headers.join(',')];
    
    for (const session of schedule.sessions) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const row = [
        moment(session.date).format('YYYY-MM-DD'),
        dayNames[session.timeSlot.dayOfWeek],
        `${session.timeSlot.startTime} - ${session.timeSlot.endTime}`,
        `"${session.subject.name}"`,
        `"${session.class.name}"`,
        `"${session.teacher.firstName} ${session.teacher.lastName}"`,
        `"${session.room.name}"`,
        session.duration,
        session.type,
        session.status,
      ];
      rows.push(row.join(','));
    }
    
    return rows.join('\n');
  }

  private combineDateTime(date: string | Date, time: string): Date {
    const dateObj = new Date(date);
    const [hours, minutes] = time.split(':').map(Number);
    dateObj.setHours(hours, minutes, 0, 0);
    return dateObj;
  }

  private generateEventDescription(session: any): string {
    return [
      `Subject: ${session.subject.name}`,
      `Class: ${session.class.name}`,
      `Teacher: ${session.teacher.firstName} ${session.teacher.lastName}`,
      `Room: ${session.room.name}`,
      `Type: ${session.type}`,
      `Duration: ${session.duration} minutes`,
    ].join('\n');
  }

  private groupSessionsByDay(sessions: any[]): Record<string, any[]> {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return sessions.reduce((acc, session) => {
      const dayName = dayNames[session.timeSlot.dayOfWeek];
      if (!acc[dayName]) {
        acc[dayName] = [];
      }
      acc[dayName].push(session);
      return acc;
    }, {});
  }

  // Simplified implementations for teacher and class specific exports
  private async exportTeacherScheduleToPDF(teacherSchedule: any): Promise<Buffer> {
    // Similar to main PDF export but filtered for teacher
    return Buffer.from('Teacher PDF export not fully implemented');
  }

  private async exportTeacherScheduleToExcel(teacherSchedule: any): Promise<Buffer> {
    // Similar to main Excel export but filtered for teacher
    return Buffer.from('Teacher Excel export not fully implemented');
  }

  private exportTeacherScheduleToCSV(teacherSchedule: any): string {
    // Similar to main CSV export but filtered for teacher
    return 'Teacher CSV export not fully implemented';
  }

  private exportTeacherScheduleToICal(teacherSchedule: any): string {
    // Similar to main iCal export but filtered for teacher
    return 'Teacher iCal export not fully implemented';
  }

  private async exportClassScheduleToPDF(classSchedule: any): Promise<Buffer> {
    // Similar to main PDF export but filtered for class
    return Buffer.from('Class PDF export not fully implemented');
  }

  private async exportClassScheduleToExcel(classSchedule: any): Promise<Buffer> {
    // Similar to main Excel export but filtered for class
    return Buffer.from('Class Excel export not fully implemented');
  }

  private exportClassScheduleToCSV(classSchedule: any): string {
    // Similar to main CSV export but filtered for class
    return 'Class CSV export not fully implemented';
  }

  private exportClassScheduleToICal(classSchedule: any): string {
    // Similar to main iCal export but filtered for class
    return 'Class iCal export not fully implemented';
  }
}

// Export options interfaces
interface PDFExportOptions {
  pageSize?: 'A4' | 'A3' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  includeStatistics?: boolean;
  includeConflicts?: boolean;
}

interface ExcelExportOptions {
  includeStatistics?: boolean;
  includeConflicts?: boolean;
  separateSheetsByEntity?: boolean;
}

interface CSVExportOptions {
  delimiter?: string;
  includeHeaders?: boolean;
  dateFormat?: string;
}

interface ICalExportOptions {
  timezone?: string;
  calendarUrl?: string;
  organizerEmail?: string;
}

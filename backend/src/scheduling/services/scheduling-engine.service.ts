import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { OrToolsService } from '../solver/or-tools.service';
import { ScheduleService } from './schedule.service';
import { TimeSlotService } from './time-slot.service';
import { ScheduleGenerationRequestDto } from '../dto/create-schedule.dto';
import { SchedulingRequest } from '../interfaces/solver.interface';

@Injectable()
export class SchedulingEngineService {
  private readonly logger = new Logger(SchedulingEngineService.name);

  constructor(
    @InjectQueue('scheduling') private schedulingQueue: Queue,
    private prisma: PrismaService,
    private orToolsService: OrToolsService,
    private scheduleService: ScheduleService,
    private timeSlotService: TimeSlotService,
  ) {}

  async generateSchedule(request: ScheduleGenerationRequestDto, userId: string) {
    this.logger.log(`Starting schedule generation for school ${request.schoolId}`);

    try {
      // Create a new schedule record
      const schedule = await this.scheduleService.create({
        schoolId: request.schoolId,
        academicPeriodId: request.academicPeriodId,
        name: `Generated Schedule - ${new Date().toLocaleDateString()}`,
        description: 'AI-generated schedule using optimization algorithms',
        startDate: request.startDate,
        endDate: request.endDate,
        metadata: {
          generationRequest: request,
          optimizationLevel: request.optimizationLevel || 'STANDARD',
        },
      }, userId);

      // Prepare scheduling request
      const schedulingRequest = await this.prepareSchedulingRequest(request);

      // Add job to queue
      const job = await this.schedulingQueue.add('generateSchedule', {
        request: schedulingRequest,
        scheduleId: schedule.id,
        userId,
      }, {
        delay: 1000, // Small delay to ensure response is sent first
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });

      this.logger.log(`Schedule generation job ${job.id} queued for schedule ${schedule.id}`);

      return {
        success: true,
        scheduleId: schedule.id,
        jobId: job.id,
        message: 'Schedule generation started',
        estimatedCompletionTime: '5-10 minutes',
      };
    } catch (error) {
      this.logger.error(`Failed to start schedule generation: ${error.message}`);
      throw error;
    }
  }

  async optimizeExistingSchedule(scheduleId: string, preferences: any[] = []) {
    this.logger.log(`Starting optimization for schedule ${scheduleId}`);

    try {
      // Verify schedule exists
      await this.scheduleService.findById(scheduleId);

      // Add optimization job to queue
      const job = await this.schedulingQueue.add('optimizeSchedule', {
        scheduleId,
        preferences,
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      });

      this.logger.log(`Schedule optimization job ${job.id} queued for schedule ${scheduleId}`);

      return {
        success: true,
        scheduleId,
        jobId: job.id,
        message: 'Schedule optimization started',
        estimatedCompletionTime: '2-5 minutes',
      };
    } catch (error) {
      this.logger.error(`Failed to start schedule optimization: ${error.message}`);
      throw error;
    }
  }

  async validateScheduleConstraints(scheduleId: string) {
    this.logger.log(`Starting constraint validation for schedule ${scheduleId}`);

    try {
      // Verify schedule exists
      await this.scheduleService.findById(scheduleId);

      // Add validation job to queue
      const job = await this.schedulingQueue.add('validateConstraints', {
        scheduleId,
      }, {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 2000,
        },
      });

      this.logger.log(`Constraint validation job ${job.id} queued for schedule ${scheduleId}`);

      return {
        success: true,
        scheduleId,
        jobId: job.id,
        message: 'Constraint validation started',
        estimatedCompletionTime: '1-2 minutes',
      };
    } catch (error) {
      this.logger.error(`Failed to start constraint validation: ${error.message}`);
      throw error;
    }
  }

  async getJobStatus(jobId: string) {
    try {
      const job = await this.schedulingQueue.getJob(jobId);
      
      if (!job) {
        return {
          found: false,
          message: 'Job not found',
        };
      }

      const state = await job.getState();
      const progress = job.progress();
      const result = job.returnvalue;
      const error = job.failedReason;

      return {
        found: true,
        id: job.id,
        state,
        progress,
        result,
        error,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
      };
    } catch (error) {
      this.logger.error(`Failed to get job status for ${jobId}: ${error.message}`);
      throw error;
    }
  }

  async cancelJob(jobId: string) {
    try {
      const job = await this.schedulingQueue.getJob(jobId);
      
      if (!job) {
        return {
          success: false,
          message: 'Job not found',
        };
      }

      await job.remove();

      this.logger.log(`Job ${jobId} cancelled successfully`);

      return {
        success: true,
        message: 'Job cancelled successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId}: ${error.message}`);
      throw error;
    }
  }

  async getQueueStats() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.schedulingQueue.getWaiting(),
        this.schedulingQueue.getActive(),
        this.schedulingQueue.getCompleted(),
        this.schedulingQueue.getFailed(),
        this.schedulingQueue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: waiting.length + active.length + completed.length + failed.length + delayed.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get queue stats: ${error.message}`);
      throw error;
    }
  }

  private async prepareSchedulingRequest(request: ScheduleGenerationRequestDto): Promise<SchedulingRequest> {
    // Fetch required data for scheduling
    const [subjects, classes, rooms, teachers, timeSlots] = await Promise.all([
      this.prisma.subject.findMany({
        where: { schoolId: request.schoolId, isActive: true },
        include: { teachers: { include: { user: true } } },
      }),
      this.prisma.class.findMany({
        where: { schoolId: request.schoolId, isActive: true },
        include: { subjects: { include: { subject: true } } },
      }),
      this.prisma.room.findMany({
        where: { schoolId: request.schoolId, isActive: true },
      }),
      this.prisma.user.findMany({
        where: { 
          schoolId: request.schoolId, 
          role: 'TEACHER',
          isActive: true,
        },
      }),
      this.prisma.timeSlot.findMany({
        where: { schoolId: request.schoolId, isActive: true },
        orderBy: [{ dayOfWeek: 'asc' }, { order: 'asc' }],
      }),
    ]);

    // Fetch preferences and rules
    const [preferences, rules] = await Promise.all([
      this.prisma.schedulingPreference.findMany({
        where: { schoolId: request.schoolId, isActive: true },
      }),
      this.prisma.schedulingRule.findMany({
        where: { schoolId: request.schoolId, isActive: true },
      }),
    ]);

    // Convert to scheduling request format
    const schedulingRequest: SchedulingRequest = {
      scheduleId: `schedule-${Date.now()}`,
      schoolId: request.schoolId,
      timeHorizon: {
        startDate: new Date(request.startDate),
        endDate: new Date(request.endDate),
        workingDays: [1, 2, 3, 4, 5], // Monday to Friday
        timeSlots: timeSlots.map(ts => ({
          id: ts.id,
          startTime: ts.startTime,
          endTime: ts.endTime,
          dayOfWeek: ts.dayOfWeek,
          duration: ts.duration,
        })),
      },
      resources: {
        teachers: teachers.map(teacher => ({
          id: teacher.id,
          name: `${teacher.firstName} ${teacher.lastName}`,
          subjects: [], // Would be populated from teacher subjects
          maxHoursPerWeek: 40, // Default value
          availability: [], // Would be populated from teacher availability
        })),
        rooms: rooms.map(room => ({
          id: room.id,
          name: room.name,
          capacity: room.capacity,
          equipment: room.features || [],
          availability: [], // Would be populated from room availability
        })),
        subjects: subjects.map(subject => ({
          id: subject.id,
          name: subject.name,
          hoursPerWeek: 4, // Default hours per week
          requiresSpecialEquipment: [], // Would be populated from subject requirements
        })),
        classes: classes.map(cls => ({
          id: cls.id,
          name: cls.name,
          studentCount: 30, // Default student count
          subjects: cls.subjects?.map(s => s.subjectId) || [],
        })),
      },
      constraints: {
        hard: rules.filter(rule => rule.isMandatory).map(rule => ({
          type: rule.type,
          parameters: (rule.conditions as Record<string, any>) || {},
        })),
        soft: rules.filter(rule => !rule.isMandatory).map(rule => ({
          type: rule.type,
          weight: rule.priority,
          parameters: (rule.conditions as Record<string, any>) || {},
        })),
      },
      preferences: {
        teacherPreferences: preferences.filter(pref => pref.type === 'TEACHER_PREFERENCE').map(pref => ({
          teacherId: pref.entityId,
          preferredTimeSlots: (pref.parameters as any)?.preferredTimeSlots || [],
          unavailableTimeSlots: (pref.parameters as any)?.unavailableTimeSlots || [],
          maxConsecutiveHours: (pref.parameters as any)?.maxConsecutiveHours || 8,
          preferredRooms: (pref.parameters as any)?.preferredRooms || [],
        })),
        roomPreferences: preferences.filter(pref => pref.type === 'ROOM_PREFERENCE').map(pref => ({
          roomId: pref.entityId,
          preferredSubjects: (pref.parameters as any)?.preferredSubjects || [],
          capacity: (pref.parameters as any)?.capacity || 30,
          equipment: (pref.parameters as any)?.equipment || [],
        })),
        timePreferences: preferences.filter(pref => pref.type === 'TIME_PREFERENCE').map(pref => ({
          timeSlotId: pref.entityId,
          weight: pref.weight,
          description: pref.description || '',
        })),
      },
      existingSessions: request.includeExistingSessions ? [] : undefined, // Would fetch existing sessions
    };

    return schedulingRequest;
  }

  async getSchedulingCapabilities(schoolId: string) {
    try {
      // Get counts of available resources
      const [subjectCount, classCount, roomCount, teacherCount, timeSlotCount] = await Promise.all([
        this.prisma.subject.count({ where: { schoolId, isActive: true } }),
        this.prisma.class.count({ where: { schoolId, isActive: true } }),
        this.prisma.room.count({ where: { schoolId, isActive: true } }),
        this.prisma.user.count({ where: { schoolId, role: 'TEACHER', isActive: true } }),
        this.prisma.timeSlot.count({ where: { schoolId, isActive: true } }),
      ]);

      // Calculate estimated complexity
      const complexity = this.calculateSchedulingComplexity({
        subjects: subjectCount,
        classes: classCount,
        rooms: roomCount,
        teachers: teacherCount,
        timeSlots: timeSlotCount,
      });

      return {
        resources: {
          subjects: subjectCount,
          classes: classCount,
          rooms: roomCount,
          teachers: teacherCount,
          timeSlots: timeSlotCount,
        },
        complexity: complexity.level,
        estimatedSolvingTime: complexity.estimatedTime,
        recommendations: complexity.recommendations,
        maxOptimizationLevel: complexity.maxLevel,
      };
    } catch (error) {
      this.logger.error(`Failed to get scheduling capabilities: ${error.message}`);
      throw error;
    }
  }

  private calculateSchedulingComplexity(resources: any) {
    const totalVariables = resources.subjects * resources.classes * resources.rooms * resources.teachers * resources.timeSlots;
    
    if (totalVariables < 10000) {
      return {
        level: 'LOW',
        estimatedTime: '1-3 minutes',
        maxLevel: 'ADVANCED',
        recommendations: ['All optimization levels available'],
      };
    } else if (totalVariables < 100000) {
      return {
        level: 'MEDIUM',
        estimatedTime: '3-8 minutes',
        maxLevel: 'STANDARD',
        recommendations: ['Use STANDARD optimization for best balance', 'Consider reducing time slots if possible'],
      };
    } else {
      return {
        level: 'HIGH',
        estimatedTime: '8-15 minutes',
        maxLevel: 'BASIC',
        recommendations: [
          'Use BASIC optimization to reduce solving time',
          'Consider splitting into smaller scheduling periods',
          'Review if all resources are necessary',
        ],
      };
    }
  }
}

import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { OrToolsService } from '../solver/or-tools.service';
import { ScheduleService } from '../services/schedule.service';
import { SchedulingRequest } from '../interfaces/solver.interface';

@Processor('scheduling')
export class SchedulingProcessor {
  private readonly logger = new Logger(SchedulingProcessor.name);

  constructor(
    private orToolsService: OrToolsService,
    private scheduleService: ScheduleService,
  ) {}

  @Process('generateSchedule')
  async handleScheduleGeneration(job: Job<ScheduleGenerationJobData>) {
    this.logger.log(`Starting schedule generation job ${job.id}`);
    
    try {
      const { request, scheduleId, userId } = job.data;
      
      // Update job progress
      await job.progress(10);
      
      // Solve the scheduling problem
      this.logger.log(`Solving scheduling problem for school ${request.schoolId}`);
      const result = await this.orToolsService.solve(request);
      
      await job.progress(70);
      
      if (result.success) {
        // Save the generated schedule sessions
        this.logger.log(`Saving ${result.schedule.length} sessions to schedule ${scheduleId}`);
        
        for (const session of result.schedule) {
          await this.scheduleService.createSession({
            scheduleId,
            subjectId: session.subjectId,
            classId: session.classId,
            teacherId: session.teacherId,
            roomId: session.roomId,
            timeSlotId: session.timeSlotId,
            date: session.date.toISOString(),
            duration: session.duration,
            type: session.type || 'REGULAR',
          });
        }
        
        await job.progress(90);
        
        // Update schedule with optimization results
        await this.scheduleService.update(scheduleId, {
          status: 'PENDING_APPROVAL',
          metadata: {
            optimizationScore: result.optimizationScore,
            solvingTime: result.solvingTime,
            conflictCount: result.conflicts.length,
            generatedAt: new Date().toISOString(),
            generatedBy: userId,
          },
        });
        
        await job.progress(100);
        
        this.logger.log(`Schedule generation completed successfully for job ${job.id}`);
        
        return {
          success: true,
          scheduleId,
          sessionsCreated: result.schedule.length,
          optimizationScore: result.optimizationScore,
          conflicts: result.conflicts,
        };
      } else {
        this.logger.error(`Schedule generation failed for job ${job.id}: ${result.message}`);
        
        // Update schedule status to indicate failure
        await this.scheduleService.update(scheduleId, {
          status: 'DRAFT',
          metadata: {
            error: result.message,
            conflicts: result.conflicts,
            failedAt: new Date().toISOString(),
          },
        });
        
        throw new Error(result.message || 'Schedule generation failed');
      }
    } catch (error) {
      this.logger.error(`Schedule generation job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }

  @Process('optimizeSchedule')
  async handleScheduleOptimization(job: Job<ScheduleOptimizationJobData>) {
    this.logger.log(`Starting schedule optimization job ${job.id}`);
    
    try {
      const { scheduleId, preferences } = job.data;
      
      // Get existing schedule sessions
      const schedule = await this.scheduleService.findById(scheduleId);
      
      await job.progress(20);
      
      // Optimize the schedule
      this.logger.log(`Optimizing ${schedule.sessions.length} sessions`);
      const optimizedSessions = await this.orToolsService.optimizeSchedule(
        schedule.sessions,
        preferences
      );
      
      await job.progress(70);
      
      // Update sessions with optimized data
      for (const session of optimizedSessions) {
        await this.scheduleService.updateSession(session.id, {
          teacherId: session.teacherId,
          roomId: session.roomId,
          timeSlotId: session.timeSlotId,
          date: session.date,
        });
      }
      
      await job.progress(90);
      
      // Update schedule metadata
      await this.scheduleService.update(scheduleId, {
        metadata: {
          ...schedule.metadata,
          lastOptimizedAt: new Date().toISOString(),
          optimizationImprovement: 'TBD', // Calculate improvement
        },
      });
      
      await job.progress(100);
      
      this.logger.log(`Schedule optimization completed successfully for job ${job.id}`);
      
      return {
        success: true,
        scheduleId,
        sessionsOptimized: optimizedSessions.length,
      };
    } catch (error) {
      this.logger.error(`Schedule optimization job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }

  @Process('validateConstraints')
  async handleConstraintValidation(job: Job<ConstraintValidationJobData>) {
    this.logger.log(`Starting constraint validation job ${job.id}`);
    
    try {
      const { scheduleId } = job.data;
      
      // Get schedule sessions
      const schedule = await this.scheduleService.findById(scheduleId);
      
      await job.progress(30);
      
      // Validate constraints
      this.logger.log(`Validating constraints for ${schedule.sessions.length} sessions`);
      const conflicts = await this.orToolsService.validateConstraints(
        schedule.sessions,
        [] // Would include actual constraints
      );
      
      await job.progress(80);
      
      // Save conflicts to database
      // This would involve creating ScheduleConflict records
      
      await job.progress(100);
      
      this.logger.log(`Constraint validation completed for job ${job.id}`);
      
      return {
        success: true,
        scheduleId,
        conflictsFound: conflicts.length,
        conflicts,
      };
    } catch (error) {
      this.logger.error(`Constraint validation job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }
}

interface ScheduleGenerationJobData {
  request: SchedulingRequest;
  scheduleId: string;
  userId: string;
}

interface ScheduleOptimizationJobData {
  scheduleId: string;
  preferences: any[];
}

interface ConstraintValidationJobData {
  scheduleId: string;
}


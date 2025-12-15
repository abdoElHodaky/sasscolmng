import { Injectable, Logger } from '@nestjs/common';
import { BaseConstraint, ConstraintViolation, ConstraintContext, SoftConstraint } from './constraint.interface';

@Injectable()
export class SoftConstraintsService {
  private readonly logger = new Logger(SoftConstraintsService.name);
  private constraints: SoftConstraint[] = [];

  constructor() {
    this.initializeConstraints();
  }

  private initializeConstraints() {
    this.constraints = [
      new TeacherPreferenceConstraint(),
      new TimePreferenceConstraint(),
      new WorkloadDistributionConstraint(),
      new RoomPreferenceConstraint(),
      new SubjectPreferenceConstraint(),
      new ConsecutivePeriodsConstraint(),
    ];
  }

  validateAll(context: ConstraintContext): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const constraint of this.constraints) {
      try {
        const constraintViolations = constraint.validate(context);
        violations.push(...constraintViolations);
      } catch (error) {
        this.logger.error(`Error validating soft constraint ${constraint.id}: ${error.message}`);
      }
    }

    return violations.sort((a, b) => {
      // Sort by weight (higher weight = higher priority)
      const aWeight = this.getConstraintWeight(a.constraintId, context);
      const bWeight = this.getConstraintWeight(b.constraintId, context);
      return bWeight - aWeight;
    });
  }

  calculateOptimizationScore(context: ConstraintContext): number {
    let totalScore = 0;
    let maxPossibleScore = 0;

    for (const constraint of this.constraints) {
      try {
        const penalty = constraint.calculatePenalty(context);
        const weight = constraint.weight;
        const maxPenalty = this.getMaxPenalty(constraint, context);
        
        // Convert penalty to score (lower penalty = higher score)
        const score = Math.max(0, maxPenalty - penalty);
        totalScore += score * weight;
        maxPossibleScore += maxPenalty * weight;
      } catch (error) {
        this.logger.error(`Error calculating score for constraint ${constraint.id}: ${error.message}`);
      }
    }

    return maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
  }

  getOptimizationSuggestions(context: ConstraintContext): string[] {
    const suggestions: string[] = [];
    const violations = this.validateAll(context);

    // Group violations by type and provide suggestions
    const violationsByType = violations.reduce((acc, violation) => {
      if (!acc[violation.constraintType]) {
        acc[violation.constraintType] = [];
      }
      acc[violation.constraintType].push(violation);
      return acc;
    }, {} as Record<string, ConstraintViolation[]>);

    for (const [type, typeViolations] of Object.entries(violationsByType)) {
      if (typeViolations.length > 0) {
        suggestions.push(...this.generateSuggestionsForType(type, typeViolations, context));
      }
    }

    return suggestions;
  }

  private getConstraintWeight(constraintId: string, context: ConstraintContext): number {
    const constraint = this.constraints.find(c => c.id === constraintId);
    return constraint?.weight || 1;
  }

  private getMaxPenalty(constraint: SoftConstraint, context: ConstraintContext): number {
    // Estimate maximum possible penalty for this constraint
    switch (constraint.id) {
      case 'TEACHER_PREFERENCE':
        return context.sessions.length * 10;
      case 'TIME_PREFERENCE':
        return context.sessions.length * 8;
      case 'WORKLOAD_DISTRIBUTION':
        return context.teachers.length * 20;
      case 'ROOM_PREFERENCE':
        return context.sessions.length * 6;
      case 'SUBJECT_PREFERENCE':
        return context.sessions.length * 5;
      case 'CONSECUTIVE_PERIODS':
        return context.sessions.length * 15;
      default:
        return 100;
    }
  }

  private generateSuggestionsForType(type: string, violations: ConstraintViolation[], context: ConstraintContext): string[] {
    const suggestions: string[] = [];

    switch (type) {
      case 'Teacher Preference':
        suggestions.push(`${violations.length} teacher preferences not satisfied. Consider adjusting time slot assignments.`);
        break;
      case 'Time Preference':
        suggestions.push(`${violations.length} time preferences violated. Review preferred time slots configuration.`);
        break;
      case 'Workload Distribution':
        suggestions.push(`Uneven workload distribution detected. Consider redistributing sessions across days.`);
        break;
      case 'Room Preference':
        suggestions.push(`${violations.length} room preferences not met. Check room assignments and preferences.`);
        break;
      case 'Subject Preference':
        suggestions.push(`Subject scheduling preferences violated. Review subject-specific constraints.`);
        break;
      case 'Consecutive Periods':
        suggestions.push(`Consecutive period constraints violated. Adjust session sequencing.`);
        break;
    }

    return suggestions;
  }
}

// Teacher Preference Constraint
class TeacherPreferenceConstraint extends BaseConstraint implements SoftConstraint {
  id = 'TEACHER_PREFERENCE';
  name = 'Teacher Preference';
  description = 'Teachers should be scheduled according to their preferences';
  type: 'SOFT' = 'SOFT';
  priority = 8;
  weight = 8;

  validate(context: ConstraintContext): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    
    // Get teacher preferences
    const teacherPreferences = context.preferences.filter(p => p.type === 'TEACHER_PREFERENCE');
    
    for (const preference of teacherPreferences) {
      const teacherId = preference.entityId;
      const preferredTimeSlots = preference.parameters.preferredTimeSlots || [];
      const avoidTimeSlots = preference.parameters.avoidTimeSlots || [];
      
      // Check sessions for this teacher
      const teacherSessions = context.sessions.filter(s => s.teacherId === teacherId);
      
      for (const session of teacherSessions) {
        // Check if session is in avoided time slots
        if (avoidTimeSlots.includes(session.timeSlotId)) {
          violations.push({
            constraintId: this.id,
            constraintType: this.name,
            severity: 'MEDIUM',
            description: `Teacher ${teacherId} scheduled in avoided time slot`,
            affectedEntities: [session.id],
            suggestedResolution: 'Move to a preferred time slot',
            cost: preference.weight * 10,
          });
        }
        
        // Check if session is not in preferred time slots (if specified)
        if (preferredTimeSlots.length > 0 && !preferredTimeSlots.includes(session.timeSlotId)) {
          violations.push({
            constraintId: this.id,
            constraintType: this.name,
            severity: 'LOW',
            description: `Teacher ${teacherId} not scheduled in preferred time slot`,
            affectedEntities: [session.id],
            suggestedResolution: 'Consider moving to a preferred time slot',
            cost: preference.weight * 5,
          });
        }
      }
    }
    
    return violations;
  }

  getCost(context: ConstraintContext): number {
    return this.validate(context).reduce((sum, violation) => sum + violation.cost, 0);
  }

  calculatePenalty(context: ConstraintContext): number {
    return this.getCost(context);
  }
}

// Time Preference Constraint
class TimePreferenceConstraint extends BaseConstraint implements SoftConstraint {
  id = 'TIME_PREFERENCE';
  name = 'Time Preference';
  description = 'Sessions should be scheduled in preferred time periods';
  type: 'SOFT' = 'SOFT';
  priority = 6;
  weight = 6;

  validate(context: ConstraintContext): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    
    const timePreferences = context.preferences.filter(p => p.type === 'TIME_PREFERENCE');
    
    for (const preference of timePreferences) {
      const preferredTimes = preference.parameters.preferredTimes || [];
      const avoidTimes = preference.parameters.avoidTimes || [];
      
      for (const session of context.sessions) {
        const timeSlot = context.timeSlots.find(ts => ts.id === session.timeSlotId);
        if (!timeSlot) continue;
        
        const sessionTime = timeSlot.startTime;
        
        // Check if session is in avoided times
        if (avoidTimes.some((avoid: string) => sessionTime >= avoid)) {
          violations.push({
            constraintId: this.id,
            constraintType: this.name,
            severity: 'LOW',
            description: `Session scheduled in non-preferred time: ${sessionTime}`,
            affectedEntities: [session.id],
            suggestedResolution: 'Move to a preferred time period',
            cost: preference.weight * 8,
          });
        }
      }
    }
    
    return violations;
  }

  getCost(context: ConstraintContext): number {
    return this.validate(context).reduce((sum, violation) => sum + violation.cost, 0);
  }

  calculatePenalty(context: ConstraintContext): number {
    return this.getCost(context);
  }
}

// Workload Distribution Constraint
class WorkloadDistributionConstraint extends BaseConstraint implements SoftConstraint {
  id = 'WORKLOAD_DISTRIBUTION';
  name = 'Workload Distribution';
  description = 'Teacher workload should be evenly distributed across days';
  type: 'SOFT' = 'SOFT';
  priority = 7;
  weight = 7;

  validate(context: ConstraintContext): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    
    const workloadPreferences = context.preferences.filter(p => p.type === 'WORKLOAD_DISTRIBUTION');
    
    for (const preference of workloadPreferences) {
      const maxSessionsPerDay = preference.parameters.maxSessionsPerDay || 6;
      const minSessionsPerDay = preference.parameters.minSessionsPerDay || 1;
      const targetSessionsPerDay = preference.parameters.targetSessionsPerDay || 4;
      
      // Group sessions by teacher and day
      const teacherDayMap = new Map<string, Map<string, number>>();
      
      for (const session of context.sessions) {
        const teacherId = session.teacherId;
        const day = session.date;
        
        if (!teacherDayMap.has(teacherId)) {
          teacherDayMap.set(teacherId, new Map());
        }
        
        const dayMap = teacherDayMap.get(teacherId)!;
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      }
      
      // Check for violations
      for (const [teacherId, dayMap] of teacherDayMap.entries()) {
        for (const [day, sessionCount] of dayMap.entries()) {
          if (sessionCount > maxSessionsPerDay) {
            violations.push({
              constraintId: this.id,
              constraintType: this.name,
              severity: 'MEDIUM',
              description: `Teacher ${teacherId} has ${sessionCount} sessions on ${day} (max: ${maxSessionsPerDay})`,
              affectedEntities: [],
              suggestedResolution: 'Redistribute sessions to other days',
              cost: (sessionCount - maxSessionsPerDay) * preference.weight * 10,
            });
          }
          
          if (sessionCount < minSessionsPerDay) {
            violations.push({
              constraintId: this.id,
              constraintType: this.name,
              severity: 'LOW',
              description: `Teacher ${teacherId} has only ${sessionCount} sessions on ${day} (min: ${minSessionsPerDay})`,
              affectedEntities: [],
              suggestedResolution: 'Add more sessions or adjust minimum requirement',
              cost: (minSessionsPerDay - sessionCount) * preference.weight * 5,
            });
          }
          
          // Penalty for deviation from target
          const deviation = Math.abs(sessionCount - targetSessionsPerDay);
          if (deviation > 1) {
            violations.push({
              constraintId: this.id,
              constraintType: this.name,
              severity: 'LOW',
              description: `Teacher ${teacherId} workload deviation on ${day}: ${sessionCount} vs target ${targetSessionsPerDay}`,
              affectedEntities: [],
              suggestedResolution: 'Adjust session distribution to meet target',
              cost: deviation * preference.weight * 3,
            });
          }
        }
      }
    }
    
    return violations;
  }

  getCost(context: ConstraintContext): number {
    return this.validate(context).reduce((sum, violation) => sum + violation.cost, 0);
  }

  calculatePenalty(context: ConstraintContext): number {
    return this.getCost(context);
  }
}

// Room Preference Constraint
class RoomPreferenceConstraint extends BaseConstraint implements SoftConstraint {
  id = 'ROOM_PREFERENCE';
  name = 'Room Preference';
  description = 'Subjects should be scheduled in preferred room types';
  type: 'SOFT' = 'SOFT';
  priority = 5;
  weight = 5;

  validate(context: ConstraintContext): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    
    const roomPreferences = context.preferences.filter(p => p.type === 'ROOM_PREFERENCE');
    
    for (const preference of roomPreferences) {
      const preferredRoomTypes = preference.parameters.preferredRoomTypes || [];
      const avoidRoomTypes = preference.parameters.avoidRoomTypes || [];
      
      for (const session of context.sessions) {
        const room = context.rooms.find(r => r.id === session.roomId);
        if (!room) continue;
        
        // Check if room type is avoided
        if (avoidRoomTypes.includes(room.type)) {
          violations.push({
            constraintId: this.id,
            constraintType: this.name,
            severity: 'MEDIUM',
            description: `Session scheduled in avoided room type: ${room.type}`,
            affectedEntities: [session.id],
            suggestedResolution: 'Move to a preferred room type',
            cost: preference.weight * 8,
          });
        }
        
        // Check if room type is not preferred (if specified)
        if (preferredRoomTypes.length > 0 && !preferredRoomTypes.includes(room.type)) {
          violations.push({
            constraintId: this.id,
            constraintType: this.name,
            severity: 'LOW',
            description: `Session not in preferred room type: ${room.type}`,
            affectedEntities: [session.id],
            suggestedResolution: 'Consider moving to a preferred room type',
            cost: preference.weight * 4,
          });
        }
      }
    }
    
    return violations;
  }

  getCost(context: ConstraintContext): number {
    return this.validate(context).reduce((sum, violation) => sum + violation.cost, 0);
  }

  calculatePenalty(context: ConstraintContext): number {
    return this.getCost(context);
  }
}

// Subject Preference Constraint
class SubjectPreferenceConstraint extends BaseConstraint implements SoftConstraint {
  id = 'SUBJECT_PREFERENCE';
  name = 'Subject Preference';
  description = 'Subjects should be scheduled according to pedagogical preferences';
  type: 'SOFT' = 'SOFT';
  priority = 4;
  weight = 4;

  validate(context: ConstraintContext): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    
    const subjectPreferences = context.preferences.filter(p => p.type === 'SUBJECT_PREFERENCE');
    
    for (const preference of subjectPreferences) {
      const subjectId = preference.entityId;
      const preferredTimeSlots = preference.parameters.preferredTimeSlots || [];
      const avoidTimeSlots = preference.parameters.avoidTimeSlots || [];
      const maxConsecutive = preference.parameters.maxConsecutive || 2;
      
      const subjectSessions = context.sessions.filter(s => s.subjectId === subjectId);
      
      for (const session of subjectSessions) {
        // Check time slot preferences
        if (avoidTimeSlots.includes(session.timeSlotId)) {
          violations.push({
            constraintId: this.id,
            constraintType: this.name,
            severity: 'LOW',
            description: `Subject ${subjectId} scheduled in avoided time slot`,
            affectedEntities: [session.id],
            suggestedResolution: 'Move to a preferred time slot',
            cost: preference.weight * 6,
          });
        }
        
        if (preferredTimeSlots.length > 0 && !preferredTimeSlots.includes(session.timeSlotId)) {
          violations.push({
            constraintId: this.id,
            constraintType: this.name,
            severity: 'LOW',
            description: `Subject ${subjectId} not in preferred time slot`,
            affectedEntities: [session.id],
            suggestedResolution: 'Consider moving to a preferred time slot',
            cost: preference.weight * 3,
          });
        }
      }
      
      // Check for too many consecutive sessions
      // This would require more complex logic to detect consecutive sessions
      // For now, we'll implement a simplified version
    }
    
    return violations;
  }

  getCost(context: ConstraintContext): number {
    return this.validate(context).reduce((sum, violation) => sum + violation.cost, 0);
  }

  calculatePenalty(context: ConstraintContext): number {
    return this.getCost(context);
  }
}

// Consecutive Periods Constraint
class ConsecutivePeriodsConstraint extends BaseConstraint implements SoftConstraint {
  id = 'CONSECUTIVE_PERIODS';
  name = 'Consecutive Periods';
  description = 'Limit consecutive periods for the same subject or teacher';
  type: 'SOFT' = 'SOFT';
  priority = 6;
  weight = 6;

  validate(context: ConstraintContext): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    
    const consecutivePreferences = context.preferences.filter(p => p.type === 'CONSECUTIVE_PERIODS');
    
    for (const preference of consecutivePreferences) {
      const maxConsecutiveSubject = preference.parameters.maxConsecutiveSubject || 2;
      const maxConsecutiveTeacher = preference.parameters.maxConsecutiveTeacher || 3;
      
      // Group sessions by day and sort by time
      const sessionsByDay = new Map<string, any[]>();
      
      for (const session of context.sessions) {
        const day = session.date;
        if (!sessionsByDay.has(day)) {
          sessionsByDay.set(day, []);
        }
        sessionsByDay.get(day)!.push(session);
      }
      
      // Check each day for consecutive violations
      for (const [day, daySessions] of sessionsByDay.entries()) {
        // Sort sessions by time slot order
        const sortedSessions = daySessions.sort((a, b) => {
          const timeSlotA = context.timeSlots.find(ts => ts.id === a.timeSlotId);
          const timeSlotB = context.timeSlots.find(ts => ts.id === b.timeSlotId);
          return (timeSlotA?.order || 0) - (timeSlotB?.order || 0);
        });
        
        // Check for consecutive subject violations
        let consecutiveSubjectCount = 1;
        let currentSubject = sortedSessions[0]?.subjectId;
        
        for (let i = 1; i < sortedSessions.length; i++) {
          if (sortedSessions[i].subjectId === currentSubject) {
            consecutiveSubjectCount++;
            if (consecutiveSubjectCount > maxConsecutiveSubject) {
              violations.push({
                constraintId: this.id,
                constraintType: this.name,
                severity: 'MEDIUM',
                description: `Too many consecutive ${currentSubject} sessions on ${day}`,
                affectedEntities: [sortedSessions[i].id],
                suggestedResolution: 'Break up consecutive sessions with other subjects',
                cost: preference.weight * 10,
              });
            }
          } else {
            consecutiveSubjectCount = 1;
            currentSubject = sortedSessions[i].subjectId;
          }
        }
        
        // Check for consecutive teacher violations
        let consecutiveTeacherCount = 1;
        let currentTeacher = sortedSessions[0]?.teacherId;
        
        for (let i = 1; i < sortedSessions.length; i++) {
          if (sortedSessions[i].teacherId === currentTeacher) {
            consecutiveTeacherCount++;
            if (consecutiveTeacherCount > maxConsecutiveTeacher) {
              violations.push({
                constraintId: this.id,
                constraintType: this.name,
                severity: 'LOW',
                description: `Teacher ${currentTeacher} has too many consecutive sessions on ${day}`,
                affectedEntities: [sortedSessions[i].id],
                suggestedResolution: 'Provide breaks between consecutive sessions',
                cost: preference.weight * 8,
              });
            }
          } else {
            consecutiveTeacherCount = 1;
            currentTeacher = sortedSessions[i].teacherId;
          }
        }
      }
    }
    
    return violations;
  }

  getCost(context: ConstraintContext): number {
    return this.validate(context).reduce((sum, violation) => sum + violation.cost, 0);
  }

  calculatePenalty(context: ConstraintContext): number {
    return this.getCost(context);
  }
}


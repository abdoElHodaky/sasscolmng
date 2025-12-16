import { Injectable, Logger } from '@nestjs/common';
import { BaseConstraint, ConstraintViolation, ConstraintContext, HardConstraint } from './constraint.interface';

@Injectable()
export class HardConstraintsService {
  private readonly logger = new Logger(HardConstraintsService.name);
  private constraints: HardConstraint[] = [];

  constructor() {
    this.initializeConstraints();
  }

  private initializeConstraints() {
    this.constraints = [
      new TeacherConflictConstraint(),
      new RoomConflictConstraint(),
      new ClassConflictConstraint(),
      new TeacherAvailabilityConstraint(),
      new RoomCapacityConstraint(),
      new TimeSlotValidityConstraint(),
    ];
  }

  validateAll(context: ConstraintContext): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const constraint of this.constraints) {
      try {
        const constraintViolations = constraint.validate(context);
        violations.push(...constraintViolations);
      } catch (error) {
        this.logger.error(`Error validating constraint ${constraint.id}: ${error.message}`);
      }
    }

    return violations.sort((a, b) => {
      const severityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  validateConstraint(constraintId: string, context: ConstraintContext): ConstraintViolation[] {
    const constraint = this.constraints.find(c => c.id === constraintId);
    if (!constraint) {
      throw new Error(`Constraint ${constraintId} not found`);
    }

    return constraint.validate(context);
  }

  getConstraints(): HardConstraint[] {
    return this.constraints;
  }

  hasViolations(context: ConstraintContext): boolean {
    return this.constraints.some(constraint => constraint.isViolated(context));
  }
}

// Teacher Conflict Constraint
class TeacherConflictConstraint extends BaseConstraint implements HardConstraint {
  id = 'TEACHER_CONFLICT';
  name = 'Teacher Conflict';
  description = 'A teacher cannot be in two places at the same time';
  type: 'HARD' = 'HARD';
  priority = 10;

  validate(context: ConstraintContext): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const teacherSchedule = new Map<string, Set<string>>();

    // Group sessions by teacher and time
    for (const session of context.sessions) {
      const key = `${session.teacherId}-${session.timeSlotId}-${session.date}`;
      if (!teacherSchedule.has(key)) {
        teacherSchedule.set(key, new Set());
      }
      teacherSchedule.get(key)!.add(session.id);
    }

    // Check for conflicts
    for (const [key, sessionIds] of teacherSchedule.entries()) {
      if (sessionIds.size > 1) {
        const [teacherId, timeSlotId, date] = key.split('-');
        const teacher = context.teachers.find(t => t.id === teacherId);
        const timeSlot = context.timeSlots.find(ts => ts.id === timeSlotId);

        violations.push({
          constraintId: this.id,
          constraintType: this.name,
          severity: 'HIGH',
          description: `Teacher ${teacher?.firstName} ${teacher?.lastName} has multiple sessions scheduled at ${timeSlot?.name} on ${date}`,
          affectedEntities: Array.from(sessionIds),
          suggestedResolution: 'Reschedule one of the conflicting sessions to a different time slot',
          cost: 1000,
        });
      }
    }

    return violations;
  }

  getCost(context: ConstraintContext): number {
    return this.validate(context).reduce((sum, violation) => sum + violation.cost, 0);
  }

  isViolated(context: ConstraintContext): boolean {
    return this.validate(context).length > 0;
  }
}

// Room Conflict Constraint
class RoomConflictConstraint extends BaseConstraint implements HardConstraint {
  id = 'ROOM_CONFLICT';
  name = 'Room Conflict';
  description = 'A room cannot host multiple sessions at the same time';
  type: 'HARD' = 'HARD';
  priority = 10;

  validate(context: ConstraintContext): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const roomSchedule = new Map<string, Set<string>>();

    // Group sessions by room and time
    for (const session of context.sessions) {
      const key = `${session.roomId}-${session.timeSlotId}-${session.date}`;
      if (!roomSchedule.has(key)) {
        roomSchedule.set(key, new Set());
      }
      roomSchedule.get(key)!.add(session.id);
    }

    // Check for conflicts
    for (const [key, sessionIds] of roomSchedule.entries()) {
      if (sessionIds.size > 1) {
        const [roomId, timeSlotId, date] = key.split('-');
        const room = context.rooms.find(r => r.id === roomId);
        const timeSlot = context.timeSlots.find(ts => ts.id === timeSlotId);

        violations.push({
          constraintId: this.id,
          constraintType: this.name,
          severity: 'HIGH',
          description: `Room ${room?.name} has multiple sessions scheduled at ${timeSlot?.name} on ${date}`,
          affectedEntities: Array.from(sessionIds),
          suggestedResolution: 'Move one of the conflicting sessions to a different room',
          cost: 1000,
        });
      }
    }

    return violations;
  }

  getCost(context: ConstraintContext): number {
    return this.validate(context).reduce((sum, violation) => sum + violation.cost, 0);
  }

  isViolated(context: ConstraintContext): boolean {
    return this.validate(context).length > 0;
  }
}

// Class Conflict Constraint
class ClassConflictConstraint extends BaseConstraint implements HardConstraint {
  id = 'CLASS_CONFLICT';
  name = 'Class Conflict';
  description = 'A class cannot attend multiple sessions at the same time';
  type: 'HARD' = 'HARD';
  priority = 10;

  validate(context: ConstraintContext): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const classSchedule = new Map<string, Set<string>>();

    // Group sessions by class and time
    for (const session of context.sessions) {
      const key = `${session.classId}-${session.timeSlotId}-${session.date}`;
      if (!classSchedule.has(key)) {
        classSchedule.set(key, new Set());
      }
      classSchedule.get(key)!.add(session.id);
    }

    // Check for conflicts
    for (const [key, sessionIds] of classSchedule.entries()) {
      if (sessionIds.size > 1) {
        const [classId, timeSlotId, date] = key.split('-');
        const classEntity = context.classes.find(c => c.id === classId);
        const timeSlot = context.timeSlots.find(ts => ts.id === timeSlotId);

        violations.push({
          constraintId: this.id,
          constraintType: this.name,
          severity: 'HIGH',
          description: `Class ${classEntity?.name} has multiple sessions scheduled at ${timeSlot?.name} on ${date}`,
          affectedEntities: Array.from(sessionIds),
          suggestedResolution: 'Reschedule one of the conflicting sessions to a different time slot',
          cost: 1000,
        });
      }
    }

    return violations;
  }

  getCost(context: ConstraintContext): number {
    return this.validate(context).reduce((sum, violation) => sum + violation.cost, 0);
  }

  isViolated(context: ConstraintContext): boolean {
    return this.validate(context).length > 0;
  }
}

// Teacher Availability Constraint
class TeacherAvailabilityConstraint extends BaseConstraint implements HardConstraint {
  id = 'TEACHER_AVAILABILITY';
  name = 'Teacher Availability';
  description = 'Teachers can only be scheduled during their available hours';
  type: 'HARD' = 'HARD';
  priority = 9;

  validate(context: ConstraintContext): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // This would require teacher availability data from the database
    // For now, we'll implement a basic version
    for (const session of context.sessions) {
      const teacher = context.teachers.find(t => t.id === session.teacherId);
      const timeSlot = context.timeSlots.find(ts => ts.id === session.timeSlotId);

      if (teacher && timeSlot) {
        // Check if teacher has availability restrictions
        // This would be implemented with actual availability data
        const isAvailable = this.checkTeacherAvailability(teacher, timeSlot, session.date);
        
        if (!isAvailable) {
          violations.push({
            constraintId: this.id,
            constraintType: this.name,
            severity: 'HIGH',
            description: `Teacher ${teacher.firstName} ${teacher.lastName} is not available at ${timeSlot.name}`,
            affectedEntities: [session.id],
            suggestedResolution: 'Reschedule to a time when the teacher is available',
            cost: 800,
          });
        }
      }
    }

    return violations;
  }

  getCost(context: ConstraintContext): number {
    return this.validate(context).reduce((sum, violation) => sum + violation.cost, 0);
  }

  isViolated(context: ConstraintContext): boolean {
    return this.validate(context).length > 0;
  }

  private checkTeacherAvailability(teacher: any, timeSlot: any, date: string): boolean {
    // This would check against actual teacher availability data
    // For now, assume all teachers are available during regular hours (8 AM - 6 PM)
    const startHour = parseInt(timeSlot.startTime.split(':')[0]);
    return startHour >= 8 && startHour < 18;
  }
}

// Room Capacity Constraint
class RoomCapacityConstraint extends BaseConstraint implements HardConstraint {
  id = 'ROOM_CAPACITY';
  name = 'Room Capacity';
  description = 'Room capacity must not be exceeded';
  type: 'HARD' = 'HARD';
  priority = 8;

  validate(context: ConstraintContext): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const session of context.sessions) {
      const room = context.rooms.find(r => r.id === session.roomId);
      const classEntity = context.classes.find(c => c.id === session.classId);

      if (room && classEntity && room.capacity < classEntity.currentEnrollment) {
        violations.push({
          constraintId: this.id,
          constraintType: this.name,
          severity: 'HIGH',
          description: `Room ${room.name} (capacity: ${room.capacity}) cannot accommodate class ${classEntity.name} (${classEntity.currentEnrollment} students)`,
          affectedEntities: [session.id],
          suggestedResolution: 'Move to a larger room or split the class',
          cost: 600,
        });
      }
    }

    return violations;
  }

  getCost(context: ConstraintContext): number {
    return this.validate(context).reduce((sum, violation) => sum + violation.cost, 0);
  }

  isViolated(context: ConstraintContext): boolean {
    return this.validate(context).length > 0;
  }
}

// Time Slot Validity Constraint
class TimeSlotValidityConstraint extends BaseConstraint implements HardConstraint {
  id = 'TIME_SLOT_VALIDITY';
  name = 'Time Slot Validity';
  description = 'Sessions must be scheduled in valid, active time slots';
  type: 'HARD' = 'HARD';
  priority = 10;

  validate(context: ConstraintContext): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const session of context.sessions) {
      const timeSlot = context.timeSlots.find(ts => ts.id === session.timeSlotId);

      if (!timeSlot) {
        violations.push({
          constraintId: this.id,
          constraintType: this.name,
          severity: 'HIGH',
          description: `Session references non-existent time slot: ${session.timeSlotId}`,
          affectedEntities: [session.id],
          suggestedResolution: 'Assign a valid time slot to the session',
          cost: 1000,
        });
      } else if (!timeSlot.isActive) {
        violations.push({
          constraintId: this.id,
          constraintType: this.name,
          severity: 'MEDIUM',
          description: `Session is scheduled in inactive time slot: ${timeSlot.name}`,
          affectedEntities: [session.id],
          suggestedResolution: 'Move to an active time slot',
          cost: 400,
        });
      }
    }

    return violations;
  }

  getCost(context: ConstraintContext): number {
    return this.validate(context).reduce((sum, violation) => sum + violation.cost, 0);
  }

  isViolated(context: ConstraintContext): boolean {
    return this.validate(context).length > 0;
  }
}


export interface ConstraintViolation {
  constraintId: string;
  constraintType: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  affectedEntities: string[];
  suggestedResolution?: string;
  cost: number;
}

export interface ConstraintContext {
  schoolId: string;
  scheduleId: string;
  sessions: any[];
  timeSlots: any[];
  teachers: any[];
  rooms: any[];
  classes: any[];
  subjects: any[];
  preferences: any[];
  rules: any[];
}

export abstract class BaseConstraint {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract type: 'HARD' | 'SOFT';
  abstract priority: number;

  abstract validate(context: ConstraintContext): ConstraintViolation[];
  abstract getCost(context: ConstraintContext): number;
}

export interface HardConstraint extends BaseConstraint {
  type: 'HARD';
  isViolated(context: ConstraintContext): boolean;
}

export interface SoftConstraint extends BaseConstraint {
  type: 'SOFT';
  weight: number;
  calculatePenalty(context: ConstraintContext): number;
}


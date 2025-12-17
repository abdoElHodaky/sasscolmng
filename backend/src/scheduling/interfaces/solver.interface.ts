export interface SchedulingRequest {
  scheduleId: string;
  schoolId: string;              // School context
  constraints: ConstraintSet;
  preferences: PreferenceSet;
  resources: ResourceSet;
  timeHorizon: TimeHorizon;
  existingSessions?: ScheduledSession[];  // Current sessions to optimize
  teachers?: TeacherResource[];   // Direct access for backward compatibility
  rooms?: RoomResource[];         // Direct access for backward compatibility
  subjects?: SubjectResource[];   // Direct access for backward compatibility
  classes?: ClassResource[];      // Direct access for backward compatibility
  timeSlots?: TimeSlotResource[]; // Direct access for backward compatibility
}

export interface SchedulingResult {
  success: boolean;
  scheduleId: string;
  sessions: ScheduledSession[];
  schedule: ScheduledSession[];  // Alias for backward compatibility
  conflicts: Conflict[];
  metrics: OptimizationMetrics;
  optimizationScore: number;     // Direct access to score
  solvingTime: number;           // Execution time in milliseconds
  message?: string;              // Error or success message
  warnings: string[];
}

export interface ConstraintSet {
  hard: HardConstraint[];
  soft: SoftConstraint[];
}

export interface PreferenceSet {
  teacherPreferences: TeacherPreference[];
  roomPreferences: RoomPreference[];
  timePreferences: TimePreference[];
}

export interface ResourceSet {
  teachers: TeacherResource[];
  rooms: RoomResource[];
  subjects: SubjectResource[];
  classes: ClassResource[];
}

export interface TimeHorizon {
  startDate: Date;
  endDate: Date;
  workingDays: number[];
  timeSlots: TimeSlotResource[];
}

export interface ScheduledSession {
  id: string;
  subjectId: string;
  classId: string;
  teacherId: string;
  roomId: string;
  timeSlotId: string;
  dayOfWeek: number;
  startTime: Date;
  endTime: Date;
  date: Date;
  duration: number;
  type?: string;
}

export interface Conflict {
  type: 'TEACHER_CONFLICT' | 'ROOM_CONFLICT' | 'CLASS_CONFLICT' | 'TIME_CONFLICT';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  affectedSessions: string[];
}

export interface OptimizationMetrics {
  totalSessions: number;
  scheduledSessions: number;
  unscheduledSessions: number;
  conflictCount: number;
  optimizationScore: number;
  executionTime: number;
}

export interface HardConstraint {
  type: string;
  parameters: Record<string, any>;
}

export interface SoftConstraint {
  type: string;
  weight: number;
  parameters: Record<string, any>;
}

export interface TeacherPreference {
  teacherId: string;
  preferredTimeSlots: string[];
  unavailableTimeSlots: string[];
  maxConsecutiveHours: number;
  preferredRooms: string[];
}

export interface RoomPreference {
  roomId: string;
  preferredSubjects: string[];
  capacity: number;
  equipment: string[];
}

export interface TimePreference {
  timeSlotId: string;
  weight: number;
  description: string;
}

export interface TeacherResource {
  id: string;
  name: string;
  subjects: string[];
  maxHoursPerWeek: number;
  availability: TimeSlotAvailability[];
}

export interface RoomResource {
  id: string;
  name: string;
  capacity: number;
  equipment: string[];
  availability: TimeSlotAvailability[];
}

export interface SubjectResource {
  id: string;
  name: string;
  hoursPerWeek: number;
  requiresSpecialEquipment: string[];
}

export interface ClassResource {
  id: string;
  name: string;
  studentCount: number;
  subjects: string[];
}

export interface TimeSlotResource {
  id: string;
  startTime: string;
  endTime: string;
  dayOfWeek: number;
  duration: number;
}

export interface TimeSlotAvailability {
  timeSlotId: string;
  isAvailable: boolean;
  reason?: string;
}

export interface SolverConfiguration {
  algorithm: 'OR_TOOLS' | 'GENETIC' | 'SIMULATED_ANNEALING';
  maxExecutionTime: number;
  maxSolvingTimeSeconds: number;  // Alias for backward compatibility
  optimizationLevel: 'FAST' | 'BALANCED' | 'THOROUGH';
  parallelization: boolean;
  enableParallelSolving?: boolean; // Alias for parallelization
  memoryLimitMB?: number;
  parameters: Record<string, any>;
}

export interface ISolver {
  solve(request: SchedulingRequest, config: SolverConfiguration): Promise<SchedulingResult>;
  validateRequest(request: SchedulingRequest): Promise<boolean>;
  getCapabilities(): SolverCapabilities;
}

export interface SolverCapabilities {
  supportedConstraints: string[];
  maxResources: {
    teachers: number;
    rooms: number;
    classes: number;
    timeSlots: number;
  };
  features: string[];
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ScheduleStatus } from '@prisma/client';

export interface ScheduleVersion {
  id: string;
  scheduleId: string;
  version: number;
  name: string;
  description?: string;
  status: ScheduleStatus;
  optimizationScore?: number;
  conflictCount: number;
  sessionCount: number;
  createdBy: string;
  createdAt: Date;
  isActive: boolean;
}

export interface CreateVersionDto {
  scheduleId: string;
  name: string;
  description?: string;
  createdBy: string;
}

export interface RollbackDto {
  scheduleId: string;
  targetVersion: number;
  rollbackBy: string;
  reason: string;
}

@Injectable()
export class ScheduleVersioningService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new version of a schedule
   */
  async createVersion(createVersionDto: CreateVersionDto): Promise<ScheduleVersion> {
    const { scheduleId, name, description, createdBy } = createVersionDto;

    // Get the current schedule
    const currentSchedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        sessions: true,
        conflicts: true,
      },
    });

    if (!currentSchedule) {
      throw new NotFoundException(`Schedule with ID ${scheduleId} not found`);
    }

    // Get the next version number
    const latestVersion = await this.prisma.scheduleVersion.findFirst({
      where: { scheduleId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latestVersion?.version || 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      // Create the version record
      const scheduleVersion = await tx.scheduleVersion.create({
        data: {
          scheduleId,
          version: nextVersion,
          name,
          description,
          status: currentSchedule.status,
          optimizationScore: currentSchedule.optimizationScore,
          conflictCount: currentSchedule.conflictCount,
          sessionCount: currentSchedule.sessions.length,
          createdBy,
          isActive: false, // New versions start as inactive
          metadata: {
            originalScheduleData: {
              name: currentSchedule.name,
              description: currentSchedule.description,
              startDate: currentSchedule.startDate,
              endDate: currentSchedule.endDate,
              status: currentSchedule.status,
              optimizationScore: currentSchedule.optimizationScore,
              conflictCount: currentSchedule.conflictCount,
            },
          },
        },
      });

      // Copy all sessions to the version
      if (currentSchedule.sessions.length > 0) {
        const versionSessions = currentSchedule.sessions.map(session => ({
          scheduleVersionId: scheduleVersion.id,
          subjectId: session.subjectId,
          classId: session.classId,
          teacherId: session.teacherId,
          roomId: session.roomId,
          timeSlotId: session.timeSlotId,
          date: session.date,
          duration: session.duration,
          type: session.type,
          status: session.status,
          isRecurring: session.isRecurring,
          recurrencePattern: session.recurrencePattern,
          notes: session.notes,
          metadata: session.metadata,
        }));

        await tx.scheduleVersionSession.createMany({
          data: versionSessions,
        });
      }

      // Copy all conflicts to the version
      if (currentSchedule.conflicts.length > 0) {
        const versionConflicts = currentSchedule.conflicts.map(conflict => ({
          scheduleVersionId: scheduleVersion.id,
          type: conflict.type,
          severity: conflict.severity,
          description: conflict.description,
          affectedSessionIds: conflict.affectedSessionIds,
          suggestedResolution: conflict.suggestedResolution,
          isResolved: conflict.isResolved,
          resolutionNotes: conflict.resolutionNotes,
          resolvedBy: conflict.resolvedBy,
          resolvedAt: conflict.resolvedAt,
        }));

        await tx.scheduleVersionConflict.createMany({
          data: versionConflicts,
        });
      }

      return scheduleVersion;
    });
  }

  /**
   * Get all versions of a schedule
   */
  async getVersions(scheduleId: string): Promise<ScheduleVersion[]> {
    const versions = await this.prisma.scheduleVersion.findMany({
      where: { scheduleId },
      orderBy: { version: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            sessions: true,
            conflicts: true,
          },
        },
      },
    });

    return versions.map(version => ({
      id: version.id,
      scheduleId: version.scheduleId,
      version: version.version,
      name: version.name,
      description: version.description,
      status: version.status,
      optimizationScore: version.optimizationScore,
      conflictCount: version.conflictCount,
      sessionCount: version._count.sessions,
      createdBy: version.createdBy,
      createdAt: version.createdAt,
      isActive: version.isActive,
    }));
  }

  /**
   * Get a specific version
   */
  async getVersion(scheduleId: string, version: number): Promise<any> {
    const scheduleVersion = await this.prisma.scheduleVersion.findFirst({
      where: {
        scheduleId,
        version,
      },
      include: {
        sessions: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            class: { select: { id: true, name: true, grade: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
            room: { select: { id: true, name: true, type: true } },
            timeSlot: { select: { id: true, name: true, dayOfWeek: true, startTime: true, endTime: true } },
          },
        },
        conflicts: true,
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!scheduleVersion) {
      throw new NotFoundException(`Version ${version} of schedule ${scheduleId} not found`);
    }

    return scheduleVersion;
  }

  /**
   * Activate a specific version (make it the current schedule)
   */
  async activateVersion(scheduleId: string, version: number, activatedBy: string): Promise<any> {
    const scheduleVersion = await this.getVersion(scheduleId, version);

    if (!scheduleVersion) {
      throw new NotFoundException(`Version ${version} of schedule ${scheduleId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Deactivate all other versions
      await tx.scheduleVersion.updateMany({
        where: { scheduleId },
        data: { isActive: false },
      });

      // Activate the target version
      await tx.scheduleVersion.update({
        where: { id: scheduleVersion.id },
        data: { isActive: true },
      });

      // Clear current schedule sessions and conflicts
      await tx.scheduleSession.deleteMany({
        where: { scheduleId },
      });

      await tx.scheduleConflict.deleteMany({
        where: { scheduleId },
      });

      // Copy version sessions to current schedule
      if (scheduleVersion.sessions.length > 0) {
        const currentSessions = scheduleVersion.sessions.map(session => ({
          scheduleId,
          subjectId: session.subjectId,
          classId: session.classId,
          teacherId: session.teacherId,
          roomId: session.roomId,
          timeSlotId: session.timeSlotId,
          date: session.date,
          duration: session.duration,
          type: session.type,
          status: session.status,
          isRecurring: session.isRecurring,
          recurrencePattern: session.recurrencePattern,
          notes: session.notes,
          metadata: session.metadata,
        }));

        await tx.scheduleSession.createMany({
          data: currentSessions,
        });
      }

      // Copy version conflicts to current schedule
      if (scheduleVersion.conflicts.length > 0) {
        const currentConflicts = scheduleVersion.conflicts.map(conflict => ({
          scheduleId,
          type: conflict.type,
          severity: conflict.severity,
          description: conflict.description,
          affectedSessionIds: conflict.affectedSessionIds,
          suggestedResolution: conflict.suggestedResolution,
          isResolved: conflict.isResolved,
          resolutionNotes: conflict.resolutionNotes,
          resolvedBy: conflict.resolvedBy,
          resolvedAt: conflict.resolvedAt,
        }));

        await tx.scheduleConflict.createMany({
          data: currentConflicts,
        });
      }

      // Update schedule metadata
      await tx.schedule.update({
        where: { id: scheduleId },
        data: {
          status: scheduleVersion.status,
          optimizationScore: scheduleVersion.optimizationScore,
          conflictCount: scheduleVersion.conflictCount,
          version: scheduleVersion.version,
          updatedAt: new Date(),
        },
      });

      return {
        message: `Schedule version ${version} activated successfully`,
        scheduleId,
        version: scheduleVersion.version,
        activatedBy,
        activatedAt: new Date(),
      };
    });
  }

  /**
   * Rollback to a previous version
   */
  async rollback(rollbackDto: RollbackDto): Promise<any> {
    const { scheduleId, targetVersion, rollbackBy, reason } = rollbackDto;

    // Validate that target version exists
    const targetVersionData = await this.getVersion(scheduleId, targetVersion);

    if (!targetVersionData) {
      throw new NotFoundException(`Version ${targetVersion} of schedule ${scheduleId} not found`);
    }

    // Get current version
    const currentSchedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!currentSchedule) {
      throw new NotFoundException(`Schedule with ID ${scheduleId} not found`);
    }

    if (currentSchedule.version === targetVersion) {
      throw new BadRequestException(`Schedule is already at version ${targetVersion}`);
    }

    // Create a backup version of current state before rollback
    await this.createVersion({
      scheduleId,
      name: `Backup before rollback to v${targetVersion}`,
      description: `Automatic backup created before rolling back to version ${targetVersion}. Reason: ${reason}`,
      createdBy: rollbackBy,
    });

    // Activate the target version
    const result = await this.activateVersion(scheduleId, targetVersion, rollbackBy);

    return {
      ...result,
      message: `Schedule rolled back to version ${targetVersion} successfully`,
      reason,
      previousVersion: currentSchedule.version,
    };
  }

  /**
   * Compare two versions
   */
  async compareVersions(scheduleId: string, version1: number, version2: number): Promise<any> {
    const [v1, v2] = await Promise.all([
      this.getVersion(scheduleId, version1),
      this.getVersion(scheduleId, version2),
    ]);

    if (!v1 || !v2) {
      throw new NotFoundException('One or both versions not found');
    }

    // Compare basic metrics
    const comparison = {
      version1: {
        version: v1.version,
        name: v1.name,
        sessionCount: v1.sessions.length,
        conflictCount: v1.conflicts.length,
        optimizationScore: v1.optimizationScore,
        status: v1.status,
        createdAt: v1.createdAt,
      },
      version2: {
        version: v2.version,
        name: v2.name,
        sessionCount: v2.sessions.length,
        conflictCount: v2.conflicts.length,
        optimizationScore: v2.optimizationScore,
        status: v2.status,
        createdAt: v2.createdAt,
      },
      differences: {
        sessionCountDiff: v2.sessions.length - v1.sessions.length,
        conflictCountDiff: v2.conflicts.length - v1.conflicts.length,
        optimizationScoreDiff: (v2.optimizationScore || 0) - (v1.optimizationScore || 0),
        statusChanged: v1.status !== v2.status,
      },
    };

    return comparison;
  }

  /**
   * Delete a version
   */
  async deleteVersion(scheduleId: string, version: number): Promise<void> {
    const scheduleVersion = await this.prisma.scheduleVersion.findFirst({
      where: { scheduleId, version },
    });

    if (!scheduleVersion) {
      throw new NotFoundException(`Version ${version} of schedule ${scheduleId} not found`);
    }

    if (scheduleVersion.isActive) {
      throw new BadRequestException('Cannot delete the active version');
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete version sessions
      await tx.scheduleVersionSession.deleteMany({
        where: { scheduleVersionId: scheduleVersion.id },
      });

      // Delete version conflicts
      await tx.scheduleVersionConflict.deleteMany({
        where: { scheduleVersionId: scheduleVersion.id },
      });

      // Delete the version
      await tx.scheduleVersion.delete({
        where: { id: scheduleVersion.id },
      });
    });
  }

  /**
   * Get version statistics
   */
  async getVersionStatistics(scheduleId: string): Promise<any> {
    const versions = await this.prisma.scheduleVersion.findMany({
      where: { scheduleId },
      select: {
        version: true,
        optimizationScore: true,
        conflictCount: true,
        sessionCount: true,
        createdAt: true,
        isActive: true,
      },
      orderBy: { version: 'asc' },
    });

    if (versions.length === 0) {
      return {
        totalVersions: 0,
        activeVersion: null,
        averageOptimizationScore: 0,
        averageConflictCount: 0,
        versionHistory: [],
      };
    }

    const activeVersion = versions.find(v => v.isActive);
    const avgOptimizationScore = versions
      .filter(v => v.optimizationScore !== null)
      .reduce((sum, v) => sum + (v.optimizationScore || 0), 0) / versions.length;
    const avgConflictCount = versions.reduce((sum, v) => sum + v.conflictCount, 0) / versions.length;

    return {
      totalVersions: versions.length,
      activeVersion: activeVersion?.version || null,
      averageOptimizationScore: Math.round(avgOptimizationScore * 100) / 100,
      averageConflictCount: Math.round(avgConflictCount * 100) / 100,
      versionHistory: versions.map(v => ({
        version: v.version,
        optimizationScore: v.optimizationScore,
        conflictCount: v.conflictCount,
        sessionCount: v.sessionCount,
        createdAt: v.createdAt,
        isActive: v.isActive,
      })),
    };
  }
}

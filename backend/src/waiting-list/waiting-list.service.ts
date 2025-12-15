import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateWaitingListDto, UpdateWaitingListDto, AssignFromWaitingListDto } from './dto';
import { WaitingListStatus, WaitingListPriority } from '@prisma/client';

export interface WaitingListEntry {
  id: string;
  schoolId: string;
  subjectId: string;
  classId: string;
  teacherId?: string;
  roomId?: string;
  timeSlotId?: string;
  priority: WaitingListPriority;
  status: WaitingListStatus;
  requestedBy: string;
  reason: string;
  notes?: string;
  requestedAt: Date;
  assignedAt?: Date;
  assignedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class WaitingListService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createWaitingListDto: CreateWaitingListDto): Promise<WaitingListEntry> {
    const { schoolId, subjectId, classId, teacherId, roomId, timeSlotId, priority, requestedBy, reason, notes } = createWaitingListDto;

    // Validate that the referenced entities exist
    await this.validateReferences(schoolId, subjectId, classId, teacherId, roomId, timeSlotId);

    // Check if similar entry already exists in waiting list
    const existingEntry = await this.prisma.waitingList.findFirst({
      where: {
        schoolId,
        subjectId,
        classId,
        teacherId,
        roomId,
        timeSlotId,
        status: {
          in: [WaitingListStatus.PENDING, WaitingListStatus.IN_PROGRESS],
        },
      },
    });

    if (existingEntry) {
      throw new BadRequestException('Similar entry already exists in waiting list');
    }

    return this.prisma.waitingList.create({
      data: {
        schoolId,
        subjectId,
        classId,
        teacherId,
        roomId,
        timeSlotId,
        priority: priority || WaitingListPriority.MEDIUM,
        status: WaitingListStatus.PENDING,
        requestedBy,
        reason,
        notes,
        requestedAt: new Date(),
      },
      include: {
        school: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, grade: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        room: { select: { id: true, name: true, type: true } },
        timeSlot: { select: { id: true, name: true, dayOfWeek: true, startTime: true, endTime: true } },
        requester: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAll(
    schoolId: string,
    status?: WaitingListStatus,
    priority?: WaitingListPriority,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const where: any = { schoolId };

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    const [entries, total] = await Promise.all([
      this.prisma.waitingList.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { priority: 'desc' }, // High priority first
          { requestedAt: 'asc' }, // Older requests first
        ],
        include: {
          school: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true, code: true } },
          class: { select: { id: true, name: true, grade: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
          room: { select: { id: true, name: true, type: true } },
          timeSlot: { select: { id: true, name: true, dayOfWeek: true, startTime: true, endTime: true } },
          requester: { select: { id: true, firstName: true, lastName: true } },
          assigner: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.waitingList.count({ where }),
    ]);

    return {
      data: entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<WaitingListEntry> {
    const entry = await this.prisma.waitingList.findUnique({
      where: { id },
      include: {
        school: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, grade: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        room: { select: { id: true, name: true, type: true } },
        timeSlot: { select: { id: true, name: true, dayOfWeek: true, startTime: true, endTime: true } },
        requester: { select: { id: true, firstName: true, lastName: true } },
        assigner: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Waiting list entry with ID ${id} not found`);
    }

    return entry;
  }

  async update(id: string, updateWaitingListDto: UpdateWaitingListDto): Promise<WaitingListEntry> {
    const existingEntry = await this.findOne(id);

    if (existingEntry.status === WaitingListStatus.ASSIGNED) {
      throw new BadRequestException('Cannot update already assigned waiting list entry');
    }

    return this.prisma.waitingList.update({
      where: { id },
      data: {
        ...updateWaitingListDto,
        updatedAt: new Date(),
      },
      include: {
        school: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, grade: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        room: { select: { id: true, name: true, type: true } },
        timeSlot: { select: { id: true, name: true, dayOfWeek: true, startTime: true, endTime: true } },
        requester: { select: { id: true, firstName: true, lastName: true } },
        assigner: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async assignFromWaitingList(assignDto: AssignFromWaitingListDto): Promise<any> {
    const { waitingListId, scheduleId, assignedBy, notes } = assignDto;

    const waitingListEntry = await this.findOne(waitingListId);

    if (waitingListEntry.status !== WaitingListStatus.PENDING) {
      throw new BadRequestException('Only pending waiting list entries can be assigned');
    }

    // Start transaction to ensure data consistency
    return this.prisma.$transaction(async (tx) => {
      // Update waiting list entry status
      const updatedEntry = await tx.waitingList.update({
        where: { id: waitingListId },
        data: {
          status: WaitingListStatus.ASSIGNED,
          assignedAt: new Date(),
          assignedBy,
          notes: notes || waitingListEntry.notes,
        },
      });

      // Create schedule session from waiting list entry
      const scheduleSession = await tx.scheduleSession.create({
        data: {
          scheduleId,
          subjectId: waitingListEntry.subjectId,
          classId: waitingListEntry.classId,
          teacherId: waitingListEntry.teacherId!,
          roomId: waitingListEntry.roomId!,
          timeSlotId: waitingListEntry.timeSlotId!,
          date: new Date(), // This should be calculated based on schedule dates
          duration: 45, // Default duration, should be configurable
          type: 'REGULAR',
          status: 'SCHEDULED',
          notes: `Assigned from waiting list: ${waitingListEntry.reason}`,
        },
      });

      return {
        waitingListEntry: updatedEntry,
        scheduleSession,
      };
    });
  }

  async remove(id: string): Promise<void> {
    const entry = await this.findOne(id);

    if (entry.status === WaitingListStatus.ASSIGNED) {
      throw new BadRequestException('Cannot delete assigned waiting list entry');
    }

    await this.prisma.waitingList.delete({
      where: { id },
    });
  }

  async getStatistics(schoolId: string) {
    const [
      totalEntries,
      pendingEntries,
      inProgressEntries,
      assignedEntries,
      cancelledEntries,
      highPriorityEntries,
      averageWaitTime,
    ] = await Promise.all([
      this.prisma.waitingList.count({ where: { schoolId } }),
      this.prisma.waitingList.count({ where: { schoolId, status: WaitingListStatus.PENDING } }),
      this.prisma.waitingList.count({ where: { schoolId, status: WaitingListStatus.IN_PROGRESS } }),
      this.prisma.waitingList.count({ where: { schoolId, status: WaitingListStatus.ASSIGNED } }),
      this.prisma.waitingList.count({ where: { schoolId, status: WaitingListStatus.CANCELLED } }),
      this.prisma.waitingList.count({ where: { schoolId, priority: WaitingListPriority.HIGH } }),
      this.calculateAverageWaitTime(schoolId),
    ]);

    return {
      totalEntries,
      pendingEntries,
      inProgressEntries,
      assignedEntries,
      cancelledEntries,
      highPriorityEntries,
      averageWaitTime,
      assignmentRate: totalEntries > 0 ? (assignedEntries / totalEntries) * 100 : 0,
    };
  }

  private async calculateAverageWaitTime(schoolId: string): Promise<number> {
    const assignedEntries = await this.prisma.waitingList.findMany({
      where: {
        schoolId,
        status: WaitingListStatus.ASSIGNED,
        assignedAt: { not: null },
      },
      select: {
        requestedAt: true,
        assignedAt: true,
      },
    });

    if (assignedEntries.length === 0) {
      return 0;
    }

    const totalWaitTime = assignedEntries.reduce((sum, entry) => {
      const waitTime = entry.assignedAt!.getTime() - entry.requestedAt.getTime();
      return sum + waitTime;
    }, 0);

    return Math.round(totalWaitTime / assignedEntries.length / (1000 * 60 * 60)); // Convert to hours
  }

  private async validateReferences(
    schoolId: string,
    subjectId: string,
    classId: string,
    teacherId?: string,
    roomId?: string,
    timeSlotId?: string,
  ): Promise<void> {
    // Validate school
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      throw new NotFoundException(`School with ID ${schoolId} not found`);
    }

    // Validate subject
    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) {
      throw new NotFoundException(`Subject with ID ${subjectId} not found`);
    }

    // Validate class
    const classEntity = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    // Validate teacher if provided
    if (teacherId) {
      const teacher = await this.prisma.user.findUnique({ where: { id: teacherId } });
      if (!teacher) {
        throw new NotFoundException(`Teacher with ID ${teacherId} not found`);
      }
    }

    // Validate room if provided
    if (roomId) {
      const room = await this.prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        throw new NotFoundException(`Room with ID ${roomId} not found`);
      }
    }

    // Validate time slot if provided
    if (timeSlotId) {
      const timeSlot = await this.prisma.timeSlot.findUnique({ where: { id: timeSlotId } });
      if (!timeSlot) {
        throw new NotFoundException(`Time slot with ID ${timeSlotId} not found`);
      }
    }
  }
}

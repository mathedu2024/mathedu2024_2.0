import { FieldValue } from 'firebase-admin/firestore';
import { getTeacherCourseRecords } from './quizTeacherAccess';
import {
  findSurveyDocument,
  findSurveyDocumentByCode,
  isSurveyDbSeparated,
  mergeSurveyDocsById,
  migrateSurveyAndResponsesFromCore,
  surveysCollection,
} from './surveyDbSplit';
import {
  ensureSurveySections,
  extractAssignedCourseIds,
  generateSurveyCode,
  isValidSurveyCode,
  normalizeAssignedCourses,
  normalizeSection,
  normalizeSingleAssignedCourse,
  type Survey,
  type SurveyInput,
  type SurveySection,
} from './surveyTypes';

function canTeacherAccessSurvey(
  survey: Pick<Survey, 'teacherId' | 'assignedCourses' | 'courseId'>,
  teacherId: string,
  teacherCourseIds: Set<string>
): boolean {
  if (survey.teacherId === teacherId) return true;
  return normalizeAssignedCourses(survey).some((c) => teacherCourseIds.has(c.courseId));
}

class SurveyService {
  /** 新問卷一律寫入測驗／問卷專用庫 */
  private get collection() {
    return surveysCollection('quiz');
  }

  private serializeSurvey(docId: string, data: FirebaseFirestore.DocumentData): Survey {
    const rawSections = Array.isArray(data.sections) ? data.sections : [];
    const sections: SurveySection[] =
      rawSections.length > 0
        ? rawSections.map((s: unknown, i: number) => normalizeSection(s, i))
        : [normalizeSection(null, 0)];

    const assignedCourses = normalizeSingleAssignedCourse({
      assignedCourses: data.assignedCourses,
      courseId: data.courseId,
      courseName: data.courseName,
    });

    return ensureSurveySections({
      id: docId,
      surveyCode: String(data.surveyCode ?? ''),
      teacherId: data.teacherId ?? '',
      assignedCourses,
      courseId: assignedCourses[0]?.courseId,
      courseName: assignedCourses[0]?.courseName,
      title: data.title ?? '',
      description: data.description ?? '',
      status: data.status === 'published' ? 'published' : 'draft',
      sections,
      responseMode: data.responseMode === 'anonymous' ? 'anonymous' : 'named',
      answerWindowEnabled:
        data.answerWindowEnabled !== undefined
          ? !!data.answerWindowEnabled
          : !!(data.answerStartAt && data.answerEndAt),
      answerStartAt: data.answerStartAt?.toDate?.()?.toISOString?.() ?? data.answerStartAt ?? undefined,
      answerEndAt: data.answerEndAt?.toDate?.()?.toISOString?.() ?? data.answerEndAt ?? undefined,
      attemptLimit: Math.max(1, typeof data.attemptLimit === 'number' ? data.attemptLimit : 1),
      responsesVisibleToStudents: data.responsesVisibleToStudents !== false,
      order: typeof data.order === 'number' ? data.order : undefined,
      publishedAt: data.publishedAt?.toDate?.()?.toISOString?.() ?? data.publishedAt ?? undefined,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt,
    });
  }

  private async loadSurveyDocs(
    queryFn: (
      col: FirebaseFirestore.CollectionReference
    ) => Promise<FirebaseFirestore.QuerySnapshot>
  ): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
    const quizSnap = await queryFn(surveysCollection('quiz'));
    if (!isSurveyDbSeparated()) return quizSnap.docs;

    const coreSnap = await queryFn(surveysCollection('core'));
    return mergeSurveyDocsById(quizSnap.docs, coreSnap.docs);
  }

  private async codeExists(surveyCode: string, excludeId?: string): Promise<boolean> {
    const found = await findSurveyDocumentByCode(surveyCode);
    if (!found) return false;
    if (excludeId && found.id === excludeId) return false;
    return true;
  }

  private async generateUniqueSurveyCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = generateSurveyCode();
      if (!(await this.codeExists(code))) return code;
    }
    throw new Error('Failed to generate unique survey code');
  }

  private async nextOrderForCourse(courseId: string): Promise<number> {
    const collect = async (location: 'quiz' | 'core') => {
      const col = surveysCollection(location);
      const [byAssigned, byCourseId] = await Promise.all([
        col.where('assignedCourseIds', 'array-contains', courseId).get(),
        col.where('courseId', '==', courseId).get(),
      ]);
      return [...byAssigned.docs, ...byCourseId.docs];
    };

    const quizDocs = await collect('quiz');
    const coreDocs = isSurveyDbSeparated() ? await collect('core') : [];
    const docs = mergeSurveyDocsById(quizDocs, coreDocs);

    let max = -1;
    for (const doc of docs) {
      const value = doc.data().order;
      if (typeof value === 'number' && value > max) max = value;
    }
    return max + 1;
  }

  async listByTeacher(teacherId: string): Promise<Survey[]> {
    const docs = await this.loadSurveyDocs((col) => col.where('teacherId', '==', teacherId).get());
    return docs
      .map((d) => this.serializeSurvey(d.id, d.data()))
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });
  }

  async listAccessibleByTeacher(teacherId: string): Promise<Survey[]> {
    const teacherCourses = await getTeacherCourseRecords(teacherId);
    const teacherCourseIds = new Set(teacherCourses.map((c) => c.id));
    const own = await this.listByTeacher(teacherId);
    const map = new Map(own.map((s) => [s.id, s]));

    if (teacherCourses.length > 0) {
      const publishedDocs = await this.loadSurveyDocs((col) =>
        col.where('status', '==', 'published').get()
      );
      for (const doc of publishedDocs) {
        if (map.has(doc.id)) continue;
        const survey = this.serializeSurvey(doc.id, doc.data());
        if (canTeacherAccessSurvey(survey, teacherId, teacherCourseIds)) {
          map.set(survey.id, survey);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  async listPublished(): Promise<Survey[]> {
    const docs = await this.loadSurveyDocs((col) => col.where('status', '==', 'published').get());
    return docs.map((d) => this.serializeSurvey(d.id, d.data()));
  }

  async getById(surveyId: string): Promise<Survey | null> {
    const found = await findSurveyDocument(surveyId);
    if (!found) return null;
    return this.serializeSurvey(surveyId, found.data);
  }

  async getByCode(surveyCode: string): Promise<Survey | null> {
    if (!isValidSurveyCode(surveyCode)) return null;
    const found = await findSurveyDocumentByCode(surveyCode);
    if (!found) return null;
    return this.serializeSurvey(found.id, found.data);
  }

  async create(input: SurveyInput): Promise<{ surveyId: string; surveyCode: string }> {
    if (!input.teacherId || !input.title?.trim()) {
      throw new Error('Missing required fields');
    }

    let surveyCode = input.surveyCode?.trim() ?? '';
    if (!surveyCode || !isValidSurveyCode(surveyCode) || (await this.codeExists(surveyCode))) {
      surveyCode = await this.generateUniqueSurveyCode();
    }

    const sections = (input.sections ?? []).map((s, i) => normalizeSection(s, i));
    const assignedCourses = normalizeSingleAssignedCourse(input);
    const courseId = assignedCourses[0]?.courseId ?? '';
    const order =
      typeof input.order === 'number'
        ? input.order
        : courseId
          ? await this.nextOrderForCourse(courseId)
          : 0;

    const payload = {
      surveyCode,
      teacherId: input.teacherId,
      assignedCourses,
      assignedCourseIds: extractAssignedCourseIds({ assignedCourses }),
      courseId,
      courseName: assignedCourses[0]?.courseName ?? '',
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      status: input.status ?? 'draft',
      sections,
      responseMode: input.responseMode === 'anonymous' ? 'anonymous' : 'named',
      answerWindowEnabled: !!input.answerWindowEnabled,
      answerStartAt: input.answerWindowEnabled ? (input.answerStartAt ?? null) : null,
      answerEndAt: input.answerWindowEnabled ? (input.answerEndAt ?? null) : null,
      attemptLimit: Math.max(1, input.attemptLimit ?? 1),
      responsesVisibleToStudents: input.responsesVisibleToStudents !== false,
      order,
      ...(input.status === 'published' ? { publishedAt: FieldValue.serverTimestamp() } : {}),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await this.collection.add(payload);
    return { surveyId: docRef.id, surveyCode };
  }

  async update(surveyId: string, teacherId: string, input: Partial<SurveyInput>): Promise<void> {
    const found = await findSurveyDocument(surveyId);
    if (!found) throw new Error('Survey not found');

    const existing = this.serializeSurvey(surveyId, found.data);
    if (existing.teacherId !== teacherId) {
      throw new Error('Unauthorized');
    }

    const payload: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.description !== undefined) payload.description = input.description.trim();
    if (input.status !== undefined) {
      payload.status = input.status;
      if (input.status === 'published' && existing.status !== 'published') {
        payload.publishedAt = FieldValue.serverTimestamp();
      }
    }
    if (input.responseMode !== undefined) {
      payload.responseMode = input.responseMode === 'anonymous' ? 'anonymous' : 'named';
    }
    if (input.sections !== undefined) {
      payload.sections = input.sections.map((s, i) => normalizeSection(s, i));
    }
    if (
      input.assignedCourses !== undefined ||
      input.courseId !== undefined ||
      input.courseName !== undefined
    ) {
      const assignedCourses = normalizeSingleAssignedCourse({
        assignedCourses: input.assignedCourses,
        courseId: input.courseId,
        courseName: input.courseName,
      });
      payload.assignedCourses = assignedCourses;
      payload.assignedCourseIds = extractAssignedCourseIds({ assignedCourses });
      payload.courseId = assignedCourses[0]?.courseId ?? '';
      payload.courseName = assignedCourses[0]?.courseName ?? '';
    }
    if (input.answerWindowEnabled !== undefined) {
      payload.answerWindowEnabled = !!input.answerWindowEnabled;
      if (!input.answerWindowEnabled) {
        payload.answerStartAt = null;
        payload.answerEndAt = null;
      }
    }
    if (input.answerStartAt !== undefined) {
      payload.answerStartAt = input.answerWindowEnabled === false ? null : input.answerStartAt ?? null;
    }
    if (input.answerEndAt !== undefined) {
      payload.answerEndAt = input.answerWindowEnabled === false ? null : input.answerEndAt ?? null;
    }
    if (input.attemptLimit !== undefined) {
      payload.attemptLimit = Math.max(1, input.attemptLimit);
    }
    if (input.responsesVisibleToStudents !== undefined) {
      payload.responsesVisibleToStudents = !!input.responsesVisibleToStudents;
    }
    if (typeof input.order === 'number') payload.order = input.order;

    // 仍在舊庫：寫入新庫（含本次修改）→ 搬回應 → 刪舊庫
    if (found.location === 'core' && isSurveyDbSeparated()) {
      const migratedData = {
        ...found.data,
        ...payload,
      };
      await migrateSurveyAndResponsesFromCore(surveyId, migratedData);
    } else {
      await found.ref.update(payload);
    }
  }

  async delete(surveyId: string, teacherId: string): Promise<void> {
    const found = await findSurveyDocument(surveyId);
    if (!found) throw new Error('Survey not found');
    const existing = this.serializeSurvey(surveyId, found.data);
    if (existing.teacherId !== teacherId) {
      throw new Error('Unauthorized');
    }
    const { surveyResponseService } = await import('./surveyResponseService');
    await surveyResponseService.deleteBySurvey(surveyId);
    await found.ref.delete();
  }

  async reorder(teacherId: string, courseId: string, orderIds: string[]): Promise<void> {
    void teacherId;
    void courseId;
    for (let index = 0; index < orderIds.length; index++) {
      const found = await findSurveyDocument(orderIds[index]);
      if (!found) continue;
      await found.ref.update({
        order: index,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  /**
   * 複製問卷為獨立新問卷（新 surveyCode、草稿、單一班級），題目與設定沿用來源；填答紀錄不複製。
   */
  async duplicate(options: {
    teacherId: string;
    sourceSurveyCode?: string;
    surveyId?: string;
    courseId?: string;
    courseName?: string;
    title?: string;
  }): Promise<{ surveyId: string; surveyCode: string }> {
    const teacherId = options.teacherId?.trim();
    if (!teacherId) throw new Error('Missing required fields');

    const source = options.sourceSurveyCode?.trim()
      ? await this.getByCode(options.sourceSurveyCode.trim())
      : options.surveyId?.trim()
        ? await this.getById(options.surveyId.trim())
        : null;
    if (!source) throw new Error('Survey not found');

    const teacherCourses = await getTeacherCourseRecords(teacherId);
    const teacherCourseIds = new Set(teacherCourses.map((c) => c.id));
    if (!canTeacherAccessSurvey(source, teacherId, teacherCourseIds)) {
      throw new Error('Unauthorized');
    }

    let assignedCourses = normalizeSingleAssignedCourse(source);
    if (options.courseId?.trim()) {
      const courseId = options.courseId.trim();
      const matched = teacherCourses.find((c) => c.id === courseId);
      assignedCourses = [{
        courseId,
        courseName: options.courseName?.trim()
          || (matched ? `${matched.name}（${matched.code}）` : courseId),
      }];
    }

    const baseTitle = (options.title ?? source.title).trim() || '未命名問卷';
    const title = options.title?.trim()
      ? baseTitle
      : `${baseTitle.replace(/\s*（複製）\s*$/, '')}（複製）`;

    return this.create({
      surveyCode: '',
      teacherId,
      title,
      description: source.description,
      status: 'draft',
      sections: source.sections,
      responseMode: source.responseMode,
      answerWindowEnabled: !!source.answerWindowEnabled,
      answerStartAt: source.answerStartAt,
      answerEndAt: source.answerEndAt,
      attemptLimit: source.attemptLimit ?? 1,
      responsesVisibleToStudents: source.responsesVisibleToStudents !== false,
      assignedCourses,
    });
  }
}

export const surveyService = new SurveyService();

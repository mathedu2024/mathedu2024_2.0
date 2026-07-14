import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, quizDb } from './firebase-admin';
import {
  isSurveyDbSeparated,
  mergeSurveyDocsById,
  resolveSurveyResponseLocation,
  surveyResponsesCollection,
} from './surveyDbSplit';
import {
  flattenSurveyQuestions,
  isSurveyAnonymous,
  type Survey,
  type SurveyAnswerValue,
  type SurveyAnswers,
  type SurveyMatrixQuestion,
  type SurveyQuestion,
  type SurveyScaleQuestion,
} from './surveyTypes';
export interface SurveyResponse {
  id: string;
  surveyId: string;
  teacherId: string;
  studentId: string;
  /** 記名時為真實姓名；不記名時為空 */
  studentName: string;
  responseMode: 'named' | 'anonymous';
  answers: SurveyAnswers;
  attemptIndex: number;
  submittedAt: string;
}

export interface SurveyOptionStat {
  label: string;
  count: number;
}

export interface SurveyQuestionAnalytics {
  questionId: string;
  type: SurveyQuestion['type'];
  content: string;
  responseCount: number;
  optionStats?: SurveyOptionStat[];
  scaleAverage?: number;
  scaleDistribution?: SurveyOptionStat[];
  matrixRows?: Array<{
    rowId: string;
    label: string;
    average: number;
    distribution: SurveyOptionStat[];
  }>;
  textAnswers?: string[];
}

export interface SurveyAnalytics {
  totalResponses: number;
  responseMode: 'named' | 'anonymous';
  questions: SurveyQuestionAnalytics[];
}

function isValidAnswerForQuestion(q: SurveyQuestion, value: SurveyAnswerValue | undefined): boolean {
  if (value === undefined || value === null) return !q.required;
  if (q.type === 'single') {
    return typeof value === 'string' && value.trim() !== '';
  }
  if (q.type === 'multiple') {
    return Array.isArray(value) && value.length > 0;
  }
  if (q.type === 'short_answer') {
    return typeof value === 'string' && (!q.required || value.trim() !== '');
  }
  if (q.type === 'scale') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) && n >= 1 && n <= q.maxScore;
  }
  if (q.type === 'matrix') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const map = value as Record<string, number>;
    for (const row of q.rows) {
      if (!row.label.trim()) continue;
      const n = map[row.id];
      if (typeof n !== 'number' || n < 1 || n > q.maxScore) return false;
    }
    return true;
  }
  return true;
}

export function validateSurveyAnswers(
  survey: Survey,
  answers: SurveyAnswers
): { ok: true } | { ok: false; reason: string } {
  for (const q of flattenSurveyQuestions(survey.sections)) {
    const value = answers[q.id];
    if (q.required && (value === undefined || value === null || value === '')) {
      return { ok: false, reason: '請完成所有必填題目' };
    }
    if (value !== undefined && value !== null && value !== '' && !isValidAnswerForQuestion(q, value)) {
      return { ok: false, reason: '部分題目作答格式不正確' };
    }
  }
  return { ok: true };
}

class SurveyResponseService {
  private serialize(docId: string, data: FirebaseFirestore.DocumentData): SurveyResponse {
    return {
      id: docId,
      surveyId: String(data.surveyId ?? ''),
      teacherId: String(data.teacherId ?? ''),
      studentId: String(data.studentId ?? ''),
      studentName: String(data.studentName ?? ''),
      responseMode: data.responseMode === 'anonymous' ? 'anonymous' : 'named',
      answers: (data.answers && typeof data.answers === 'object' ? data.answers : {}) as SurveyAnswers,
      attemptIndex: typeof data.attemptIndex === 'number' ? data.attemptIndex : 1,
      submittedAt: data.submittedAt?.toDate?.()?.toISOString?.() ?? data.submittedAt ?? '',
    };
  }

  private async collectionForSurvey(surveyId: string) {
    const location = await resolveSurveyResponseLocation(surveyId);
    return surveyResponsesCollection(location);
  }

  private async loadResponseDocs(
    surveyId: string,
    extra?: (col: FirebaseFirestore.CollectionReference) => FirebaseFirestore.Query
  ): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
    const run = async (location: 'quiz' | 'core') => {
      const col = surveyResponsesCollection(location);
      const base = col.where('surveyId', '==', surveyId);
      const snap = await (extra ? extra(col) : base).get();
      return snap.docs;
    };

    // Prefer querying the resolved location; also merge core if separated (legacy)
    const location = await resolveSurveyResponseLocation(surveyId);
    const primary = await run(location);
    if (!isSurveyDbSeparated() || location === 'core') return primary;

    const coreDocs = await run('core');
    if (coreDocs.length === 0) return primary;
    return mergeSurveyDocsById(primary, coreDocs);
  }

  /** 教師端顯示用：不記名時隱藏真實身分 */
  toTeacherView(response: SurveyResponse, index: number): SurveyResponse {
    if (response.responseMode === 'anonymous') {
      return {
        ...response,
        studentId: '',
        studentName: `匿名回應 #${index}`,
      };
    }
    return response;
  }

  async countByStudentAndSurvey(surveyId: string, studentId: string): Promise<number> {
    const docs = await this.loadResponseDocs(surveyId, (col) =>
      col.where('surveyId', '==', surveyId).where('studentId', '==', studentId)
    );
    return docs.length;
  }

  async listByStudentAndSurvey(surveyId: string, studentId: string): Promise<SurveyResponse[]> {
    const docs = await this.loadResponseDocs(surveyId, (col) =>
      col.where('surveyId', '==', surveyId).where('studentId', '==', studentId)
    );
    return docs
      .map((d) => this.serialize(d.id, d.data()))
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

  async listBySurvey(surveyId: string): Promise<SurveyResponse[]> {
    const docs = await this.loadResponseDocs(surveyId);
    return docs
      .map((d) => this.serialize(d.id, d.data()))
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

  async submit(params: {
    survey: Survey;
    studentId: string;
    studentName: string;
    answers: SurveyAnswers;
  }): Promise<SurveyResponse> {
    const { survey, studentId, answers } = params;
    const validation = validateSurveyAnswers(survey, answers);
    if (validation.ok === false) {
      throw new Error(validation.reason);
    }

    const existingCount = await this.countByStudentAndSurvey(survey.id, studentId);
    const maxAttempts = Math.max(1, survey.attemptLimit ?? 1);
    if (existingCount >= maxAttempts) {
      throw new Error('ATTEMPT_LIMIT_REACHED');
    }

    const anonymous = isSurveyAnonymous(survey);
    const payload = {
      surveyId: survey.id,
      teacherId: survey.teacherId,
      studentId,
      studentName: anonymous ? '' : params.studentName,
      responseMode: anonymous ? 'anonymous' : 'named',
      answers,
      attemptIndex: existingCount + 1,
      submittedAt: FieldValue.serverTimestamp(),
    };

    const collection = await this.collectionForSurvey(survey.id);
    const docRef = await collection.add(payload);
    return {
      id: docRef.id,
      surveyId: survey.id,
      teacherId: survey.teacherId,
      studentId,
      studentName: anonymous ? '' : params.studentName,
      responseMode: anonymous ? 'anonymous' : 'named',
      answers,
      attemptIndex: existingCount + 1,
      submittedAt: new Date().toISOString(),
    };
  }

  async deleteBySurvey(surveyId: string): Promise<void> {
    const deleteFrom = async (location: 'quiz' | 'core') => {
      const snap = await surveyResponsesCollection(location).where('surveyId', '==', surveyId).get();
      const batchSize = 400;
      const db = location === 'quiz' ? quizDb : adminDb;
      for (let i = 0; i < snap.docs.length; i += batchSize) {
        const batch = db.batch();
        snap.docs.slice(i, i + batchSize).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    };

    await deleteFrom('quiz');
    if (isSurveyDbSeparated()) {
      await deleteFrom('core');
    }
  }

  buildAnalytics(survey: Survey, responses: SurveyResponse[]): SurveyAnalytics {
    const questions = flattenSurveyQuestions(survey.sections);
    const analyticsQuestions: SurveyQuestionAnalytics[] = questions.map((q) => {
      const values = responses
        .map((r) => r.answers[q.id])
        .filter((v) => v !== undefined && v !== null && v !== '');

      const base: SurveyQuestionAnalytics = {
        questionId: q.id,
        type: q.type,
        content: q.content,
        responseCount: values.length,
      };

      if (q.type === 'single') {
        const counts = new Map<string, number>();
        for (const v of values) {
          const key = String(v);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        base.optionStats = q.options.map((label) => ({
          label,
          count: counts.get(label) ?? 0,
        }));
        for (const [label, count] of counts) {
          if (!q.options.includes(label)) {
            base.optionStats.push({ label, count });
          }
        }
      }

      if (q.type === 'multiple') {
        const counts = new Map<string, number>();
        for (const v of values) {
          if (!Array.isArray(v)) continue;
          for (const item of v) {
            const key = String(item);
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
        }
        base.optionStats = q.options.map((label) => ({
          label,
          count: counts.get(label) ?? 0,
        }));
        if (q.allowOther) {
          let otherCount = 0;
          for (const [label, count] of counts) {
            if (label.startsWith('__other__:') || !q.options.includes(label)) {
              otherCount += count;
            }
          }
          base.optionStats.push({ label: '其他', count: otherCount });
        }
      }

      if (q.type === 'short_answer') {
        base.textAnswers = values.map((v) => String(v)).filter((t) => t.trim());
      }

      if (q.type === 'scale') {
        const scaleQ = q as SurveyScaleQuestion;
        const nums = values
          .map((v) => (typeof v === 'number' ? v : Number(v)))
          .filter((n) => Number.isFinite(n));
        const sum = nums.reduce((a, b) => a + b, 0);
        base.scaleAverage = nums.length ? Math.round((sum / nums.length) * 100) / 100 : 0;
        base.scaleDistribution = Array.from({ length: scaleQ.maxScore }, (_, i) => {
          const score = i + 1;
          return {
            label: String(score),
            count: nums.filter((n) => n === score).length,
          };
        });
      }

      if (q.type === 'matrix') {
        const matrixQ = q as SurveyMatrixQuestion;
        base.matrixRows = matrixQ.rows
          .filter((row) => row.label.trim())
          .map((row) => {
            const nums: number[] = [];
            for (const v of values) {
              if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
              const n = (v as Record<string, number>)[row.id];
              if (typeof n === 'number' && Number.isFinite(n)) nums.push(n);
            }
            const sum = nums.reduce((a, b) => a + b, 0);
            return {
              rowId: row.id,
              label: row.label,
              average: nums.length ? Math.round((sum / nums.length) * 100) / 100 : 0,
              distribution: Array.from({ length: matrixQ.maxScore }, (_, i) => {
                const score = i + 1;
                return {
                  label: String(score),
                  count: nums.filter((n) => n === score).length,
                };
              }),
            };
          });
      }

      return base;
    });

    return {
      totalResponses: responses.length,
      responseMode: survey.responseMode,
      questions: analyticsQuestions,
    };
  }
}

export const surveyResponseService = new SurveyResponseService();

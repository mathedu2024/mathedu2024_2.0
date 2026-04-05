/**
 * Firestore `courses/{id}/grades/data` may use teacher UI fields (columnDetails, settings)
 * or student/dashboard fields (columns, totalSetting). These helpers keep both in sync.
 */

export type GradeSettingsShape = {
  percents: { quiz: number; hw: number; att: number; periodic: number };
  calcModes: {
    小考: { mode: 'all' | 'best'; n: number };
    作業: { mode: 'all' | 'best'; n: number };
    上課態度: { mode: 'all' | 'best'; n: number };
  };
  periodicEnabled: Record<string, boolean>;
};

/** 權重預設為 0；未設定欄位不應被誤替換成 40/20 等非零預設 */
export const defaultGradeSettings: GradeSettingsShape = {
  percents: { quiz: 0, hw: 0, att: 0, periodic: 0 },
  calcModes: {
    小考: { mode: 'all', n: 3 },
    作業: { mode: 'all', n: 3 },
    上課態度: { mode: 'all', n: 3 },
  },
  periodicEnabled: {
    第一次定期評量: true,
    第二次定期評量: true,
    期末評量: true,
  },
};

export const DEFAULT_PERIODIC_ITEM_KEYS = [
  '第一次定期評量',
  '第二次定期評量',
  '期末評量',
] as const;

export type PeriodicColumnMeta = { name: string; date: string; type: string };

function numOrZero(v: unknown): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function defaultPeriodicColumnDetails(): Record<string, PeriodicColumnMeta> {
  const o: Record<string, PeriodicColumnMeta> = {};
  for (const k of DEFAULT_PERIODIC_ITEM_KEYS) {
    o[k] = { name: k, date: '', type: '定期評量' };
  }
  return o;
}

/** 將 Firestore 內各種格式的定期分數對應到固定三鍵；支援字串數字、鍵名空白差異、依序 0/1/2 */
export function normalizePeriodicScores(raw: unknown): Record<string, number | undefined> {
  const out: Record<string, number | undefined> = {};
  const coerce = (v: unknown): number | undefined => {
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = parseInt(v, 10);
      if (!Number.isNaN(n)) return n;
    }
    return undefined;
  };

  if (raw == null) {
    for (const k of DEFAULT_PERIODIC_ITEM_KEYS) out[k] = undefined;
    return out;
  }

  if (Array.isArray(raw)) {
    DEFAULT_PERIODIC_ITEM_KEYS.forEach((k, i) => {
      out[k] = coerce(raw[i]);
    });
    return out;
  }

  if (typeof raw !== 'object') {
    for (const k of DEFAULT_PERIODIC_ITEM_KEYS) out[k] = undefined;
    return out;
  }

  const o = raw as Record<string, unknown>;
  const trimmed = new Map<string, number>();
  for (const [k, v] of Object.entries(o)) {
    const n = coerce(v);
    if (n === undefined) continue;
    trimmed.set(k, n);
    trimmed.set(k.trim(), n);
  }

  for (const canon of DEFAULT_PERIODIC_ITEM_KEYS) {
    if (trimmed.has(canon)) {
      out[canon] = trimmed.get(canon);
      continue;
    }
    const found = Object.entries(o).find(([k]) => k.trim() === canon);
    if (found) {
      out[canon] = coerce(found[1]);
      continue;
    }
    out[canon] = undefined;
  }

  const usedCanon = new Set(DEFAULT_PERIODIC_ITEM_KEYS);
  const hasAnyCanon = DEFAULT_PERIODIC_ITEM_KEYS.some((k) => out[k] !== undefined);
  if (!hasAnyCanon) {
    DEFAULT_PERIODIC_ITEM_KEYS.forEach((k, i) => {
      const n = coerce(o[String(i)] ?? o[i]);
      if (n !== undefined) out[k] = n;
    });
  }

  for (const [k, v] of Object.entries(o)) {
    if (usedCanon.has(k as (typeof DEFAULT_PERIODIC_ITEM_KEYS)[number])) continue;
    const n = coerce(v);
    if (n !== undefined) out[k] = n;
  }

  return out;
}

export function mergePeriodicColumnDetails(raw: unknown): Record<string, PeriodicColumnMeta> {
  const base = defaultPeriodicColumnDetails();
  if (!raw || typeof raw !== 'object') return base;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v && typeof v === 'object') {
      const o = v as { name?: string; date?: string; type?: string };
      base[k] = {
        name: String(o.name ?? k),
        date: String(o.date ?? ''),
        type: String(o.type ?? '定期評量'),
      };
    }
  }
  return base;
}

export function inferRegularColumns(
  columnDetails: Record<string, unknown>,
  stored: number | undefined
): number {
  if (typeof stored === 'number' && stored > 0) return stored;
  const nums = Object.keys(columnDetails)
    .map((k) => Number(k))
    .filter((n) => !Number.isNaN(n) && n >= 0);
  if (nums.length === 0) return 0;
  return Math.max(...nums) + 1;
}

export function totalSettingToSettings(
  ts: Record<string, unknown> | undefined | null
): GradeSettingsShape | null {
  if (!ts || typeof ts !== 'object') return null;
  const regularDetail = (ts as { regularDetail?: Record<string, { calcMethod?: string; n?: number; percent?: number }> })
    .regularDetail || {};
  const pe = (ts as { periodicEnabled?: Record<string, boolean> }).periodicEnabled;
  const periodicPercent = (ts as { periodicPercent?: number }).periodicPercent;

  const pct = (t: '小考' | '作業' | '上課態度') => numOrZero(regularDetail[t]?.percent);

  return {
    percents: {
      quiz: pct('小考'),
      hw: pct('作業'),
      att: pct('上課態度'),
      periodic: periodicPercent === undefined || periodicPercent === null ? 0 : numOrZero(periodicPercent),
    },
    calcModes: {
      小考: {
        mode: regularDetail['小考']?.calcMethod === 'best' ? 'best' : 'all',
        n: regularDetail['小考']?.n ?? 3,
      },
      作業: {
        mode: regularDetail['作業']?.calcMethod === 'best' ? 'best' : 'all',
        n: regularDetail['作業']?.n ?? 3,
      },
      上課態度: {
        mode: regularDetail['上課態度']?.calcMethod === 'best' ? 'best' : 'all',
        n: regularDetail['上課態度']?.n ?? 3,
      },
    },
    periodicEnabled: { ...defaultGradeSettings.periodicEnabled, ...pe },
  };
}

/** 合併 Firestore 的 settings 與 totalSetting；已儲存的 0 不會被蓋掉 */
export function mergeLoadedSettings(
  fromSettings: Record<string, unknown> | GradeSettingsShape | null | undefined,
  fromTotalSetting: Record<string, unknown> | null | undefined
): GradeSettingsShape {
  const fromTS = totalSettingToSettings(fromTotalSetting);
  const raw =
    fromSettings && typeof fromSettings === 'object' && 'percents' in fromSettings
      ? (fromSettings as GradeSettingsShape)
      : null;
  const src = raw || fromTS || defaultGradeSettings;

  return {
    percents: {
      quiz: numOrZero(src.percents?.quiz),
      hw: numOrZero(src.percents?.hw),
      att: numOrZero(src.percents?.att),
      periodic: numOrZero(src.percents?.periodic),
    },
    calcModes: {
      小考: {
        mode: src.calcModes?.小考?.mode === 'best' ? 'best' : 'all',
        n: src.calcModes?.小考?.n ?? 3,
      },
      作業: {
        mode: src.calcModes?.作業?.mode === 'best' ? 'best' : 'all',
        n: src.calcModes?.作業?.n ?? 3,
      },
      上課態度: {
        mode: src.calcModes?.上課態度?.mode === 'best' ? 'best' : 'all',
        n: src.calcModes?.上課態度?.n ?? 3,
      },
    },
    periodicEnabled: { ...defaultGradeSettings.periodicEnabled, ...src.periodicEnabled },
  };
}

export function settingsToTotalSetting(settings: GradeSettingsShape) {
  const { percents, calcModes, periodicEnabled } = settings;
  const mk = (t: '小考' | '作業' | '上課態度') => ({
    calcMethod: calcModes[t]?.mode === 'best' ? 'best' : 'all',
    n: calcModes[t]?.n,
    percent: t === '小考' ? percents.quiz : t === '作業' ? percents.hw : percents.att,
  });
  return {
    regularDetail: {
      小考: mk('小考'),
      作業: mk('作業'),
      上課態度: mk('上課態度'),
    },
    periodicEnabled,
    periodicPercent: percents.periodic,
  };
}

export function normalizeGradeDocStudents(
  data: Record<string, unknown>
): Record<string, unknown>[] {
  let list: unknown[] = Array.isArray(data.students) ? data.students : [];
  if (list.length === 0 && data.grades && typeof data.grades === 'object') {
    list = Object.values(data.grades as Record<string, unknown>);
  }
  return list.map((s, i) => {
    const row = s as Record<string, unknown>;
    const sid = row.studentId ?? row.id;
    return {
      ...row,
      id: String(row.id ?? sid ?? `row-${i}`),
      studentId: String(sid ?? ''),
      name: String(row.name ?? ''),
      grade: String(row.grade ?? ''),
      regularScores:
        row.regularScores && typeof row.regularScores === 'object'
          ? (row.regularScores as Record<string, number>)
          : {},
      periodicScores: normalizePeriodicScores(
        row.periodicScores ?? row.periodic ?? row.periodicScoresMap
      ),
      manualAdjust: typeof row.manualAdjust === 'number' ? row.manualAdjust : undefined,
    };
  });
}

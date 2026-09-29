export type ConnectionState = 'connected' | 'degraded' | 'offline';
export type SegmentState = 'pending' | 'confirmed' | 'duplicate' | 'stale' | 'ignored';
export type SegmentSource = 'live' | 'offline' | 'manual';

export interface TermApplication {
  ruleId: string;
  ruleVersion: number;
  source: string;
  replacement: string;
  kind: 'auto' | 'shortcut';
  at: number;
}

export interface CaptionAmendment {
  id: string;
  ordinal: number;
  ruleId: string;
  reason: string;
  supersedesAmendmentId?: string;
  supersedesLabel: string;
  previousText: string;
  correctedText: string;
  oldReplacement: string;
  newReplacement: string;
  atMerge: boolean;
  createdAt: number;
}

export interface CaptionSegment {
  id: string;
  sequence: number;
  startTime: number;
  receivedAt: number;
  confirmedAt?: number;
  speaker: string;
  original: string;
  corrected: string;
  numberHints: string;
  source: SegmentSource;
  state: SegmentState;
  duplicateOf?: string;
  staleReason?: string;
  revision: number;
  tags: string[];
  ruleApplications: TermApplication[];
  amendments: CaptionAmendment[];
  manualOverride: boolean;
}

export interface TermRule {
  id: string;
  source: string;
  replacement: string;
  speaker: string;
  enabled: boolean;
  caseSensitive: boolean;
  usageCount: number;
  version: number;
  createdAt: number;
}

export interface DeskModel {
  eventName: string;
  eventDate: string;
  segments: CaptionSegment[];
  rules: TermRule[];
  selectedId: string;
  connection: ConnectionState;
  simulatedDelay: number;
  fontSize: number;
  nextSequence: number;
  autoStream: boolean;
  lastMergedAt?: number;
  updatedAt: number;
}

export interface ToastMessage {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  title: string;
  subtitle: string;
}

const now = Date.now();
export const STORAGE_KEY = 'sologsb-1011-live-caption-desk-v1';

function segment(
  id: string,
  sequence: number,
  startTime: number,
  speaker: string,
  original: string,
  corrected = original,
  state: SegmentState = 'pending',
): CaptionSegment {
  return {
    id,
    sequence,
    startTime,
    receivedAt: now - (100 - sequence) * 8_000,
    confirmedAt: state === 'confirmed' ? now - (100 - sequence) * 7_000 : undefined,
    speaker,
    original,
    corrected,
    numberHints: '',
    source: 'live',
    state,
    revision: 0,
    tags: [],
    ruleApplications: [],
    amendments: [],
    manualOverride: false,
  };
}

function applied(ruleId: 'term-1' | 'term-2' | 'term-3', kind: TermApplication['kind'] = 'auto'): TermApplication[] {
  const rule: Record<string, { source: string; replacement: string }> = {
    'term-1': { source: 'co pilot', replacement: 'Co-Pilot' },
    'term-2': { source: 'studio cloud', replacement: 'Studio Cloud' },
    'term-3': { source: '五G', replacement: '5G' },
  };
  return [{ ruleId, ruleVersion: 1, ...rule[ruleId], kind, at: now - 60_000 }];
}

const seededSegments: CaptionSegment[] = [
  {
    ...segment('seg-1', 1, 0, '主持人', '欢迎大家来到二零二六年产品发布会。', '欢迎大家来到2026年产品发布会。', 'confirmed'),
    manualOverride: true,
  },
  segment('seg-2', 2, 7, '主讲人', '今天我们会介绍三个模块,首先是实时协作。', '今天我们会介绍三个模块，首先是实时协作。', 'confirmed'),
  segment('seg-3', 3, 15, '主讲人', '延迟和质量监测会帮助我们保持字幕稳定。', '延迟和质量监测会帮助我们保持字幕稳定。', 'confirmed'),
  {
    ...segment('seg-4', 4, 24, '嘉宾 / 周然', '我们使用 studio cloud 作为演示环境。', '我们使用 Studio Cloud 作为演示环境。', 'pending'),
    ruleApplications: applied('term-2', 'shortcut'),
    tags: ['术语已应用'],
  },
  {
    ...segment('seg-5', 5, 34, '嘉宾 / 周然', '每分钟大约会收到一百二十个片段。', '每分钟大约会收到120个片段。', 'pending'),
    manualOverride: true,
  },
  {
    // 直播区里被错误译法规则自动替换、且没有再被人工改动过的片段：修订时从原始字幕整体重放。
    ...segment('seg-6', 6, 43, '主持人', '如果主持人提到 co pilot,需要统一大小写。', '如果主持人提到 Co-Pilot，需要统一大小写。', 'confirmed'),
    ruleApplications: applied('term-1'),
    tags: ['术语已应用'],
  },
  {
    // 规则替换后校对员又手动改过：修订时保留人工修改，只定点替换错误译法。
    ...segment('seg-7', 7, 52, '主持人', '这个例子会演示 co pilot 在五G网络下的字幕恢复。', '本例演示 Co-Pilot 在5G网络下的字幕恢复流程。', 'confirmed'),
    ruleApplications: [...applied('term-1'), ...applied('term-3', 'shortcut')],
    manualOverride: true,
    tags: ['术语已应用'],
  },
];

const duplicate: CaptionSegment = {
  ...segment('seg-8', 8, 61, '主讲人', '今天我们重点讨论字幕队列。', '今天我们重点讨论字幕队列。', 'duplicate'),
  source: 'live',
  duplicateOf: 'seg-2',
  staleReason: '与第 2 段高度相似',
};

export function createInitialModel(): DeskModel {
  return {
    eventName: '新品发布会现场字幕',
    eventDate: new Date(now).toISOString().slice(0, 10),
    segments: [...seededSegments, duplicate],
    rules: [
      { id: 'term-1', source: 'co pilot', replacement: 'Co-Pilot', speaker: '', enabled: true, caseSensitive: false, usageCount: 4, version: 1, createdAt: now - 86_400_000 },
      { id: 'term-2', source: 'studio cloud', replacement: 'Studio Cloud', speaker: '', enabled: true, caseSensitive: false, usageCount: 7, version: 1, createdAt: now - 43_200_000 },
      { id: 'term-3', source: '五G', replacement: '5G', speaker: '', enabled: true, caseSensitive: true, usageCount: 2, version: 1, createdAt: now - 3_600_000 },
    ],
    selectedId: 'seg-4',
    connection: 'connected',
    simulatedDelay: 1.8,
    fontSize: 18,
    nextSequence: 9,
    autoStream: true,
    updatedAt: now,
  };
}

export function cloneModel(model: DeskModel): DeskModel {
  return structuredClone(model);
}

export function normalizeNumbers(text: string): string {
  const digitMap: Record<string, string> = { '０': '0', '１': '1', '２': '2', '３': '3', '４': '4', '５': '5', '６': '6', '７': '7', '８': '8', '９': '9' };
  const chineseNumber = (raw: string): number => {
    const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    if (!/[十百千万]/u.test(raw)) return Number([...raw].map((char) => digits[char] ?? 0).join(''));
    let total = 0;
    let section = 0;
    let number = 0;
    for (const char of raw) {
      if (digits[char] !== undefined) {
        number = digits[char];
      } else if (char === '十') {
        section += (number || 1) * 10;
        number = 0;
      } else if (char === '百') {
        section += (number || 1) * 100;
        number = 0;
      } else if (char === '千') {
        section += (number || 1) * 1000;
        number = 0;
      } else if (char === '万') {
        total += (section + number) * 10_000;
        section = 0;
        number = 0;
      }
    }
    return total + section + number;
  };

  return text
    .replace(/[０-９]/g, (char) => digitMap[char] ?? char)
    .replace(/([零〇一二两三四五六七八九十百千万]+)/gu, (match) => String(chineseNumber(match)))
    .replace(/(?<=\d)[，,](?=\d{3}\b)/g, ',');
}

export function normalizePunctuation(text: string): string {
  return text
    .replace(/([，。！？；：])(?=[^\s，。！？；：])/gu, '$1')
    .replace(/\s+([，。！？；：])/gu, '$1')
    .replace(/([,;:!?])(?=[^\s,;:!?])/g, (match) => ({ ',': '，', ';': '；', ':': '：', '!': '！', '?': '？' }[match] ?? match));
}

export function applyRules(text: string, model: DeskModel): { text: string; used: string[] } {
  let next = text;
  const used: string[] = [];
  for (const rule of model.rules.filter((item) => item.enabled)) {
    if (!rule.source || !next) continue;
    const flags = rule.caseSensitive ? 'g' : 'gi';
    const expression = new RegExp(rule.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    if (expression.test(next)) {
      next = next.replace(expression, rule.replacement);
      used.push(rule.id);
    }
  }
  return { text: normalizePunctuation(next), used };
}

/** 直播区当前生效文本：直播原版叠加修订链，最后一条修订的结果为准。 */
export function liveText(segment: CaptionSegment): string {
  return segment.amendments.length ? segment.amendments[segment.amendments.length - 1].correctedText : segment.corrected;
}

export function latestAmendment(segment: CaptionSegment): CaptionAmendment | undefined {
  return segment.amendments[segment.amendments.length - 1];
}

/** 旧版本草稿补字段，避免历史 localStorage 数据缺字段。 */
export function migrateModel(model: DeskModel): DeskModel {
  return {
    ...model,
    rules: model.rules.map((rule) => ({ ...rule, version: rule.version ?? 1 })),
    segments: model.segments.map((segment) => ({
      ...segment,
      tags: segment.tags ?? [],
      ruleApplications: segment.ruleApplications ?? [],
      amendments: segment.amendments ?? [],
      manualOverride: segment.manualOverride ?? false,
    })),
  };
}

function literalReplaceAll(text: string, oldValue: string, newValue: string): string {
  if (!oldValue) return text;
  return text.split(oldValue).join(newValue);
}

/** 从原始字幕出发整体重放当前术语规则（用于没有人工改动的纯规则片段）。 */
function replayFromOriginal(segment: CaptionSegment, rules: TermRule[]): string {
  let next = segment.original;
  for (const rule of rules.filter((item) => item.enabled && (!item.speaker || item.speaker === segment.speaker))) {
    if (!rule.source || !next) continue;
    const flags = rule.caseSensitive ? 'g' : 'gi';
    const expression = new RegExp(rule.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    next = next.replace(expression, rule.replacement);
  }
  return normalizePunctuation(next);
}

interface PushAmendmentOptions {
  reason: string;
  atMerge?: boolean;
  createdAt: number;
}

/**
 * 为单个片段追加一条术语修订。
 * 人工改过的片段：保留人工修改，只把旧译法定点替换为新译法；
 * 纯规则片段：从原始字幕按当前规则整体重算。
 * 无实际变化时不产生修订。
 */
function pushRuleAmendment(
  segment: CaptionSegment,
  rule: TermRule,
  oldReplacement: string,
  currentRules: TermRule[],
  options: PushAmendmentOptions,
): CaptionAmendment | undefined {
  const previousText = liveText(segment);
  const candidate = segment.manualOverride
    ? literalReplaceAll(previousText, oldReplacement, rule.replacement)
    : replayFromOriginal(segment, currentRules);
  if (candidate === previousText) return undefined;

  const supersedes = latestAmendment(segment);
  const amendment: CaptionAmendment = {
    id: `amd-${segment.id}-${rule.id}-${options.createdAt.toString(36)}-${segment.amendments.length + 1}`,
    ordinal: segment.amendments.length + 1,
    ruleId: rule.id,
    reason: options.reason,
    supersedesAmendmentId: supersedes?.id,
    supersedesLabel: supersedes ? `第 ${supersedes.ordinal} 版修订` : '直播原版',
    previousText,
    correctedText: candidate,
    oldReplacement,
    newReplacement: rule.replacement,
    atMerge: options.atMerge ?? false,
    createdAt: options.createdAt,
  };
  segment.amendments.push(amendment);
  segment.ruleApplications = segment.ruleApplications.map((item) => (
    item.ruleId === rule.id ? { ...item, replacement: rule.replacement, ruleVersion: rule.version } : item
  ));
  segment.tags = [...new Set([...segment.tags, '术语已修订'])];
  return amendment;
}

export interface RuleRevisionResult {
  model: DeskModel;
  amendedIds: string[];
  refreshedPendingIds: string[];
}

/**
 * 修订一条术语规则的译法：
 * - 规则版本号 +1；
 * - 已确认（含离线发件箱）片段追加修订版，保留人工修改，不直接覆盖直播原版；
 * - 待确认片段直接刷新为新译法（尚未进入直播历史，无需留修订版）。
 */
export function reviseRuleReplacement(model: DeskModel, ruleId: string, newReplacement: string, createdAt = Date.now()): RuleRevisionResult | undefined {
  const rule = model.rules.find((item) => item.id === ruleId);
  if (!rule) return undefined;
  const trimmed = newReplacement.trim();
  if (!trimmed || trimmed === rule.replacement) return undefined;
  const oldReplacement = rule.replacement;

  const updatedRule: TermRule = { ...rule, replacement: trimmed, version: rule.version + 1 };
  const updatedRules = model.rules.map((item) => (item.id === ruleId ? updatedRule : item));

  const amendedIds: string[] = [];
  const refreshedPendingIds: string[] = [];
  const segments = model.segments.map((item) => {
    if (!item.ruleApplications.some((application) => application.ruleId === ruleId)) return item;
    const clone = { ...item, ruleApplications: [...item.ruleApplications], amendments: [...item.amendments], tags: [...item.tags] };
    if (item.state === 'confirmed') {
      const amendment = pushRuleAmendment(clone, updatedRule, oldReplacement, updatedRules, {
        reason: `规则「${rule.source}」译法修订`,
        createdAt,
      });
      if (amendment) amendedIds.push(item.id);
    } else {
      const refreshed = literalReplaceAll(clone.corrected, oldReplacement, trimmed);
      if (refreshed !== clone.corrected) {
        clone.corrected = refreshed;
        clone.ruleApplications = clone.ruleApplications.map((application) => (
          application.ruleId === ruleId ? { ...application, replacement: trimmed, ruleVersion: updatedRule.version } : application
        ));
        clone.tags = [...new Set([...clone.tags, '术语已修订'])];
        refreshedPendingIds.push(item.id);
      }
    }
    return clone;
  });

  return {
    model: { ...model, rules: updatedRules, segments },
    amendedIds,
    refreshedPendingIds,
  };
}

/** 找出已确认片段中规则应用版本落后于当前规则版本的记录（离线期间改了规则时使用）。 */
export function staleRuleApplications(segment: CaptionSegment, rules: TermRule[]): TermApplication[] {
  return segment.ruleApplications.filter((application) => {
    const rule = rules.find((item) => item.id === application.ruleId);
    return !!rule && rule.enabled && rule.version > application.ruleVersion && rule.replacement !== application.replacement;
  });
}

export interface MergeRecomputeResult {
  model: DeskModel;
  amendedIds: string[];
}

/** 恢复连接合并时，对离线确认的片段一并重算过期的术语规则应用。 */
export function recomputeAtMerge(model: DeskModel, createdAt = Date.now()): MergeRecomputeResult {
  const amendedIds: string[] = [];
  const segments = model.segments.map((item) => {
    if (item.source !== 'offline' || item.state !== 'confirmed') return item;
    const stale = staleRuleApplications(item, model.rules);
    if (!stale.length) return item;
    const clone = { ...item, ruleApplications: [...item.ruleApplications], amendments: [...item.amendments], tags: [...item.tags] };
    for (const application of stale) {
      const rule = model.rules.find((candidate) => candidate.id === application.ruleId);
      if (!rule) continue;
      const amendment = pushRuleAmendment(clone, rule, application.replacement, model.rules, {
        reason: `离线确认片段恢复连接，按规则 v${rule.version} 重算`,
        atMerge: true,
        createdAt,
      });
      if (amendment) amendedIds.push(item.id);
    }
    return clone;
  });
  return { model: { ...model, segments }, amendedIds };
}

export function isDuplicate(candidate: CaptionSegment, existing: CaptionSegment[]): CaptionSegment | undefined {
  const normalize = (value: string) => value.replace(/[\s，。！？；：,.;:!?]/g, '').toLocaleLowerCase();
  const candidateText = normalize(candidate.corrected || candidate.original);
  return existing.find((segmentItem) => {
    if (segmentItem.id === candidate.id || segmentItem.state === 'ignored') return false;
    const text = normalize(segmentItem.corrected || segmentItem.original);
    if (!candidateText || !text) return false;
    return text === candidateText || (Math.abs(segmentItem.startTime - candidate.startTime) < 12 && (text.includes(candidateText) || candidateText.includes(text)));
  });
}

export function mergeConfirmedSegments(model: DeskModel): DeskModel {
  // 恢复连接先重算离线确认片段上过期的术语规则应用，再做排序、重复与过期检查。
  const recomputed = recomputeAtMerge(model).model;
  const seen: string[] = [];
  const segments = recomputed.segments
    .map((item) => ({ ...item, amendments: [...item.amendments], ruleApplications: [...item.ruleApplications], tags: [...item.tags] }))
    .sort((a, b) => a.sequence - b.sequence || a.startTime - b.startTime)
    .map((item): CaptionSegment => {
      if (item.source === 'offline' && item.state === 'confirmed') {
        item.source = item.confirmedAt && Date.now() - item.confirmedAt > 90_000 ? 'offline' : 'live';
        item.staleReason = Date.now() - item.receivedAt > 90_000 ? `离线恢复后合并，原始片段已延迟 ${Math.round((Date.now() - item.receivedAt) / 1000)} 秒` : undefined;
        if (item.staleReason) item.state = 'stale';
      }
      const duplicate = isDuplicate(item, seen.map((id) => model.segments.find((segmentItem) => segmentItem.id === id)).filter(Boolean) as CaptionSegment[]);
      if (duplicate && item.state !== 'confirmed') {
        item.state = 'duplicate';
        item.duplicateOf = duplicate.id;
      }
      if (item.state !== 'ignored') seen.push(item.id);
      return item;
    });

  return {
    ...model,
    segments,
    connection: 'connected',
    simulatedDelay: Math.max(0.8, model.simulatedDelay - 0.7),
    lastMergedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function queueStats(model: DeskModel) {
  const pending = model.segments.filter((item) => item.state === 'pending');
  const stale = model.segments.filter((item) => item.state === 'stale');
  const duplicate = model.segments.filter((item) => item.state === 'duplicate');
  const offline = model.segments.filter((item) => item.source === 'offline' && item.state === 'confirmed');
  return {
    pending: pending.length,
    stale: stale.length,
    duplicate: duplicate.length,
    offline: offline.length,
    backlog: pending.length + stale.length + duplicate.length + offline.length,
    oldestWaitSeconds: pending.length ? Math.max(...pending.map((item) => Math.round((Date.now() - item.receivedAt) / 1000))) : 0,
  };
}

export function createLiveSegment(sequence: number): CaptionSegment {
  const speakers = ['主持人', '主讲人', '嘉宾 / 周然', '现场提问'];
  const samples = [
    '接下来请产品团队介绍新的工作流。',
    '请注意屏幕右侧的实时队列状态。',
    '在弱网环境下我们会保留未确认片段。',
    '如果网络恢复,系统会按照时间顺序自动合并。',
    '这段字幕包含二零二五年的项目数据。',
    '大家可以在会后查看完整回放和术语表。',
  ];
  const start = Math.max(0, sequence * 9 - 10);
  return {
    id: `seg-live-${sequence}-${Date.now().toString(36)}`,
    sequence,
    startTime: start,
    receivedAt: Date.now(),
    speaker: speakers[(sequence - 1) % speakers.length],
    original: samples[(sequence - 1) % samples.length],
    corrected: samples[(sequence - 1) % samples.length],
    numberHints: '',
    source: 'live',
    state: 'pending',
    revision: 0,
    tags: [],
    ruleApplications: [],
    amendments: [],
    manualOverride: false,
  };
}

export function simulateLatency(model: DeskModel): DeskModel {
  if (model.connection === 'offline') return model;
  const step = model.connection === 'degraded' ? 0.7 : model.simulatedDelay > 2.8 ? -0.3 : 0.15;
  const delay = Math.max(0.7, Math.min(8.9, Number((model.simulatedDelay + step).toFixed(1))));
  const applyStream = model.autoStream && Math.random() > 0.68;
  let nextSequence = model.nextSequence;
  let segments = model.segments;
  if (applyStream) {
    const candidate = createLiveSegment(model.nextSequence);
    const duplicate = isDuplicate(candidate, segments);
    segments = [...segments, duplicate ? { ...candidate, state: 'duplicate', duplicateOf: duplicate.id, staleReason: `与第 ${duplicate.sequence} 段重复` } : candidate];
    nextSequence += 1;
  }
  const pendingCutoff = Date.now() - 90_000;
  segments = segments.map((item) => item.state === 'pending' && item.receivedAt < pendingCutoff
    ? { ...item, state: 'stale', staleReason: `片段已等待 ${Math.round((Date.now() - item.receivedAt) / 1000)} 秒` }
    : item);
  return {
    ...model,
    segments,
    nextSequence,
    simulatedDelay: delay,
    connection: delay > 4.2 ? 'degraded' : model.connection,
    updatedAt: Date.now(),
  };
}

export function toSrt(model: DeskModel): string {
  const stamp = (seconds: number, separator = ',') => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.round((seconds - Math.floor(seconds)) * 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}${separator}${String(millis).padStart(3, '0')}`;
  };
  return model.segments
    .filter((item) => item.state === 'confirmed')
    .sort((a, b) => a.startTime - b.startTime)
    .map((item, index) => `${index + 1}\n${stamp(item.startTime)} --> ${stamp(item.startTime + 7)}\n[${item.speaker}] ${liveText(item)}\n`)
    .join('\n');
}

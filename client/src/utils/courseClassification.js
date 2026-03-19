const CORE = new Set([
  'CSE110', 'CSE111', 'CSE220', 'CSE221', 'CSE230', 'CSE250', 'CSE251', 'CSE260',
  'CSE320', 'CSE321', 'CSE330', 'CSE331', 'CSE340', 'CSE341', 'CSE350', 'CSE360',
  'CSE370', 'CSE420', 'CSE421', 'CSE422', 'CSE423', 'CSE460', 'CSE461', 'CSE470', 'CSE471',
]);

const CS_ELECTIVE = new Set([
  'CSE250', 'CSE251', 'CSE310', 'CSE320', 'CSE341', 'CSE342', 'CSE350', 'CSE360',
  'CSE390', 'CSE391', 'CSE392', 'CSE410', 'CSE419', 'CSE424', 'CSE425', 'CSE426',
  'CSE427', 'CSE428', 'CSE429', 'CSE430', 'CSE431', 'CSE432', 'CSE460', 'CSE461',
  'CSE462', 'CSE471', 'CSE472', 'CSE473', 'CSE474', 'CSE490', 'CSE491',
]);

const COMP_COD = new Set([
  'PHY111', 'PHY112', 'ENG101', 'ENG102', 'MAT110', 'MAT120', 'MAT215', 'MAT216',
  'STA201', 'HUM103', 'BNG103', 'EMB101',
]);

const ARTS_STREAM = new Set([
  'HUM101', 'HUM102', 'HST102', 'HST104', 'HUM207', 'ENG113', 'ENG114', 'ENG115', 'ENG333', 'ENG103',
]);

const CST_STREAM = new Set([
  'CST301', 'CST302', 'CST303', 'CST304', 'CST305',
  'CST306', 'CST307', 'CST308', 'CST309', 'CST310',
]);

const SS_STREAM = new Set([
  'PSY101', 'SOC101', 'ANT101', 'POL101', 'BUS201',
  'ECO101', 'ECO102', 'ECO105', 'BUS102', 'POL102',
  'DEV104', 'POL201', 'SOC201', 'ANT342', 'ANT351', 'BUS333',
]);

const SCIENCE_STREAM = new Set(['CHE101', 'BIO101', 'ENV103']);

const CODE_ALIASES = {
  'SOC201/ANT202': 'SOC201',
  'SOC201_ANT202': 'SOC201',
  'SOC201-ANT202': 'SOC201',
};

export function normalizeCourseCode(code) {
  const up = String(code || '').trim().toUpperCase();
  return CODE_ALIASES[up] || up;
}

export function normalizeCourseCodes(codes = []) {
  return Array.from(new Set((codes || []).map(normalizeCourseCode).filter(Boolean))).sort();
}

export function getSessionCodSets(completedCodes = []) {
  const completed = new Set(normalizeCourseCodes(completedCodes));
  const compCodSession = new Set(COMP_COD);
  const artsStreamSession = new Set(ARTS_STREAM);

  if (!completed.has('ENG101') && completed.has('ENG102')) {
    compCodSession.add('ENG103');
    artsStreamSession.delete('ENG103');
  }

  return { compCodSession, artsStreamSession };
}

export function getCoreSetForMajor(major = 'CSE') {
  const up = String(major || 'CSE').toUpperCase();
  if (up === 'CS') {
    return new Set(Array.from(CORE).filter((code) => !CS_ELECTIVE.has(code)));
  }
  return new Set(CORE);
}

export function buildCodPlanner(completedCodes = []) {
  const completed = normalizeCourseCodes(completedCodes);
  const { artsStreamSession } = getSessionCodSets(completed);

  let cst = 0;
  let arts = 0;
  let ss = 0;
  let science = 0;
  const taken = new Set();

  for (const course of completed) {
    if (CST_STREAM.has(course)) {
      cst += 1;
      taken.add(course);
    } else if (artsStreamSession.has(course)) {
      arts += 1;
      taken.add(course);
    } else if (SCIENCE_STREAM.has(course)) {
      science += 1;
      taken.add(course);
    } else if (SS_STREAM.has(course)) {
      ss += 1;
      taken.add(course);
    }
  }

  const maximum = 5;
  const totalTaken = cst + arts + ss + science;
  let remaining = Math.max(maximum - totalTaken, 0);

  const result = {
    totalTaken,
    max: maximum,
    cst,
    arts,
    ss,
    science,
    plan: [],
    message: '',
  };

  if (totalTaken >= maximum) {
    result.message = 'You have already completed the maximum number of CODs allowed.';
    return result;
  }

  const plan = [];
  const pickFirst = (pool) => {
    const sorted = Array.from(pool).sort();
    for (const course of sorted) {
      if (!taken.has(course)) {
        plan.push(course);
        taken.add(course);
        remaining -= 1;
        break;
      }
    }
  };

  if (arts === 0) pickFirst(artsStreamSession);
  if (ss === 0 && remaining > 0) pickFirst(SS_STREAM);
  if (cst === 0 && remaining > 0) pickFirst(CST_STREAM);
  if (remaining > 0) pickFirst(SCIENCE_STREAM);

  const combinedPool = Array.from(new Set([
    ...Array.from(artsStreamSession),
    ...Array.from(SS_STREAM),
    ...Array.from(SCIENCE_STREAM),
  ])).sort();

  for (const course of combinedPool) {
    if (remaining === 0) break;
    if (!taken.has(course)) {
      plan.push(course);
      taken.add(course);
      remaining -= 1;
    }
  }

  result.plan = plan;
  return result;
}

export function getRemainingCodCoursesByStream(completedCodes = []) {
  const completed = new Set(normalizeCourseCodes(completedCodes));
  const { artsStreamSession } = getSessionCodSets(Array.from(completed));

  return {
    arts: Array.from(artsStreamSession).filter((code) => !completed.has(code)).sort(),
    ss: Array.from(SS_STREAM).filter((code) => !completed.has(code)).sort(),
    cst: Array.from(CST_STREAM).filter((code) => !completed.has(code)).sort(),
    science: Array.from(SCIENCE_STREAM).filter((code) => !completed.has(code)).sort(),
  };
}

export function categorizeCompletedCourses(completedCodes = [], major = 'CSE') {
  const completed = normalizeCourseCodes(completedCodes);
  const coreSet = getCoreSetForMajor(major);
  const { compCodSession, artsStreamSession } = getSessionCodSets(completed);

  const coreCourses = [];
  const compulsoryCodCourses = [];
  const codCourses = [];
  const electiveCourses = [];

  for (const code of completed) {
    if (coreSet.has(code)) {
      coreCourses.push(code);
    } else if (compCodSession.has(code)) {
      compulsoryCodCourses.push(code);
    } else if (code.startsWith('CSE') && !coreSet.has(code) && !compCodSession.has(code)) {
      electiveCourses.push(code);
    } else if (CST_STREAM.has(code)) {
      codCourses.push({ code, stream: 'CST' });
    } else if (artsStreamSession.has(code)) {
      codCourses.push({ code, stream: 'Arts' });
    } else if (SS_STREAM.has(code)) {
      codCourses.push({ code, stream: 'Social Sciences' });
    } else if (SCIENCE_STREAM.has(code)) {
      codCourses.push({ code, stream: 'Science' });
    }
  }

  return {
    coreCourses,
    compulsoryCodCourses,
    codCourses,
    electiveCourses,
  };
}

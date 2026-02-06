const CORE = [
  'CSE110','CSE111','CSE220','CSE221','CSE230','CSE250','CSE251','CSE260',
  'CSE320','CSE321','CSE330','CSE331','CSE340','CSE341','CSE350','CSE360',
  'CSE370','CSE400','CSE420','CSE421','CSE422','CSE423','CSE460','CSE461','CSE470','CSE471',
];


const COMP_COD = [
  'MAT110','MAT120','MAT215','MAT216','PHY111','PHY112'
];
const CS_ELECTIVE = [
  'CSE250', 'CSE251', 'CSE310', 'CSE320', 'CSE341', 'CSE342', 'CSE350', 'CSE360',
  'CSE390', 'CSE391', 'CSE392', 'CSE410', 'CSE419', 'CSE424', 'CSE425', 'CSE426',
  'CSE427', 'CSE428', 'CSE429', 'CSE430', 'CSE431', 'CSE432', 'CSE460', 'CSE461',
  'CSE462', 'CSE471', 'CSE472', 'CSE473', 'CSE474', 'CSE490', 'CSE491'
];




const PREQ_FORWARD = {
  'MAT110': ['MAT120'],
  'MAT120': ['MAT215', 'MAT216'],
  'MAT215': [],
  'MAT216': ['CSE330', 'CSE423'],
  'PHY111': ['PHY112'],
  'PHY112': [],
  'ENG101': ['ENG102'],
  'ENG102': ['ENG103'],
  'ENG103': [],

  
  'CSE110': ['CSE111'],
  'CSE111': ['CSE220'],
  'CSE220': ['CSE221'],
  'CSE221': ['CSE321', 'CSE331', 'CSE370', 'CSE422'],
  'CSE230': [],
  'CSE250': ['CSE251'],
  'CSE251': ['CSE260', 'CSE350'],
  'CSE260': ['CSE340', 'CSE341', 'CSE460', 'CSE461'],
  'CSE340': ['CSE420'],
  'CSE341': ['CSE360', 'CSE461'],
  'CSE320': [],
  'CSE350': [],
  'CSE360': ['CSE461'],
  'CSE370': ['CSE470', 'CSE471'],
  'CSE420': [],
  'CSE421': ['CSE400'],
  'CSE422': ['CSE400'],
  'CSE423': [],
  'CSE460': [],
  'CSE461': [],
  'CSE470': ['CSE400'],
  'CSE471': [],
  'CSE321': ['CSE420'],
  'CSE331': ['CSE420'],
  'CSE330': [],
  'CSE400': [],
};

const SOFT_FORWARD = {
  'CSE340': ['CSE321', 'CSE341'],
  'PHY112': ['CSE250'],
  'CSE320': ['CSE421'],
};

function computePrereqsFor(course) {
  const prereqs = new Set();
  for (const [src, outs] of Object.entries(PREQ_FORWARD)) {
    if ((outs || []).includes(course)) prereqs.add(src);
  }
  return Array.from(prereqs).sort();
}

function computeSoftPrereqsFor(course) {
  const prereqs = new Set();
  for (const [src, outs] of Object.entries(SOFT_FORWARD)) {
    if ((outs || []).includes(course)) prereqs.add(src);
  }
  return Array.from(prereqs).sort();
}

function getCseGraphData() {
  const nodeSet = new Set([...CORE, ...COMP_COD]);
  const nodes = Array.from(nodeSet).sort();

  
  const edges = [];
  for (const [src, outs] of Object.entries(PREQ_FORWARD)) {
    for (const dst of (outs || [])) {
      if (nodeSet.has(src) && nodeSet.has(dst)) {
        edges.push({ from: src, to: dst });
      }
    }
  }

  const softEdges = [];
  for (const [src, outs] of Object.entries(SOFT_FORWARD)) {
    for (const dst of (outs || [])) {
      if (nodeSet.has(src) && nodeSet.has(dst)) {
        softEdges.push({ from: src, to: dst });
      }
    }
  }

  
  const prereqs = {};
  const softPrereqs = {};
  for (const c of nodes) {
    prereqs[c] = computePrereqsFor(c);
    softPrereqs[c] = computeSoftPrereqsFor(c);
  }

  const coreCSE = Array.from(new Set(CORE)).sort();
  const coreCS = coreCSE.filter((c) => !CS_ELECTIVE.includes(c));
  const compCod = Array.from(new Set(COMP_COD)).sort();

  return { nodes, edges, softEdges, prereqs, softPrereqs, coreCSE, coreCS, compCod };
}

module.exports = { getCseGraphData };
const CORE = [
  'CSE110','CSE111','CSE220','CSE221','CSE230','CSE250','CSE251','CSE260',
  'CSE320','CSE321','CSE330','CSE331','CSE340','CSE341','CSE350','CSE360',
  'CSE370','CSE400','CSE420','CSE421','CSE422','CSE423','CSE460','CSE461','CSE470','CSE471',
];


const COMP_COD = [
  'MAT110','MAT120','MAT215','MAT216','PHY111','PHY112'
];



const PREQ_FORWARD = {
  
  'MAT110': ['MAT120'],
  'MAT120': ['MAT215', 'MAT216'],
  'MAT215': [],
  'MAT216': ['CSE330', 'CSE423'],
  'PHY111': ['PHY112'],
  'PHY112': ['CSE250'],
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
  'CSE260': ['CSE340', 'CSE460', 'CSE461'],
  'CSE340': ['CSE420'],
  'CSE341': ['CSE360', 'CSE461'],
  'CSE320': ['CSE421'],
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

function computePrereqsFor(course) {
  const prereqs = new Set();
  for (const [src, outs] of Object.entries(PREQ_FORWARD)) {
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

  
  const prereqs = {};
  for (const c of nodes) {
    prereqs[c] = computePrereqsFor(c);
  }

  return { nodes, edges, prereqs };
}

module.exports = { getCseGraphData };

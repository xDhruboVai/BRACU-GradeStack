import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import cytoscapeDagre from 'cytoscape-dagre';
import 'tippy.js/dist/tippy.css';
import tippy from 'tippy.js';
import cytoscapePopper from 'cytoscape-popper';
import { fetchCseGraph } from '../api/analyzerApi';

cytoscape.use(cytoscapeDagre);
cytoscapePopper(cytoscape);

const BLUE = '#60a5fa';
const YELLOW = '#facc15';
const GRAY = '#6b7280';

export default function UnlockedCoursesGraph({ doneCodes = [], currentCodes = [], major = 'CSE' }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [graph, setGraph] = useState({ nodes: [], edges: [], softEdges: [], prereqs: {}, softPrereqs: {}, coreCSE: [], coreCS: [], compCod: [], titles: {} });
  const [unlockPreview, setUnlockPreview] = useState({}); 
  const [includeCurrent, setIncludeCurrent] = useState(true);
  const [ignoreSoft, setIgnoreSoft] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');

  const doneSet = useMemo(() => new Set((doneCodes || []).map((c) => String(c).toUpperCase())), [doneCodes]);
  const currentSet = useMemo(() => new Set((currentCodes || []).map((c) => String(c).toUpperCase())), [currentCodes]);
  const visibleCourses = useMemo(() => {
    const base = String(major).toUpperCase() === 'CS' ? graph.coreCS : graph.coreCSE;
    return Array.from(new Set([...(base || []), ...(graph.compCod || [])].map((x) => String(x).toUpperCase()))).sort();
  }, [major, graph.coreCS, graph.coreCSE, graph.compCod]);

  const computeUnlocked = useCallback((baseSet) => {
    const acc = new Set();
    const visible = new Set([
      ...(String(major).toUpperCase() === 'CS' ? graph.coreCS : graph.coreCSE),
      ...graph.compCod,
    ].map((x) => String(x).toUpperCase()));
    for (const c of Array.from(visible)) {
      const up = String(c).toUpperCase();
      if (baseSet.has(up)) continue;
      const hard = graph.prereqs[up] || [];
      const soft = ignoreSoft ? [] : (graph.softPrereqs[up] || []);
      const reqs = [...hard, ...soft];
      let ok = true;
      for (const r of reqs) {
        if (!baseSet.has(String(r).toUpperCase())) { ok = false; break; }
      }
      if (ok) acc.add(up);
    }
    return acc;
  }, [major, graph.coreCS, graph.coreCSE, graph.compCod, graph.prereqs, graph.softPrereqs, ignoreSoft]);

  const applyStyles = useCallback((cy, baseSet, unlockedSet) => {
    cy.nodes().forEach((n) => {
      const id = String(n.id()).toUpperCase();
      n.removeClass('done unlocked locked hover dim');
      if (baseSet.has(id)) {
        n.addClass('done');
      } else if (unlockedSet.has(id)) {
        n.addClass('unlocked');
      } else {
        n.addClass('locked');
      }
    });
  }, []);

  const computeUnlockPreview = useCallback((baseSet, currentUnlocked) => {
    const curr = currentUnlocked || computeUnlocked(baseSet);
    const map = {};
    for (const u of Array.from(curr)) {
      const next = computeUnlocked(new Set([...baseSet, u]));
      const delta = Array.from(next).filter((x) => !curr.has(x));
      map[u] = delta.sort();
    }
    setUnlockPreview(map);
  }, [computeUnlocked]);

  const applySearchFocus = useCallback((cy, code) => {
    if (!cy) return;
    cy.nodes().removeClass('search-hit search-neighbor faded');
    cy.edges().removeClass('search-link faded');

    const targetCode = String(code || '').toUpperCase().trim();
    if (!targetCode) return;

    const target = cy.getElementById(targetCode);
    if (!target || target.empty()) return;

    const neighborhood = target.closedNeighborhood();
    cy.elements().addClass('faded');
    neighborhood.removeClass('faded');
    target.addClass('search-hit');
    neighborhood.nodes().not(target).addClass('search-neighbor');
    neighborhood.edges().addClass('search-link');
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchCseGraph().then((g) => {
      if (!mounted) return;
      setGraph(g);
      const visible = new Set([
        ...(String(major).toUpperCase() === 'CS' ? g.coreCS : g.coreCSE),
        ...g.compCod,
      ].map((x) => String(x).toUpperCase()));
      const elements = [
        ...Array.from(visible).map((id) => ({ data: { id } })),
        ...g.edges.filter((e) => visible.has(String(e.from).toUpperCase()) && visible.has(String(e.to).toUpperCase()))
                 .map((e) => ({ data: { id: `h:${e.from}->${e.to}`, source: e.from, target: e.to } })),
        ...g.softEdges.filter((e) => visible.has(String(e.from).toUpperCase()) && visible.has(String(e.to).toUpperCase()))
                     .map((e) => ({ data: { id: `s:${e.from}->${e.to}`, source: e.from, target: e.to }, classes: 'soft' })),
      ];
      const cy = cytoscape({
        container: containerRef.current,
        elements,
        style: [
          { selector: 'node', style: { 'background-color': GRAY, 'label': 'data(id)', 'color': '#fff', 'text-valign': 'center', 'text-halign': 'center', 'font-size': 22, 'font-weight': '700', 'text-outline-width': 4, 'text-outline-color': '#0a0a0a', 'width': 124, 'height': 124, 'border-color': '#1f2937', 'border-width': 3, 'shape': 'ellipse' } },
          {
            selector: 'edge',
            style: {
              'width': 2.8,
              'line-color': '#a0a8b7',
              'target-arrow-color': '#a0a8b7',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 1,
              'curve-style': 'taxi',
              'taxi-direction': 'rightward',
              'taxi-turn': 42,
              'opacity': 0.88,
            },
          },
          {
            selector: 'edge.soft',
            style: {
              'line-color': '#38bdf8',
              'target-arrow-color': '#38bdf8',
              'line-style': 'dashed',
              'opacity': 0.45,
              'width': 2,
              'arrow-scale': 0.8,
            },
          },
          { selector: 'node.done', style: { 'background-color': BLUE, 'border-color': '#2f6eda' } },
          { selector: 'node.unlocked', style: { 'background-color': YELLOW, 'border-color': '#b08b00' } },
          { selector: 'node.locked', style: { 'background-color': GRAY } },
          { selector: 'node.hover', style: { 'border-width': 4 } },
          { selector: 'edge.highlight', style: { 'line-color': '#fff', 'width': 3, 'target-arrow-color': '#fff' } },
          { selector: 'node.search-hit', style: { 'border-color': '#f97316', 'border-width': 6, 'shadow-blur': 28, 'shadow-color': '#f97316', 'shadow-opacity': 0.65 } },
          { selector: 'node.search-neighbor', style: { 'border-color': '#22d3ee', 'border-width': 4 } },
          { selector: 'edge.search-link', style: { 'line-color': '#f59e0b', 'target-arrow-color': '#f59e0b', 'width': 3.2, 'opacity': 1 } },
          { selector: 'node.faded', style: { 'opacity': 0.16 } },
          { selector: 'edge.faded', style: { 'opacity': 0.12 } },
          { selector: 'node.dim', style: { 'opacity': 0.35 } },
        ],
      });
      cyRef.current = cy;

      cy.layout({
        name: 'dagre',
        rankDir: 'LR',
        ranker: 'network-simplex',
        nodeSep: 150,
        edgeSep: 120,
        rankSep: 250,
        animate: true,
        animationDuration: 350,
      }).run();
      cy.fit(undefined, 40);
    });
    return () => { mounted = false; if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; } };
    
  }, [major]);

  useEffect(() => {
    const cy = cyRef.current; if (!cy || graph.nodes.length === 0) return;
    cy.edges('.soft').style('display', ignoreSoft ? 'none' : 'element');
    const baseSet = new Set([
      ...doneSet,
      ...(includeCurrent ? currentSet : [])
    ]);
    const unlockedSet = computeUnlocked(baseSet);
    applyStyles(cy, baseSet, unlockedSet);
    computeUnlockPreview(baseSet, unlockedSet);
    applySearchFocus(cy, selectedCourse);
  }, [doneSet, currentSet, includeCurrent, ignoreSoft, major, graph.nodes.length, graph.coreCSE, graph.coreCS, graph.compCod, graph.prereqs, graph.softPrereqs, computeUnlocked, applyStyles, computeUnlockPreview, applySearchFocus, selectedCourse]);

  useEffect(() => {
    const cy = cyRef.current; if (!cy) return;
    const makeTippy = (ele) => {
      const id = String(ele.id());
      const title = graph.titles?.[id] || id;
      const reqs = (graph.prereqs?.[id] || []).join(', ');
      const ref = ele.popperRef ? ele.popperRef() : null;
      if (!ref) return;
      const content = document.createElement('div');
      content.innerHTML = `<strong>${id}</strong><div style="font-size:12px;color:#bbb;">${title || ''}</div>${reqs ? `<div style="font-size:12px;color:#aaa;margin-top:4px">Prereqs: ${reqs}</div>` : ''}`;
      const dummy = document.createElement('div');
      const tip = tippy(dummy, {
        getReferenceClientRect: ref.getBoundingClientRect,
        trigger: 'manual',
        placement: 'top',
        content,
        interactive: false,
      });
      ele.tippy = tip;
    };
    cy.nodes().forEach((n) => { makeTippy(n); });
    const onOver = (evt) => {
      const n = evt.target; const id = String(n.id());
      cy.elements().addClass('dim');
      n.removeClass('dim').addClass('hover');
      const neigh = n.closedNeighborhood(); neigh.removeClass('dim');
      cy.edges(`[source = "${id}"]`).addClass('highlight');
      cy.edges(`[target = "${id}"]`).addClass('highlight');
      if (n.tippy) n.tippy.show();
    };
    const onOut = (evt) => {
      const n = evt.target;
      cy.elements().removeClass('dim');
      cy.edges().removeClass('highlight');
      n.removeClass('hover');
      if (n.tippy) n.tippy.hide();
    };
    cy.on('mouseover', 'node', onOver);
    cy.on('mouseout', 'node', onOut);
    return () => { if (!cy) return; cy.removeListener('mouseover', 'node', onOver); cy.removeListener('mouseout', 'node', onOut); cy.nodes().forEach((n) => { if (n.tippy) { n.tippy.destroy(); delete n.tippy; } }); };
  }, [graph]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applySearchFocus(cy, selectedCourse);
  }, [selectedCourse, applySearchFocus]);

  const handleFit = () => { const cy = cyRef.current; if (cy) cy.fit(); };
  const handleFindCourse = () => {
    const code = String(searchInput || '').toUpperCase().trim();
    setSelectedCourse(code);
    const cy = cyRef.current;
    if (!cy || !code) return;
    const target = cy.getElementById(code);
    if (!target || target.empty()) return;
    const area = target.closedNeighborhood();
    cy.animate({ fit: { eles: area, padding: 120 }, duration: 350 });
  };
  const handleClearSearch = () => {
    setSearchInput('');
    setSelectedCourse('');
    const cy = cyRef.current;
    if (cy) cy.fit(undefined, 70);
  };

  return (
    <div
      className="panel"
      style={{
        display: 'grid',
        gap: '0.75rem',
        background: 'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(16,185,129,0.06), rgba(59,130,246,0.12))',
        border: '1px solid #334155',
      }}
    >
      <h3 className="panel-title" style={{ color: '#dbeafe' }}>Unlocked Courses ({String(major).toUpperCase()} Core)</h3>
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        
        <div className="panel" style={{ background: 'linear-gradient(180deg, rgba(2,6,23,0.95), rgba(15,23,42,0.92))', border: '1px solid #475569', borderRadius: 12 }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ color: '#e2e8f0' }}>Unlocked now:</strong>
            {Object.keys(unlockPreview).length === 0 && <span className="text-muted">None</span>}
            {Object.keys(unlockPreview).sort().map((c, idx) => (
              <span
                key={c}
                style={{
                  background: idx % 2 === 0 ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)',
                  border: idx % 2 === 0 ? '1px solid #60a5fa' : '1px solid #34d399',
                  color: '#e2e8f0',
                  borderRadius: 14,
                  padding: '6px 10px',
                  boxShadow: '0 0 14px rgba(59,130,246,0.15)',
                }}
              >
                {c}
              </span>
            ))}
          </div>
          <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.5rem' }}>
            {Object.entries(unlockPreview).sort((a,b)=> a[0].localeCompare(b[0])).map(([c, list]) => (
              <div key={c} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="text-muted" style={{ color: '#cbd5e1' }}>Taking {c} unlocks:</span>
                {list.length === 0 ? <span className="text-muted">—</span> : list.map((n) => (
                  <span key={n} style={{ background: 'rgba(245,158,11,0.18)', border: '1px solid #f59e0b', color: '#fef3c7', borderRadius: 14, padding: '6px 10px' }}>{n}</span>
                ))}
              </div>
            ))}
          </div>
        </div>

        
        <div className="panel" style={{ display: 'grid', gap: '0.5rem', background: 'linear-gradient(180deg, rgba(2,6,23,0.94), rgba(15,23,42,0.88))', border: '1px solid #334155', borderRadius: 12 }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 16, background: BLUE, borderRadius: 8 }}></span><span className="text-muted">Done</span></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 16, background: YELLOW, borderRadius: 8 }}></span><span className="text-muted">Unlocked</span></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 16, background: GRAY, borderRadius: 8 }}></span><span className="text-muted">Locked</span></span>
            <input
              list="graph-course-search"
              className="input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleFindCourse();
                }
              }}
              placeholder="Search course code"
              style={{ minWidth: 180, maxWidth: 230, height: 40 }}
            />
            <datalist id="graph-course-search">
              {visibleCourses.map((code) => (
                <option key={code} value={code} />
              ))}
            </datalist>
            <button className="button" type="button" onClick={handleFindCourse}>Find</button>
            <button className="button" type="button" onClick={handleClearSearch}>Clear</button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
              <input type="checkbox" checked={includeCurrent} onChange={(e) => setIncludeCurrent(e.target.checked)} />
              <span className="text-muted">Include current-term courses</span>
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={ignoreSoft} onChange={(e) => setIgnoreSoft(e.target.checked)} />
              <span className="text-muted">Ignore soft prerequisites</span>
            </label>
            <button className="button" type="button" onClick={handleFit} style={{ marginLeft: 'auto' }}>Fit</button>
          </div>
          <div
            ref={containerRef}
            style={{
              width: '100%',
              height: 'clamp(780px, 82vh, 1200px)',
              borderRadius: 12,
              background: '#0f0f0f',
              border: '1px solid #222',
              position: 'relative',
            }}
          />
        </div>
      </div>
    </div>
  );
}
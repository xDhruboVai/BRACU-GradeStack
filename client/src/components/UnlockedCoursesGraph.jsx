import React, { useEffect, useMemo, useRef, useState } from 'react';
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

export default function UnlockedCoursesGraph({ doneCodes = [], currentCodes = [] }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [graph, setGraph] = useState({ nodes: [], edges: [], prereqs: {}, titles: {} });
  const [unlocked, setUnlocked] = useState(() => new Set());
  const [unlockPreview, setUnlockPreview] = useState({}); 
  const [includeCurrent, setIncludeCurrent] = useState(true);

  const doneSet = useMemo(() => new Set((doneCodes || []).map((c) => String(c).toUpperCase())), [doneCodes]);
  const currentSet = useMemo(() => new Set((currentCodes || []).map((c) => String(c).toUpperCase())), [currentCodes]);

  const computeUnlocked = (baseSet) => {
    const acc = new Set();
    for (const c of graph.nodes) {
      const up = String(c).toUpperCase();
      if (baseSet.has(up)) continue;
      const reqs = graph.prereqs[up] || [];
      let ok = true;
      for (const r of reqs) {
        if (!baseSet.has(String(r).toUpperCase())) { ok = false; break; }
      }
      if (ok) acc.add(up);
    }
    return acc;
  };

  const applyStyles = (cy, baseSet, unlockedSet) => {
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
  };

  const computeUnlockPreview = (baseSet, currentUnlocked) => {
    const curr = currentUnlocked || computeUnlocked(baseSet);
    const map = {};
    for (const u of Array.from(curr)) {
      const next = computeUnlocked(new Set([...baseSet, u]));
      const delta = Array.from(next).filter((x) => !curr.has(x));
      map[u] = delta.sort();
    }
    setUnlockPreview(map);
  };

  const runLayout = (cy) => {
    if (!cy) return;
    cy.layout({ name: 'dagre', rankDir: 'LR', nodeSep: 90, edgeSep: 40, rankSep: 140, animate: true, animationDuration: 350 }).run();
    cy.fit();
  };

  useEffect(() => {
    let mounted = true;
    fetchCseGraph().then((g) => {
      if (!mounted) return;
      setGraph(g);
      const elements = [
        ...g.nodes.map((id) => ({ data: { id } })),
        ...g.edges.map((e) => ({ data: { id: `${e.from}->${e.to}`, source: e.from, target: e.to } })),
      ];
      const cy = cytoscape({
        container: containerRef.current,
        elements,
        style: [
          { selector: 'node', style: { 'background-color': GRAY, 'label': 'data(id)', 'color': '#fff', 'text-valign': 'center', 'text-halign': 'center', 'font-size': 18, 'font-weight': '600', 'text-outline-width': 3, 'text-outline-color': '#0a0a0a', 'width': 96, 'height': 96, 'border-color': '#1f2937', 'border-width': 3, 'shape': 'ellipse' } },
          { selector: 'edge', style: { 'width': 3, 'line-color': '#9aa0a6', 'target-arrow-color': '#9aa0a6', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
          { selector: 'node.done', style: { 'background-color': BLUE, 'border-color': '#2f6eda' } },
          { selector: 'node.unlocked', style: { 'background-color': YELLOW, 'border-color': '#b08b00' } },
          { selector: 'node.locked', style: { 'background-color': GRAY } },
          { selector: 'node.hover', style: { 'border-width': 4 } },
          { selector: 'edge.highlight', style: { 'line-color': '#fff', 'width': 3, 'target-arrow-color': '#fff' } },
          { selector: 'node.dim', style: { 'opacity': 0.35 } },
        ],
      });
      cyRef.current = cy;

      const baseSet = new Set([
        ...doneSet,
        ...(includeCurrent ? currentSet : [])
      ]);
      const unlockedSet = computeUnlocked(baseSet);
      setUnlocked(unlockedSet);
      applyStyles(cy, baseSet, unlockedSet);
      computeUnlockPreview(baseSet, unlockedSet);
      runLayout(cy);
    });
    return () => { mounted = false; if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; } };
    
  }, []);

  useEffect(() => {
    const cy = cyRef.current; if (!cy || graph.nodes.length === 0) return;
    const baseSet = new Set([
      ...doneSet,
      ...(includeCurrent ? currentSet : [])
    ]);
    const unlockedSet = computeUnlocked(baseSet);
    setUnlocked(unlockedSet);
    applyStyles(cy, baseSet, unlockedSet);
    computeUnlockPreview(baseSet, unlockedSet);
  }, [doneSet, currentSet, includeCurrent, graph.nodes, graph.prereqs]);

  useEffect(() => {
    const cy = cyRef.current; if (!cy) return;
    const makeTippy = (ele) => {
      const id = String(ele.id());
      const title = graph.titles?.[id] || id;
      const reqs = (graph.prereqs?.[id] || []).join(', ');
      const ref = ele.popperRef ? ele.popperRef() : null;
      if (!ref) return;
      const content = document.createElement('div');
      content.innerHTML = `<strong>${id}</strong><div style="font-size:12px;color:#bbb;">${title || ''}</div>${reqs ? `<div style=\"font-size:12px;color:#aaa;margin-top:4px\">Prereqs: ${reqs}</div>`:''}`;
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

  const handleFit = () => { const cy = cyRef.current; if (cy) cy.fit(); };

  return (
    <div className="panel" style={{ display: 'grid', gap: '0.75rem' }}>
      <h3 className="panel-title">Unlocked Courses (CSE Core)</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: '0.75rem', alignItems: 'start' }}>
        
        <div className="panel" style={{ background: '#121212', border: '1px solid #1f1f1f', borderRadius: 12 }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <strong>Unlocked now:</strong>
            {Object.keys(unlockPreview).length === 0 && <span className="text-muted">None</span>}
            {Object.keys(unlockPreview).sort().map((c) => (
              <span key={c} style={{ background: '#1f1f1f', border: '1px solid #333', borderRadius: 14, padding: '6px 10px' }}>{c}</span>
            ))}
          </div>
          <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.5rem' }}>
            {Object.entries(unlockPreview).sort((a,b)=> a[0].localeCompare(b[0])).map(([c, list]) => (
              <div key={c} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="text-muted">Taking {c} unlocks:</span>
                {list.length === 0 ? <span className="text-muted">—</span> : list.map((n) => (
                  <span key={n} style={{ background: '#1f1f1f', border: '1px solid #333', borderRadius: 14, padding: '6px 10px' }}>{n}</span>
                ))}
              </div>
            ))}
          </div>
        </div>

        
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, background: BLUE, borderRadius: 7 }}></span><span className="text-muted">Done</span></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, background: YELLOW, borderRadius: 7 }}></span><span className="text-muted">Unlocked</span></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, background: GRAY, borderRadius: 7 }}></span><span className="text-muted">Locked</span></span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
              <input type="checkbox" checked={includeCurrent} onChange={(e) => setIncludeCurrent(e.target.checked)} />
              <span className="text-muted">Include current-term courses</span>
            </label>
            <button className="button" type="button" onClick={handleFit} style={{ marginLeft: 'auto' }}>Fit</button>
          </div>
          <div ref={containerRef} style={{ width: '100%', height: 800, borderRadius: 12, background: '#0f0f0f', border: '1px solid #222', position: 'relative' }} />
        </div>
      </div>
    </div>
  );
}
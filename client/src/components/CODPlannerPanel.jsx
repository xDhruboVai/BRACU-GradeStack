import React, { useMemo } from 'react';
import { buildCodPlanner, getRemainingCodCoursesByStream } from '../utils/courseClassification';

function MetricCard({ label, value }) {
  return (
    <div style={{ background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(2,6,23,0.95))', border: '1px solid #334155', borderRadius: 12, padding: '0.7rem 0.8rem' }}>
      <div className="text-muted" style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>{value}</div>
    </div>
  );
}

export default function CODPlannerPanel({
  completedCodes = [],
  currentCodes = [],
  simulatedCodes = [],
  includeCurrentSemesterCourses = false,
  includeSimulatedCourses = false,
}) {
  const appliedCodes = useMemo(() => {
    const merged = new Set((completedCodes || []).map((x) => String(x || '').toUpperCase()).filter(Boolean));
    if (includeCurrentSemesterCourses) {
      for (const code of (currentCodes || [])) merged.add(String(code || '').toUpperCase());
    }
    if (includeSimulatedCourses) {
      for (const code of (simulatedCodes || [])) merged.add(String(code || '').toUpperCase());
    }
    return Array.from(merged).sort();
  }, [completedCodes, currentCodes, simulatedCodes, includeCurrentSemesterCourses, includeSimulatedCourses]);

  const planner = useMemo(() => buildCodPlanner(appliedCodes), [appliedCodes]);
  const remainingByStream = useMemo(() => getRemainingCodCoursesByStream(appliedCodes), [appliedCodes]);

  const recommendations = useMemo(() => {
    if (planner.totalTaken >= planner.max) return [];
    const list = [];
    if (planner.arts === 0) list.push('Arts (Required)');
    if (planner.ss === 0) list.push('Social Sciences (Required)');
    if (planner.cst === 0) list.push('CST (Choose at most one)');
    if (planner.science === 0) list.push('Science (Optional)');
    return list;
  }, [planner]);

  return (
    <div
      className="panel"
      style={{
        display: 'grid',
        gap: '0.75rem',
        background: 'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(16,185,129,0.08), rgba(251,191,36,0.12))',
        border: '1px solid #334155',
      }}
    >
      <h3 className="panel-title" style={{ color: '#e2e8f0' }}>COD Planner</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem' }}>
        <MetricCard label="Total CODs Completed" value={`${planner.totalTaken} / ${planner.max}`} />
        <MetricCard label="Arts" value={planner.arts} />
        <MetricCard label="Social Sciences" value={planner.ss} />
        <MetricCard label="CST" value={planner.cst} />
        <MetricCard label="Science" value={planner.science} />
      </div>

      <div style={{ background: 'linear-gradient(180deg, rgba(16,185,129,0.12), rgba(2,6,23,0.8))', border: '1px solid #10b981', borderRadius: 12, padding: '0.8rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.45rem' }}>Recommended Streams to Prioritize</div>
        {planner.totalTaken >= planner.max ? (
          <div style={{ color: '#4ade80' }}>You have completed the maximum number of CODs allowed (5).</div>
        ) : recommendations.length > 0 ? (
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {recommendations.map((item) => (
              <span key={item} style={{ background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: 14, padding: '0.35rem 0.6rem' }}>{item}</span>
            ))}
          </div>
        ) : (
          <div className="text-muted">You met stream coverage requirements. Pick any remaining CODs to reach 5.</div>
        )}
      </div>

      <div style={{ display: 'grid', gap: '0.6rem' }}>
        <div style={{ fontWeight: 600 }}>Remaining COD Courses by Stream</div>

        <details style={{ background: '#121212', border: '1px solid #2b2b2b', borderRadius: 12, padding: '0.6rem 0.75rem' }}>
          <summary>Arts ({remainingByStream.arts.length} remaining)</summary>
          <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {remainingByStream.arts.length > 0 ? remainingByStream.arts.map((code, idx) => (
              <span key={code} style={{ background: '#1f1f1f', border: '1px solid #fb718599', borderRadius: 14, padding: '0.3rem 0.55rem' }}>{idx + 1}. {code}</span>
            )) : <span className="text-muted">All courses in this stream completed.</span>}
          </div>
        </details>

        <details style={{ background: '#121212', border: '1px solid #2b2b2b', borderRadius: 12, padding: '0.6rem 0.75rem' }}>
          <summary>Social Sciences ({remainingByStream.ss.length} remaining)</summary>
          <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {remainingByStream.ss.length > 0 ? remainingByStream.ss.map((code, idx) => (
              <span key={code} style={{ background: '#1f1f1f', border: '1px solid #f59e0b99', borderRadius: 14, padding: '0.3rem 0.55rem' }}>{idx + 1}. {code}</span>
            )) : <span className="text-muted">All courses in this stream completed.</span>}
          </div>
        </details>

        <details style={{ background: '#121212', border: '1px solid #2b2b2b', borderRadius: 12, padding: '0.6rem 0.75rem' }}>
          <summary>CST ({remainingByStream.cst.length} remaining)</summary>
          <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {remainingByStream.cst.length > 0 ? remainingByStream.cst.map((code, idx) => (
              <span key={code} style={{ background: '#1f1f1f', border: '1px solid #22d3ee99', borderRadius: 14, padding: '0.3rem 0.55rem' }}>{idx + 1}. {code}</span>
            )) : <span className="text-muted">All courses in this stream completed.</span>}
          </div>
        </details>

        <details style={{ background: '#121212', border: '1px solid #2b2b2b', borderRadius: 12, padding: '0.6rem 0.75rem' }}>
          <summary>Science ({remainingByStream.science.length} remaining)</summary>
          <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {remainingByStream.science.length > 0 ? remainingByStream.science.map((code, idx) => (
              <span key={code} style={{ background: '#1f1f1f', border: '1px solid #4ade8099', borderRadius: 14, padding: '0.3rem 0.55rem' }}>{idx + 1}. {code}</span>
            )) : <span className="text-muted">All courses in this stream completed.</span>}
          </div>
        </details>
      </div>
    </div>
  );
}

import React, { useMemo } from 'react';
import { buildCodPlanner, getRemainingCodCoursesByStream } from '../utils/courseClassification';

function MetricCard({ label, value }) {
  return (
    <div style={{ background: '#1b1b1b', border: '1px solid #333', borderRadius: 12, padding: '0.7rem 0.8rem' }}>
      <div className="text-muted" style={{ fontSize: '0.82rem' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default function CODPlannerPanel({ completedCodes = [] }) {
  const planner = useMemo(() => buildCodPlanner(completedCodes), [completedCodes]);
  const remainingByStream = useMemo(() => getRemainingCodCoursesByStream(completedCodes), [completedCodes]);

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
    <div className="panel" style={{ display: 'grid', gap: '0.75rem' }}>
      <h3 className="panel-title">COD Planner</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem' }}>
        <MetricCard label="Total CODs Completed" value={`${planner.totalTaken} / ${planner.max}`} />
        <MetricCard label="Arts" value={planner.arts} />
        <MetricCard label="Social Sciences" value={planner.ss} />
        <MetricCard label="CST" value={planner.cst} />
        <MetricCard label="Science" value={planner.science} />
      </div>

      <div style={{ background: '#121212', border: '1px solid #2b2b2b', borderRadius: 12, padding: '0.8rem' }}>
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

      <div style={{ background: '#121212', border: '1px solid #2b2b2b', borderRadius: 12, padding: '0.8rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.45rem' }}>Suggested COD Plan</div>
        {planner.plan.length > 0 ? (
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {planner.plan.map((code) => (
              <span key={code} style={{ background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: 14, padding: '0.35rem 0.6rem' }}>{code}</span>
            ))}
          </div>
        ) : (
          <div className="text-muted">No additional plan needed right now.</div>
        )}
      </div>

      <div style={{ display: 'grid', gap: '0.6rem' }}>
        <div style={{ fontWeight: 600 }}>Remaining COD Courses by Stream</div>

        <details style={{ background: '#121212', border: '1px solid #2b2b2b', borderRadius: 12, padding: '0.6rem 0.75rem' }}>
          <summary>Arts ({remainingByStream.arts.length} remaining)</summary>
          <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {remainingByStream.arts.length > 0 ? remainingByStream.arts.map((code) => (
              <span key={code} style={{ background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: 14, padding: '0.3rem 0.55rem' }}>{code}</span>
            )) : <span className="text-muted">All courses in this stream completed.</span>}
          </div>
        </details>

        <details style={{ background: '#121212', border: '1px solid #2b2b2b', borderRadius: 12, padding: '0.6rem 0.75rem' }}>
          <summary>Social Sciences ({remainingByStream.ss.length} remaining)</summary>
          <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {remainingByStream.ss.length > 0 ? remainingByStream.ss.map((code) => (
              <span key={code} style={{ background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: 14, padding: '0.3rem 0.55rem' }}>{code}</span>
            )) : <span className="text-muted">All courses in this stream completed.</span>}
          </div>
        </details>

        <details style={{ background: '#121212', border: '1px solid #2b2b2b', borderRadius: 12, padding: '0.6rem 0.75rem' }}>
          <summary>CST ({remainingByStream.cst.length} remaining)</summary>
          <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {remainingByStream.cst.length > 0 ? remainingByStream.cst.map((code) => (
              <span key={code} style={{ background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: 14, padding: '0.3rem 0.55rem' }}>{code}</span>
            )) : <span className="text-muted">All courses in this stream completed.</span>}
          </div>
        </details>

        <details style={{ background: '#121212', border: '1px solid #2b2b2b', borderRadius: 12, padding: '0.6rem 0.75rem' }}>
          <summary>Science ({remainingByStream.science.length} remaining)</summary>
          <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {remainingByStream.science.length > 0 ? remainingByStream.science.map((code) => (
              <span key={code} style={{ background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: 14, padding: '0.3rem 0.55rem' }}>{code}</span>
            )) : <span className="text-muted">All courses in this stream completed.</span>}
          </div>
        </details>
      </div>
    </div>
  );
}

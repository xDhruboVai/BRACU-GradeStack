import React, { useMemo } from 'react';
import { categorizeCompletedCourses } from '../utils/courseClassification';

function SimpleListTable({ rows = [], columns = [], emptyText, accentColor = '#60a5fa' }) {
  if (!rows.length) {
    return <div style={{ color: '#a5b4fc' }}>{emptyText}</div>;
  }

  return (
    <div style={{ maxHeight: 320, overflow: 'auto', border: `1px solid ${accentColor}55`, borderRadius: 10, boxShadow: `0 0 20px ${accentColor}22 inset` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: `${accentColor}22` }}>
            <th style={{ textAlign: 'left', padding: '0.55rem 0.6rem', borderBottom: `1px solid ${accentColor}55`, fontSize: '0.86rem', width: 54 }}>
              #
            </th>
            {columns.map((col) => (
              <th key={col.key} style={{ textAlign: 'left', padding: '0.55rem 0.6rem', borderBottom: `1px solid ${accentColor}55`, fontSize: '0.86rem' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.code || row.courseCode || 'row'}-${idx}`} style={{ background: idx % 2 === 0 ? '#0f0f12' : '#12151e' }}>
              <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #232323', fontSize: '0.88rem', color: accentColor, fontWeight: 700 }}>
                {idx + 1}
              </td>
              {columns.map((col) => (
                <td key={col.key} style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #232323', fontSize: '0.9rem' }}>
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CompletedCourseBreakdown({ completedCodes = [], major = 'CSE' }) {
  const data = useMemo(() => categorizeCompletedCourses(completedCodes, major), [completedCodes, major]);

  const coreRows = useMemo(
    () => data.coreCourses.map((code) => ({ code })),
    [data.coreCourses]
  );

  const compulsoryRows = useMemo(
    () => data.compulsoryCodCourses.map((code) => ({ code })),
    [data.compulsoryCodCourses]
  );

  const codRows = useMemo(
    () => data.codCourses
      .slice()
      .sort((a, b) => `${a.stream}-${a.code}`.localeCompare(`${b.stream}-${b.code}`))
      .map((item) => ({ code: item.code, stream: item.stream })),
    [data.codCourses]
  );

  const electiveRows = useMemo(
    () => data.electiveCourses.map((code) => ({ code })),
    [data.electiveCourses]
  );

  return (
    <div
      className="panel"
      style={{
        display: 'grid',
        gap: '0.9rem',
        background: 'linear-gradient(135deg, rgba(96,165,250,0.14) 0%, rgba(251,191,36,0.08) 45%, rgba(52,211,153,0.12) 100%)',
        border: '1px solid #334155',
      }}
    >
      <h3 className="panel-title" style={{ color: '#dbeafe' }}>Completed Course Breakdown</h3>
      <div className="text-muted" style={{ marginTop: '-0.2rem' }}>
        Major: {String(major || 'CSE').toUpperCase()}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
        <section className="panel" style={{ background: 'linear-gradient(180deg, rgba(37,99,235,0.12), rgba(2,6,23,0.8))', border: '1px solid #3b82f6' }}>
          <h4 className="panel-title" style={{ color: '#bfdbfe' }}>Core Courses ({coreRows.length})</h4>
          <SimpleListTable
            rows={coreRows}
            columns={[{ key: 'code', label: 'Course Code' }]}
            emptyText="No core courses completed."
            accentColor="#60a5fa"
          />
        </section>

        <section className="panel" style={{ background: 'linear-gradient(180deg, rgba(8,145,178,0.14), rgba(2,6,23,0.8))', border: '1px solid #22d3ee' }}>
          <h4 className="panel-title" style={{ color: '#cffafe' }}>Compulsory COD ({compulsoryRows.length})</h4>
          <SimpleListTable
            rows={compulsoryRows}
            columns={[{ key: 'code', label: 'Course Code' }]}
            emptyText="No compulsory COD courses completed."
            accentColor="#22d3ee"
          />
        </section>

        <section className="panel" style={{ background: 'linear-gradient(180deg, rgba(217,70,239,0.12), rgba(2,6,23,0.8))', border: '1px solid #c084fc' }}>
          <h4 className="panel-title" style={{ color: '#f5d0fe' }}>COD Courses ({codRows.length})</h4>
          <SimpleListTable
            rows={codRows}
            columns={[
              { key: 'code', label: 'Course Code' },
              { key: 'stream', label: 'Stream' },
            ]}
            emptyText="No COD courses completed."
            accentColor="#c084fc"
          />
        </section>

        <section className="panel" style={{ background: 'linear-gradient(180deg, rgba(245,158,11,0.14), rgba(2,6,23,0.8))', border: '1px solid #f59e0b' }}>
          <h4 className="panel-title" style={{ color: '#fde68a' }}>Electives ({electiveRows.length})</h4>
          <SimpleListTable
            rows={electiveRows}
            columns={[{ key: 'code', label: 'Course Code' }]}
            emptyText="No elective courses completed."
            accentColor="#f59e0b"
          />
        </section>
      </div>
    </div>
  );
}

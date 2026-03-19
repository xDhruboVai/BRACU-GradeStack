import React, { useMemo } from 'react';
import { categorizeCompletedCourses } from '../utils/courseClassification';

function SimpleListTable({ rows = [], columns = [], emptyText }) {
  if (!rows.length) {
    return <div className="text-muted">{emptyText}</div>;
  }

  return (
    <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #2a2a2a', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#171717' }}>
            {columns.map((col) => (
              <th key={col.key} style={{ textAlign: 'left', padding: '0.55rem 0.6rem', borderBottom: '1px solid #2a2a2a', fontSize: '0.86rem' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.code || row.courseCode || 'row'}-${idx}`}>
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
    <div className="panel" style={{ display: 'grid', gap: '0.9rem' }}>
      <h3 className="panel-title">Completed Course Breakdown</h3>
      <div className="text-muted" style={{ marginTop: '-0.2rem' }}>
        Major: {String(major || 'CSE').toUpperCase()}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
        <section className="panel" style={{ background: '#121212', border: '1px solid #232323' }}>
          <h4 className="panel-title">Core Courses ({coreRows.length})</h4>
          <SimpleListTable
            rows={coreRows}
            columns={[{ key: 'code', label: 'Course Code' }]}
            emptyText="No core courses completed."
          />
        </section>

        <section className="panel" style={{ background: '#121212', border: '1px solid #232323' }}>
          <h4 className="panel-title">Compulsory COD ({compulsoryRows.length})</h4>
          <SimpleListTable
            rows={compulsoryRows}
            columns={[{ key: 'code', label: 'Course Code' }]}
            emptyText="No compulsory COD courses completed."
          />
        </section>

        <section className="panel" style={{ background: '#121212', border: '1px solid #232323' }}>
          <h4 className="panel-title">COD Courses ({codRows.length})</h4>
          <SimpleListTable
            rows={codRows}
            columns={[
              { key: 'code', label: 'Course Code' },
              { key: 'stream', label: 'Stream' },
            ]}
            emptyText="No COD courses completed."
          />
        </section>

        <section className="panel" style={{ background: '#121212', border: '1px solid #232323' }}>
          <h4 className="panel-title">Electives ({electiveRows.length})</h4>
          <SimpleListTable
            rows={electiveRows}
            columns={[{ key: 'code', label: 'Course Code' }]}
            emptyText="No elective courses completed."
          />
        </section>
      </div>
    </div>
  );
}

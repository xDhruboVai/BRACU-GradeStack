
export function computeCGPA(latestAttempts) {
  const credits = (latestAttempts || []).reduce((s,a)=> s + (a.credit || 0), 0);
  const points = (latestAttempts || []).reduce((s,a)=> s + ((a.gpa || 0) * (a.credit || 0)), 0);
  return credits > 0 ? Number((points / credits).toFixed(2)) : null;
}


export function totalCreditsRequired(major) {
  const m = String(major || '').toUpperCase();
  const map = {
    CSE: 136,
    CS: 124,
    EEE: 140,
    BBA: 120,
  };
  return map[m] || 130;
}

// Compute max projection if remaining credits are all 4.0
export function maxProjection(profile, creditsEarned, pointsTotal) {
  const major = profile?.major || 'CSE';
  const required = totalCreditsRequired(major);
  const remaining = Math.max(required - (creditsEarned || 0), 0);
  const denom = (creditsEarned || 0) + remaining;
  const maxCgpa = denom > 0 ? Number(((pointsTotal || 0) + (4 * remaining)) / denom).toFixed(2) : null;
  return { remaining, maxCgpa: maxCgpa ? Number(maxCgpa) : null };
}

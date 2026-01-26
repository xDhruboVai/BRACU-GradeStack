import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

export async function fetchSemesters(userId) {
  const { data } = await axios.get(`${API}/semesters/${userId}`);
  return Array.isArray(data?.semesters) ? data.semesters : [];
}

export async function fetchAttempts(userId) {
  const { data } = await axios.get(`${API}/course-attempts/${userId}`);
  return Array.isArray(data?.attempts) ? data.attempts : [];
}

export async function fetchSummary(userId) {
  const { data } = await axios.get(`${API}/analyzer/summary/${userId}`);
  return data || {};
}

export async function fetchSuggestions(userId) {
  const { data } = await axios.get(`${API}/courses/suggestions/${userId}`);
  // Normalize to array of { code, title }
  if (Array.isArray(data?.meta)) return data.meta;
  if (Array.isArray(data?.suggestions)) return data.suggestions.map((c) => ({ code: c, title: null }));
  return [];
}

export async function fetchCurrentCourses(userId) {
  const { data } = await axios.get(`${API}/marks/current-courses/${userId}`);
  return Array.isArray(data?.courses) ? data.courses : [];
}

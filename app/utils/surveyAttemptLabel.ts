export function buildStudentSurveyTakeUrl(surveyCode: string): string {
  return `/student/survey/${encodeURIComponent(surveyCode)}?take=1`;
}

export function buildStudentSurveyReviewUrl(surveyCode: string): string {
  return `/student/survey/${encodeURIComponent(surveyCode)}?review=1`;
}

export function openStudentSurveyTakeInNewTab(surveyCode: string): void {
  const url = buildStudentSurveyTakeUrl(surveyCode);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function openStudentSurveyReviewInNewTab(surveyCode: string): void {
  const url = buildStudentSurveyReviewUrl(surveyCode);
  window.open(url, '_blank', 'noopener,noreferrer');
}

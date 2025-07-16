// 公告事項 CRUD
export const getAnnouncements = async () => {
  const res = await fetch('/api/announcement/list');
  const result = await res.json();
  return result;
};

export const createAnnouncement = async (data: Record<string, unknown>) => {
  const id = data.id || Date.now().toString();
  const res = await fetch('/api/announcement/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, id }),
  });
  const result = await res.json();
  return result;
};

export const updateAnnouncement = async (id: string, data: Record<string, unknown>) => {
  const res = await fetch('/api/announcement/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...data }),
  });
  return await res.json();
};

export const deleteAnnouncement = async (id: string) => {
  const res = await fetch('/api/announcement/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  return await res.json();
};

// 課程資訊 CRUD
export const getCourseInfo = async () => {
  const res = await fetch('/api/course-info/list');
  if (res.ok) {
    const result = await res.json();
    return result;
  }
  return [];
};

export const createCourseInfo = async (data: Record<string, unknown>) => {
  const res = await fetch('/api/course-info/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  return result;
};

export const updateCourseInfo = async (id: string, data: Record<string, unknown>) => {
  const res = await fetch('/api/course-info/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...data }),
  });
  return await res.json();
};

export const deleteCourseInfo = async (id: string) => {
  const res = await fetch('/api/course-info/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  return await res.json();
}; 
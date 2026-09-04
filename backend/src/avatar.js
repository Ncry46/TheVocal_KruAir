const STUDENT_PHOTOS = ['/img/av-1.jpg', '/img/av-2.jpg', '/img/av-3.jpg'];
const ILLUSTRATED = [
    '/img/avatars/av-a.svg',
    '/img/avatars/av-b.svg',
    '/img/avatars/av-c.svg',
    '/img/avatars/av-d.svg',
    '/img/avatars/av-e.svg',
    '/img/avatars/av-f.svg',
    '/img/avatars/av-g.svg',
    '/img/avatars/av-h.svg',
    '/img/avatars/av-i.svg',
    '/img/avatars/av-j.svg',
    '/img/avatars/av-k.svg',
    '/img/avatars/av-l.svg',
];
const TEACHER_PHOTO = '/img/teacher-studio.jpg';

/** Preset avatars shipped with the app (no user uploads). */
export const PRESET_AVATARS = [...STUDENT_PHOTOS, ...ILLUSTRATED, TEACHER_PHOTO];

export function defaultAvatar(role, email) {
    if (role === 'teacher' || role === 'admin') {
        return TEACHER_PHOTO;
    }
    const key = String(email || '');
    let n = 0;
    for (const ch of key) {
        n += ch.charCodeAt(0);
    }
    return STUDENT_PHOTOS[n % STUDENT_PHOTOS.length];
}

export function isAllowedPresetAvatar(avatar) {
    return PRESET_AVATARS.includes(String(avatar || '').trim());
}

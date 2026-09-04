/** Preset avatars shipped in /assets/img — no user upload storage. */
export const PRESET_AVATARS = [
    '/img/av-1.jpg',
    '/img/av-2.jpg',
    '/img/av-3.jpg',
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
    '/img/teacher-studio.jpg',
];

export function avatarSrc(user) {
    if (user?.avatar) {
        return user.avatar;
    }
    if (user?.role === 'teacher' || user?.role === 'admin') {
        return '/img/teacher-studio.jpg';
    }
    return '/img/av-1.jpg';
}

export function homePath(user) {
    if (user?.role === 'teacher' || user?.role === 'admin') {
        return '/teacher';
    }
    if (user?.role === 'student') {
        return '/app';
    }
    return '/';
}

export function dashboardPath(user) {
    if (user?.role === 'teacher' || user?.role === 'admin') {
        return '/teacher';
    }
    return '/app';
}

export function profilePath(user) {
    if (user?.role === 'teacher' || user?.role === 'admin') {
        return '/teacher/profile';
    }
    return '/app/profile';
}

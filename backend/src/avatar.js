const STUDENT_PHOTOS = ['/img/av-1.jpg', '/img/av-2.jpg', '/img/av-3.jpg'];

export function defaultAvatar(role, email) {
    if (role === 'teacher') {
        return '/img/teacher-studio.jpg';
    }
    const key = String(email || '');
    let n = 0;
    for (const ch of key) {
        n += ch.charCodeAt(0);
    }
    return STUDENT_PHOTOS[n % STUDENT_PHOTOS.length];
}

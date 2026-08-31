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
    return '/app';
}

export function profilePath(user) {
    if (user?.role === 'teacher' || user?.role === 'admin') {
        return '/teacher/profile';
    }
    return '/app/profile';
}

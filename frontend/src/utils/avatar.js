export function avatarSrc(user) {
    if (user?.avatar) {
        return user.avatar;
    }
    if (user?.role === 'teacher') {
        return '/img/teacher-studio.jpg';
    }
    return '/img/av-1.jpg';
}

export function homePath(user) {
    if (user?.role === 'teacher') {
        return '/teacher';
    }
    if (user?.role === 'admin') {
        return '/admin';
    }
    return '/app';
}

export function profilePath(user) {
    if (user?.role === 'teacher') {
        return '/teacher/profile';
    }
    if (user?.role === 'admin') {
        return '/admin/profile';
    }
    return '/app/profile';
}

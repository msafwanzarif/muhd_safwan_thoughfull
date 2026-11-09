import { roleHome } from '~/utils/auth';

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.matched.length) return;
  const user = useCurrentUser();
  const auth = useAuth();
  const isPublic = ['/login', '/signup'].includes(to.path);

  try {
    await auth.load();
  } catch {
    if (isPublic) return;
    throw createError({
      statusCode: 503,
      statusMessage: 'Unable to check your session. Please try again.',
    });
  }

  if (!user.value) {
    if (!isPublic)
      return navigateTo(
        {
          path: '/login',
          query: to.path === '/' ? {} : { redirect: to.fullPath },
        },
        { replace: true },
      );
    return;
  }

  const home = roleHome(user.value.role);
  if (isPublic || to.path === '/' || to.path === '/pro')
    return navigateTo(home, { replace: true });

  const professionalPage = to.path.startsWith('/pro/');
  if (professionalPage !== (user.value.role === 'professional'))
    return navigateTo(home, { replace: true });
});

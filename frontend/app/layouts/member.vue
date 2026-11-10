<template>
  <div class="min-h-dvh">
    <a href="#main-content" class="sr-only focus:not-sr-only"
      >Skip to content</a
    >
    <header class="border-b border-default bg-(--brand-surface)">
      <div
        class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 lg:min-h-20 lg:px-10 lg:py-3"
      >
        <AppBrand />
        <nav
          aria-label="Main navigation"
          class="order-3 grid w-full grid-cols-2 gap-1 rounded-full bg-muted p-1 text-[13px] sm:text-sm lg:order-none lg:flex lg:w-auto lg:gap-2 lg:bg-transparent lg:p-0"
        >
          <NuxtLink
            to="/professionals"
            active-class="bg-(--brand-surface) text-primary lg:bg-muted"
            class="flex min-h-11 items-center justify-center gap-2 rounded-full px-4 font-semibold transition-colors hover:bg-muted"
            ><UIcon name="i-lucide-search" class="hidden size-4 sm:block" />Find
            a professional</NuxtLink
          >
          <NuxtLink
            to="/sessions"
            active-class="bg-muted text-primary"
            class="flex min-h-11 items-center justify-center gap-2 rounded-full px-4 font-semibold transition-colors hover:bg-muted"
            ><UIcon
              name="i-lucide-calendar-days"
              class="hidden size-4 sm:block"
            />My sessions</NuxtLink
          >
        </nav>
        <div class="flex items-center gap-1">
          <NotificationsBell compact /><AppUserMenu />
        </div>
      </div>
    </header>
    <main
      id="main-content"
      class="member-main mx-auto max-w-7xl px-4 py-6 lg:px-10 lg:py-8"
    >
      <AppTimezoneBanner /><slot />
    </main>
    <AppIdleWarning />
  </div>
</template>

<style scoped>
.member-main :deep(h1) {
  font-size: 24px;
  line-height: 32px;
}
.member-main :deep(input),
.member-main :deep(textarea),
.member-main :deep([role='combobox']) {
  border-radius: 10px;
  background: var(--brand-surface);
}
@media (min-width: 1024px) {
  .member-main :deep(h1) {
    font-size: 30px;
    line-height: 40px;
  }
}
</style>

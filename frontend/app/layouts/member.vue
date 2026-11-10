<template>
  <div class="min-h-dvh">
    <a href="#main-content" class="sr-only focus:not-sr-only"
      >Skip to content</a
    >
    <header class="border-b border-default bg-(--brand-surface)">
      <div
        class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6"
      >
        <AppBrand />
        <nav
          aria-label="Main navigation"
          class="order-3 flex w-full gap-2 text-sm lg:order-none lg:w-auto"
        >
          <NuxtLink
            to="/professionals"
            active-class="bg-muted text-primary"
            class="flex min-h-11 items-center rounded-full px-4 font-semibold"
            >Find a professional</NuxtLink
          >
          <NuxtLink
            to="/sessions"
            active-class="bg-muted text-primary"
            class="flex min-h-11 items-center rounded-full px-4 font-semibold"
            >My sessions</NuxtLink
          >
        </nav>
        <div class="flex items-center gap-1">
          <NotificationsBell /><AppUserMenu />
        </div>
      </div>
    </header>
    <main id="main-content" class="mx-auto max-w-7xl px-6 py-10"><slot /></main>
  </div>
</template>

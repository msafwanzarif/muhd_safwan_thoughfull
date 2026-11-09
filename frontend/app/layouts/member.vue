<template>
  <div class="min-h-dvh">
    <a href="#main-content" class="sr-only focus:not-sr-only"
      >Skip to content</a
    >
    <header class="border-b border-default bg-(--brand-surface)">
      <div
        class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-6 py-5"
      >
        <AppBrand />
        <nav aria-label="Main navigation" class="flex gap-5 text-sm">
          <NuxtLink to="/professionals">Find a professional</NuxtLink
          ><NuxtLink to="/sessions">My sessions</NuxtLink>
        </nav>
        <AppUserMenu />
      </div>
    </header>
    <main id="main-content" class="mx-auto max-w-7xl px-6 py-10"><slot /></main>
  </div>
</template>

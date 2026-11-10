<template>
  <div class="auth-layout grid min-h-dvh lg:grid-cols-2">
    <aside
      class="relative overflow-hidden bg-(--brand-hero) px-6 py-8 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:self-start lg:flex-col lg:px-14 lg:py-12"
    >
      <AppBrand />
      <div class="relative z-10 max-w-xl py-8 lg:my-auto lg:py-24">
        <h1
          class="text-3xl leading-tight sm:text-4xl font-bold text-primary lg:text-5xl"
        >
          Someone to talk to,<br />when you need it.
        </h1>
        <p class="mt-6 max-w-md text-lg leading-relaxed text-muted">
          Connect with counsellors and coaches who listen, wherever you are.
        </p>
      </div>
      <div
        aria-hidden="true"
        class="absolute -top-20 -right-20 size-48 lg:top-auto lg:-right-24 lg:-bottom-32 lg:size-80 rounded-full bg-teal-brand-200/70"
      >
        <div
          class="m-12 size-20 lg:m-16 lg:size-28 rounded-full bg-teal-brand-500"
        />
      </div>
    </aside>
    <main
      id="main-content"
      class="flex flex-col bg-(--brand-surface) px-6 py-8 lg:px-16 lg:py-12"
    >
      <div class="self-end"><AppThemeControl /></div>
      <div class="mx-auto my-auto w-full max-w-md py-14"><slot /></div>
    </main>
  </div>
</template>

<style>
html:has(.auth-layout) {
  scrollbar-gutter: stable;
}
</style>

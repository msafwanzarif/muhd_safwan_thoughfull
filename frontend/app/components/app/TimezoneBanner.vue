<script setup lang="ts">
import { timezoneLabel } from '~/utils/professionals';

const user = useCurrentUser();
const browserZone = ref(Intl.DateTimeFormat().resolvedOptions().timeZone);
const dismissed = useLocalStorage('thoughtfull-timezone-dismissed', '');
const focused = useWindowFocus();
const canonical = (zone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: zone }).resolvedOptions()
    .timeZone;
const pair = computed(() => `${user.value?.timezone}|${browserZone.value}`);
const show = computed(
  () =>
    user.value &&
    canonical(user.value.timezone) !== canonical(browserZone.value) &&
    dismissed.value !== pair.value,
);
watch(focused, (value) => {
  if (value)
    browserZone.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
});
</script>

<template>
  <UAlert
    v-if="show"
    color="info"
    variant="soft"
    class="mb-6"
    title="Your browser is in a different time zone."
    :description="`Session times still use ${timezoneLabel(user?.timezone ?? 'UTC')}. Your browser uses ${timezoneLabel(browserZone)}.`"
  >
    <template #actions
      ><UButton
        :to="user?.role === 'professional' ? '/pro/hours' : '/account'"
        variant="outline"
        class="min-h-11"
        >{{
          user?.role === 'professional'
            ? 'Review time zone and hours'
            : 'Review time zone'
        }}</UButton
      ><UButton variant="ghost" class="min-h-11" @click="dismissed = pair"
        >Dismiss time zone notice</UButton
      ></template
    >
  </UAlert>
</template>

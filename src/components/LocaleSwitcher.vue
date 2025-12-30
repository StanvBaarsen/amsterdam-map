<template>
  <div class="navbar-item has-dropdown is-hoverable">
    <a class="navbar-link">
      <b-icon icon="translate" />
    </a>
    <div
      class="navbar-dropdown is-right"
    >
      <a
        v-for="locale in $i18n.availableLocales"
        :key="locale"
        class="navbar-item"
        @click="switchLocale(locale)"
      >
        <span>{{ localeName(locale) }}</span>
      </a>
    </div>
  </div>
</template>

<script>

export default {

	name: "LocaleSwitcher",

	methods: {

		switchLocale( localeCode ) {

			this.$i18n.locale = localeCode;

		},
		localeName( locale ) {

			const localeNames = { "en": "English", "nl": "Nederlands" };

			return localeNames[ locale ];

		},

	}
};
</script>

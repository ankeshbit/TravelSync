<template>
  <div class="landing-page min-h-screen bg-surface font-body-md text-body-md text-on-surface antialiased selection:bg-primary/30 selection:text-on-surface">
    <!-- ── HEADER / NAVIGATION BAR ────────────────────────────────────── -->
    <header class="fixed top-0 left-0 right-0 w-full z-50 bg-surface/85 backdrop-blur-md border-b border-outline-variant/60 shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300">
      <div class="h-20 max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between gap-space-md">
        
        <!-- Logo & Brand Name -->
        <a href="#hero" @click.prevent="scrollToSection('hero')" class="flex items-center gap-space-sm shrink-0 group focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg p-1">
          <img :src="logoUrl" alt="TravelSync" class="h-8 w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-105" />
          <span class="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold">TravelSync</span>
        </a>

        <!-- Desktop Navigation Links -->
        <nav class="hidden md:flex items-center gap-space-sm" aria-label="Main Navigation">
          <a
            v-for="link in navLinks"
            :key="link.id"
            :href="`#${link.id}`"
            @click.prevent="scrollToSection(link.id)"
            class="px-space-md py-space-xs transition-all duration-200 rounded-full font-label-lg text-label-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
            :class="[
              activeSection === link.id
                ? 'bg-surface-container-high text-primary font-semibold border border-primary/25 shadow-inner'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            ]"
          >
            {{ link.label }}
          </a>
        </nav>

        <!-- Right Action Items -->
        <div class="flex items-center gap-4 shrink-0">
          <router-link
            to="/login"
            class="hidden sm:inline-block font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors py-2 px-3 rounded-full hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            Log in
          </router-link>

          <router-link
            to="/login"
            class="inline-flex items-center gap-space-xs px-space-lg py-space-sm bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-semibold rounded-full transition-all duration-300 shadow-[0_4px_20px_-2px_rgba(143,168,155,0.25)] hover:shadow-[0_6px_24px_rgba(143,168,155,0.35)] hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <span>{{ authStore.isAuthenticated ? 'Go to Dashboard' : 'Continue with TravelSync' }}</span>
            <span aria-hidden="true" class="transition-transform group-hover:translate-x-0.5">→</span>
          </router-link>

          <router-link
            :to="authStore.isAuthenticated ? '/dashboard' : '/login'"
            class="w-9 h-9 rounded-full bg-surface-container-highest border border-outline-variant flex items-center justify-center shrink-0 hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
            :title="authStore.isAuthenticated ? 'Dashboard Profile' : 'Sign in'"
            :aria-label="authStore.isAuthenticated ? 'Dashboard Profile' : 'Sign in'"
          >
            <span class="material-symbols-outlined text-primary text-[19px]">person</span>
          </router-link>

          <!-- Mobile Hamburger Toggle -->
          <button
            type="button"
            class="md:hidden p-2 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            @click="mobileMenuOpen = !mobileMenuOpen"
            aria-label="Toggle Navigation Menu"
          >
            <span class="material-symbols-outlined text-[24px]">
              {{ mobileMenuOpen ? 'close' : 'menu' }}
            </span>
          </button>
        </div>
      </div>

      <!-- Mobile Navigation Drawer -->
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-4"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-4"
      >
        <div
          v-if="mobileMenuOpen"
          class="md:hidden bg-surface-container/95 border-b border-outline-variant backdrop-blur-xl px-6 py-5 shadow-2xl"
        >
          <div class="flex flex-col gap-2">
            <a
              v-for="link in navLinks"
              :key="link.id"
              :href="`#${link.id}`"
              @click.prevent="scrollToSection(link.id); mobileMenuOpen = false;"
              class="px-4 py-2.5 rounded-xl font-label-lg text-label-lg transition-colors flex items-center justify-between"
              :class="activeSection === link.id ? 'bg-surface-container-high text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'"
            >
              <span>{{ link.label }}</span>
              <span class="material-symbols-outlined text-[16px] text-primary/60">chevron_right</span>
            </a>
            <div class="h-px bg-outline-variant/60 my-2"></div>
            <router-link
              to="/login"
              @click="mobileMenuOpen = false"
              class="px-4 py-2.5 rounded-xl font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            >
              Log in
            </router-link>
            <router-link
              to="/login"
              @click="mobileMenuOpen = false"
              class="mt-2 w-full text-center py-3 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-full shadow-md transition-colors"
            >
              Continue with TravelSync
            </router-link>
          </div>
        </div>
      </transition>
    </header>

    <!-- ── MAIN CONTENT ──────────────────────────────────────────────── -->
    <main class="w-full pt-20 bg-surface">
      <div class="flex flex-col w-full">

        <!-- 1. HERO SECTION -->
        <section class="relative w-full overflow-hidden px-6 lg:px-12 pt-8 lg:pt-16 pb-16 lg:pb-24" id="hero">
          <!-- Atmospheric Ambient Glows -->
          <div class="pointer-events-none absolute -top-32 right-0 w-[550px] h-[550px] rounded-full bg-primary/10 blur-3xl -z-10"></div>
          <div class="pointer-events-none absolute top-1/2 -left-36 w-[450px] h-[450px] rounded-full bg-secondary-container/30 blur-3xl -z-10"></div>
          
          <div class="max-w-7xl mx-auto">
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              
              <!-- Left Column Content -->
              <div class="lg:col-span-6 flex flex-col items-start gap-space-lg">
                <!-- Eyebrow Pill -->
                <div class="inline-flex items-center gap-space-xs px-4 py-1.5 rounded-full bg-surface-container border border-primary/20 text-primary font-label-caps text-label-caps uppercase tracking-widest shadow-sm">
                  <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  <span>YOUR JOURNEY, YOUR WAY</span>
                </div>

                <!-- Headline -->
                <h1 class="font-display-hero text-headline-lg-mobile sm:text-display-hero-mobile lg:text-display-hero text-on-surface tracking-tight font-extrabold max-w-xl leading-tight">
                  Find the places that <span class="text-primary italic font-serif">feel like you.</span>
                </h1>

                <!-- Description -->
                <p class="font-body-lg text-body-md sm:text-body-lg text-on-surface-variant max-w-lg leading-relaxed">
                  Discover destinations that match your interests, budget, and travel style. TravelSync makes finding your next adventure simpler, smarter, and more personal.
                </p>

                <!-- Action Buttons -->
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto pt-2">
                  <router-link
                    to="/login"
                    class="inline-flex items-center justify-center gap-space-xs px-8 py-4 bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-semibold rounded-full transition-all duration-300 shadow-[0_4px_24px_rgba(143,168,155,0.25)] hover:shadow-[0_8px_32px_rgba(143,168,155,0.4)] hover:-translate-y-0.5 active:translate-y-0 group focus:outline-none focus:ring-2 focus:ring-primary/60"
                  >
                    <span>Continue with TravelSync</span>
                    <span class="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">arrow_forward</span>
                  </router-link>

                  <a
                    href="#categories"
                    @click.prevent="scrollToSection('categories')"
                    class="inline-flex items-center justify-center gap-space-xs px-7 py-4 bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-on-surface font-label-lg text-label-lg rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <span class="material-symbols-outlined text-primary text-[18px]">explore</span>
                    <span>Explore destinations</span>
                  </a>
                </div>

                <!-- Supporting Tagline -->
                <div class="flex items-center gap-2 pt-2 text-on-surface-variant font-body-sm text-body-sm">
                  <span class="inline-block w-1.5 h-1.5 rounded-full bg-primary"></span>
                  <span>Discover destinations. Find your vibe. Plan your journey.</span>
                </div>
              </div>

              <!-- Right Column / Visual Montage -->
              <div class="lg:col-span-6 relative flex justify-center lg:justify-end mt-4 lg:mt-0">
                <div class="relative w-full max-w-lg lg:max-w-none">
                  
                  <!-- Main Hero Image Card -->
                  <div class="relative overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-outline-variant/40 bg-surface-container aspect-[4/3] group">
                    <img
                      :src="heroAlpineImg"
                      alt="Alpine emerald lake surrounded by majestic snow-capped mountain peaks"
                      class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="eager"
                    />
                    <div class="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-surface-container-lowest/20 to-transparent"></div>
                    
                    <!-- Scrim Info -->
                    <div class="absolute bottom-6 left-6 right-6 flex items-center justify-between text-on-surface">
                      <div>
                        <span class="font-label-caps text-label-caps tracking-widest uppercase text-primary font-semibold">Featured Alpine Lake</span>
                        <p class="font-headline-sm text-headline-sm font-bold text-on-surface">Lake Braies, Dolomites</p>
                      </div>
                      <div class="p-2.5 rounded-full bg-surface-container-lowest/70 border border-outline-variant/60 backdrop-blur-md">
                        <span class="material-symbols-outlined text-primary">wb_sunny</span>
                      </div>
                    </div>
                  </div>

                  <!-- Floating Card: Top Left -->
                  <div class="absolute -top-6 -left-2 sm:-left-8 bg-surface-container/90 border border-outline-variant/70 backdrop-blur-md px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.5)] flex items-center gap-3 sm:gap-3.5 max-w-[240px] sm:max-w-[260px] transition-transform duration-300 hover:-translate-y-1">
                    <div class="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center shrink-0 text-primary border border-primary/20">
                      <span class="material-symbols-outlined text-[20px]">auto_awesome</span>
                    </div>
                    <div>
                      <p class="font-label-lg text-label-lg font-bold text-on-surface leading-tight">Made for your style</p>
                      <p class="font-body-sm text-body-sm text-on-surface-variant text-[12px] leading-tight mt-0.5">Discover places you'll love.</p>
                    </div>
                  </div>

                  <!-- Floating Card: Bottom Right -->
                  <div class="absolute -bottom-6 -right-2 sm:-right-6 bg-surface-container/95 border border-outline-variant/70 backdrop-blur-md px-4 sm:px-5 py-3.5 sm:py-4 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.5)] flex items-center gap-3 sm:gap-3.5 max-w-[260px] sm:max-w-[280px] transition-transform duration-300 hover:-translate-y-1">
                    <div class="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0">
                      <span class="material-symbols-outlined text-[20px]">location_on</span>
                    </div>
                    <div>
                      <p class="font-label-lg text-label-lg font-bold text-on-surface leading-tight">Your next adventure</p>
                      <p class="font-body-sm text-body-sm text-on-surface-variant text-[12px] leading-tight mt-0.5">Mountains, beaches, cities &amp; more.</p>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        <!-- 2. BENEFITS STRIP -->
        <section class="w-full bg-surface-container-low py-10 px-6 lg:px-12 border-y border-outline-variant/40">
          <div class="max-w-7xl mx-auto">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8 items-center">
              
              <!-- Benefit 1 -->
              <div class="flex items-center gap-3.5">
                <div class="w-11 h-11 rounded-2xl bg-surface-container border border-outline-variant/50 flex items-center justify-center shrink-0 text-primary shadow-sm">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
                  </svg>
                </div>
                <div>
                  <h4 class="font-label-lg text-label-lg text-on-surface font-semibold leading-tight">Personalized Discovery</h4>
                  <p class="font-body-sm text-body-sm text-on-surface-variant text-[12px] leading-tight mt-0.5">Curated to your preferences</p>
                </div>
              </div>

              <!-- Benefit 2 -->
              <div class="flex items-center gap-3.5">
                <div class="w-11 h-11 rounded-2xl bg-surface-container border border-outline-variant/50 flex items-center justify-center shrink-0 text-primary shadow-sm">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                    <rect height="14" rx="2" width="20" x="2" y="5"></rect>
                    <line x1="2" x2="22" y1="10" y2="10"></line>
                  </svg>
                </div>
                <div>
                  <h4 class="font-label-lg text-label-lg text-on-surface font-semibold leading-tight">Budget-Aware</h4>
                  <p class="font-body-sm text-body-sm text-on-surface-variant text-[12px] leading-tight mt-0.5">Explore by comfort range</p>
                </div>
              </div>

              <!-- Benefit 3 -->
              <div class="flex items-center gap-3.5">
                <div class="w-11 h-11 rounded-2xl bg-surface-container border border-outline-variant/50 flex items-center justify-center shrink-0 text-primary shadow-sm">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                  </svg>
                </div>
                <div>
                  <h4 class="font-label-lg text-label-lg text-on-surface font-semibold leading-tight">Every Interest</h4>
                  <p class="font-body-sm text-body-sm text-on-surface-variant text-[12px] leading-tight mt-0.5">From serene to adrenaline</p>
                </div>
              </div>

              <!-- Benefit 4 -->
              <div class="flex items-center gap-3.5">
                <div class="w-11 h-11 rounded-2xl bg-surface-container border border-outline-variant/50 flex items-center justify-center shrink-0 text-primary shadow-sm">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <div>
                  <h4 class="font-label-lg text-label-lg text-on-surface font-semibold leading-tight">Fits Your Style</h4>
                  <p class="font-body-sm text-body-sm text-on-surface-variant text-[12px] leading-tight mt-0.5">Solo, pairs, or group pace</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        <!-- 3. ABOUT TRAVELSYNC SECTION -->
        <section class="w-full py-20 lg:py-28 px-6 lg:px-12 bg-surface" id="about">
          <div class="max-w-7xl mx-auto flex flex-col items-center">
            
            <!-- Centered Header -->
            <div class="text-center max-w-2xl mb-16">
              <span class="font-label-caps text-label-caps uppercase tracking-widest text-primary font-bold px-3 py-1 rounded-full bg-surface-container border border-primary/20 inline-block mb-3">ABOUT TRAVELSYNC</span>
              <h2 class="font-headline-lg text-headline-md sm:text-headline-lg text-on-surface font-bold tracking-tight mb-4">
                A better way to discover your next destination.
              </h2>
              <p class="font-body-lg text-body-md sm:text-body-lg text-on-surface-variant">
                TravelSync brings destination discovery into one simple experience, helping you explore places based on what matters most to you.
              </p>
            </div>

            <!-- 3 Feature Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
              <!-- Card 1 -->
              <div class="flex flex-col bg-surface-container p-8 rounded-3xl border border-outline-variant/50 shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.5)] hover:border-primary/40 hover:-translate-y-1.5 transition-all duration-300">
                <div class="w-14 h-14 rounded-2xl bg-surface-container-high border border-outline-variant/60 flex items-center justify-center text-primary mb-6 shadow-sm">
                  <span class="material-symbols-outlined text-[30px]">terrain</span>
                </div>
                <h3 class="font-title-md text-title-md text-on-surface font-bold mb-3">
                  Discover Your Kind of Adventure
                </h3>
                <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  Explore destinations for nature, adventure, sightseeing, relaxation, wildlife, beaches, and cultural experiences.
                </p>
                <div class="pt-6 mt-auto flex items-center gap-2 text-primary font-label-lg text-label-lg font-semibold">
                  <span>Tailored archetypes</span>
                  <span class="material-symbols-outlined text-[16px]">arrow_right_alt</span>
                </div>
              </div>

              <!-- Card 2 -->
              <div class="flex flex-col bg-surface-container p-8 rounded-3xl border border-outline-variant/50 shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.5)] hover:border-primary/40 hover:-translate-y-1.5 transition-all duration-300 relative">
                <div class="w-14 h-14 rounded-2xl bg-secondary-container flex items-center justify-center text-primary mb-6 border border-primary/20 shadow-sm">
                  <span class="material-symbols-outlined text-[30px]">payments</span>
                </div>
                <h3 class="font-title-md text-title-md text-on-surface font-bold mb-3">
                  Travel Within Your Budget
                </h3>
                <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  Explore destinations with your preferred spending range in mind, making it easier to find options that suit your plans.
                </p>
                <div class="pt-6 mt-auto flex items-center gap-2 text-primary font-label-lg text-label-lg font-semibold">
                  <span>Transparent pricing scale</span>
                  <span class="material-symbols-outlined text-[16px]">arrow_right_alt</span>
                </div>
              </div>

              <!-- Card 3 -->
              <div class="flex flex-col bg-surface-container p-8 rounded-3xl border border-outline-variant/50 shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.5)] hover:border-primary/40 hover:-translate-y-1.5 transition-all duration-300">
                <div class="w-14 h-14 rounded-2xl bg-surface-container-high border border-outline-variant/60 flex items-center justify-center text-primary mb-6 shadow-sm">
                  <span class="material-symbols-outlined text-[30px]">diversity_3</span>
                </div>
                <h3 class="font-title-md text-title-md text-on-surface font-bold mb-3">
                  Find Your Travel Match
                </h3>
                <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  Consider your interests, travel pace, and companions to discover destinations that better fit your journey.
                </p>
                <div class="pt-6 mt-auto flex items-center gap-2 text-primary font-label-lg text-label-lg font-semibold">
                  <span>Adaptive sync engine</span>
                  <span class="material-symbols-outlined text-[16px]">arrow_right_alt</span>
                </div>
              </div>
            </div>

          </div>
        </section>

        <!-- 4. EXPLORE TRAVEL CATEGORIES -->
        <section class="w-full py-20 lg:py-28 px-6 lg:px-12 bg-surface-container-low border-y border-outline-variant/40" id="categories">
          <div class="max-w-7xl mx-auto">
            
            <!-- Section Header -->
            <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
              <div class="max-w-xl">
                <span class="font-label-caps text-label-caps uppercase tracking-widest text-primary font-bold px-3 py-1 rounded-full bg-surface-container border border-primary/20 inline-block mb-3">DESTINATIONS</span>
                <h2 class="font-headline-lg text-headline-md sm:text-headline-lg text-on-surface font-bold tracking-tight">
                  Where will your curiosity take you?
                </h2>
              </div>
              <p class="font-body-md text-body-md text-on-surface-variant max-w-md">
                From peaceful escapes to unforgettable adventures, discover the kind of trip that speaks to you.
              </p>
            </div>

            <!-- 4-Card Photographic Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <!-- Category 1: Nature & Mountains -->
              <router-link
                to="/login"
                class="group relative h-[420px] rounded-3xl overflow-hidden shadow-lg border border-outline-variant/40 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(0,0,0,0.7)] flex flex-col justify-end p-6 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <img
                  :src="catNatureImg"
                  alt="Nature and Mountains"
                  class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/60 to-transparent"></div>
                <div class="relative z-10 flex flex-col">
                  <span class="font-label-caps text-label-caps text-primary uppercase tracking-wider mb-1 font-semibold">Alpine Wilderness</span>
                  <h3 class="font-title-md text-title-md font-bold text-on-surface mb-2">Nature &amp; Mountains</h3>
                  <p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mb-4">
                    Scenic landscapes, forests, lakes, and mountain escapes.
                  </p>
                  <div class="inline-flex items-center gap-2 text-on-surface font-label-lg text-label-lg font-semibold group-hover:text-primary transition-colors">
                    <span>Explore places</span>
                    <span class="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">arrow_forward</span>
                  </div>
                </div>
              </router-link>

              <!-- Category 2: Beaches & Relaxation -->
              <router-link
                to="/login"
                class="group relative h-[420px] rounded-3xl overflow-hidden shadow-lg border border-outline-variant/40 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(0,0,0,0.7)] flex flex-col justify-end p-6 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <img
                  :src="catBeachImg"
                  alt="Beaches and Relaxation"
                  class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/60 to-transparent"></div>
                <div class="relative z-10 flex flex-col">
                  <span class="font-label-caps text-label-caps text-primary uppercase tracking-wider mb-1 font-semibold">Coastal Sanctuary</span>
                  <h3 class="font-title-md text-title-md font-bold text-on-surface mb-2">Beaches &amp; Relaxation</h3>
                  <p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mb-4">
                    Coastal destinations, peaceful shores, and slow travel.
                  </p>
                  <div class="inline-flex items-center gap-2 text-on-surface font-label-lg text-label-lg font-semibold group-hover:text-primary transition-colors">
                    <span>Explore places</span>
                    <span class="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">arrow_forward</span>
                  </div>
                </div>
              </router-link>

              <!-- Category 3: Culture & Cities -->
              <router-link
                to="/login"
                class="group relative h-[420px] rounded-3xl overflow-hidden shadow-lg border border-outline-variant/40 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(0,0,0,0.7)] flex flex-col justify-end p-6 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <img
                  :src="catCultureImg"
                  alt="Culture and Cities"
                  class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/60 to-transparent"></div>
                <div class="relative z-10 flex flex-col">
                  <span class="font-label-caps text-label-caps text-primary uppercase tracking-wider mb-1 font-semibold">Urban Heritage</span>
                  <h3 class="font-title-md text-title-md font-bold text-on-surface mb-2">Culture &amp; Cities</h3>
                  <p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mb-4">
                    Architecture, history, local culture, and city experiences.
                  </p>
                  <div class="inline-flex items-center gap-2 text-on-surface font-label-lg text-label-lg font-semibold group-hover:text-primary transition-colors">
                    <span>Explore places</span>
                    <span class="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">arrow_forward</span>
                  </div>
                </div>
              </router-link>

              <!-- Category 4: Adventure & Wildlife -->
              <router-link
                to="/login"
                class="group relative h-[420px] rounded-3xl overflow-hidden shadow-lg border border-outline-variant/40 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(0,0,0,0.7)] flex flex-col justify-end p-6 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <img
                  :src="catAdventureImg"
                  alt="Adventure and Wildlife"
                  class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/60 to-transparent"></div>
                <div class="relative z-10 flex flex-col">
                  <span class="font-label-caps text-label-caps text-primary uppercase tracking-wider mb-1 font-semibold">Raw Exploration</span>
                  <h3 class="font-title-md text-title-md font-bold text-on-surface mb-2">Adventure &amp; Wildlife</h3>
                  <p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mb-4">
                    Outdoor activities, exciting experiences, and wildlife exploration.
                  </p>
                  <div class="inline-flex items-center gap-2 text-on-surface font-label-lg text-label-lg font-semibold group-hover:text-primary transition-colors">
                    <span>Explore places</span>
                    <span class="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">arrow_forward</span>
                  </div>
                </div>
              </router-link>

            </div>
          </div>
        </section>

        <!-- 5. HOW IT WORKS SECTION -->
        <section class="w-full py-20 lg:py-28 px-6 lg:px-12 bg-surface" id="how-it-works">
          <div class="max-w-7xl mx-auto">
            
            <div class="text-center max-w-2xl mx-auto mb-16">
              <span class="font-label-caps text-label-caps uppercase tracking-widest text-primary font-bold px-3 py-1 rounded-full bg-surface-container border border-primary/20 inline-block mb-3">SEAMLESS FLOW</span>
              <h2 class="font-headline-lg text-headline-md sm:text-headline-lg text-on-surface font-bold tracking-tight mb-4">
                Your next trip, made simpler.
              </h2>
              <p class="font-body-lg text-body-md sm:text-body-lg text-on-surface-variant">
                Three steps from inspiration to your personalized destination.
              </p>
            </div>

            <div class="relative grid grid-cols-1 md:grid-cols-3 gap-8">
              <!-- Connecting Line for Desktop -->
              <div class="hidden md:block absolute top-1/2 left-[18%] right-[18%] -translate-y-8 h-px bg-outline-variant/60 -z-0"></div>

              <!-- Step 01 -->
              <div class="relative z-10 flex flex-col items-center text-center p-8 rounded-3xl bg-surface-container border border-outline-variant/50 shadow-md hover:shadow-xl hover:border-primary/40 transition-all duration-300">
                <div class="w-16 h-16 rounded-full bg-surface-container-high border-2 border-primary/40 text-primary font-display-hero text-headline-sm flex items-center justify-center font-bold mb-6 shadow-inner">
                  01
                </div>
                <h3 class="font-title-md text-title-md text-on-surface font-bold mb-3">Tell Us What You Love</h3>
                <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  Start with your interests, preferred travel experiences, and budget.
                </p>
              </div>

              <!-- Step 02 -->
              <div class="relative z-10 flex flex-col items-center text-center p-8 rounded-3xl bg-surface-container border border-outline-variant/50 shadow-md hover:shadow-xl hover:border-primary/40 transition-all duration-300">
                <div class="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary text-primary font-display-hero text-headline-sm flex items-center justify-center font-bold mb-6 shadow-inner">
                  02
                </div>
                <h3 class="font-title-md text-title-md text-on-surface font-bold mb-3">Discover Your Possibilities</h3>
                <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  Explore destinations that align with the kind of journey you have in mind.
                </p>
              </div>

              <!-- Step 03 -->
              <div class="relative z-10 flex flex-col items-center text-center p-8 rounded-3xl bg-surface-container border border-outline-variant/50 shadow-md hover:shadow-xl hover:border-primary/40 transition-all duration-300">
                <div class="w-16 h-16 rounded-full bg-primary text-on-primary font-display-hero text-headline-sm flex items-center justify-center font-bold mb-6 shadow-lg shadow-primary/20">
                  03
                </div>
                <h3 class="font-title-md text-title-md text-on-surface font-bold mb-3">Find Your Next Adventure</h3>
                <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  Compare your options and move closer to choosing your next destination.
                </p>
              </div>
            </div>

          </div>
        </section>

        <!-- 6. MOBILE APP COMING SOON SECTION -->
        <section class="relative w-full py-20 lg:py-28 px-6 lg:px-12 bg-surface-container-low/60 border-y border-outline-variant/40 overflow-hidden" id="mobile-app">
          <!-- Atmospheric Ambient Glows behind Phone and Section -->
          <div class="pointer-events-none absolute top-1/3 -left-28 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[130px] -z-10"></div>
          <div class="pointer-events-none absolute bottom-10 right-0 w-[550px] h-[550px] rounded-full bg-secondary-container/25 blur-[140px] -z-10"></div>

          <div class="max-w-7xl mx-auto">
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              
              <!-- Announcement Column (Beside Phone on Desktop, Stacked on Mobile) -->
              <div class="lg:col-span-6 flex flex-col items-start gap-6 order-2 lg:order-1">
                <!-- Eyebrow Badge -->
                <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container border border-primary/25 shadow-sm">
                  <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  <span class="font-label-caps text-label-caps text-primary tracking-widest uppercase font-bold">NEXT GENERATION EXPERIENCE</span>
                </div>

                <!-- Headline -->
                <h2 class="font-headline-lg text-headline-md sm:text-headline-lg text-on-surface font-extrabold tracking-tight leading-tight">
                  TravelSync Mobile — <span class="text-primary italic font-serif">Coming Soon</span>
                </h2>

                <!-- Brief Description -->
                <p class="font-body-lg text-body-md sm:text-body-lg text-on-surface-variant leading-relaxed">
                  Your ultimate pocket adventure companion is on the way. We're crafting a high-speed, native mobile app that keeps your itinerary, group expenses, and offline maps perfectly in sync wherever your curiosity takes you.
                </p>

                <!-- 4 Key Mobile Feature Highlights -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full pt-1">
                  <!-- Feature 1 -->
                  <div class="p-4 rounded-2xl bg-surface-container/90 border border-outline-variant/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5">
                    <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary mb-3">
                      <span class="material-symbols-outlined text-[20px]">cloud_off</span>
                    </div>
                    <h4 class="font-label-lg text-label-lg font-bold text-on-surface mb-1">True Offline Sync</h4>
                    <p class="font-body-sm text-body-sm text-on-surface-variant text-[13px] leading-relaxed">
                      Access trails, tickets, and reservations off-grid. Automatic sync activates once reconnected.
                    </p>
                  </div>

                  <!-- Feature 2 -->
                  <div class="p-4 rounded-2xl bg-surface-container/90 border border-outline-variant/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5">
                    <div class="w-10 h-10 rounded-xl bg-secondary-container border border-primary/20 flex items-center justify-center text-primary mb-3">
                      <span class="material-symbols-outlined text-[20px]">receipt_long</span>
                    </div>
                    <h4 class="font-label-lg text-label-lg font-bold text-on-surface mb-1">One-Tap Split</h4>
                    <p class="font-body-sm text-body-sm text-on-surface-variant text-[13px] leading-relaxed">
                      Log meals and lodging on the fly. Balances are calculated instantly with zero confusion.
                    </p>
                  </div>

                  <!-- Feature 3 -->
                  <div class="p-4 rounded-2xl bg-surface-container/90 border border-outline-variant/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5">
                    <div class="w-10 h-10 rounded-xl bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary mb-3">
                      <span class="material-symbols-outlined text-[20px]">explore</span>
                    </div>
                    <h4 class="font-label-lg text-label-lg font-bold text-on-surface mb-1">Pocket Itinerary</h4>
                    <p class="font-body-sm text-body-sm text-on-surface-variant text-[13px] leading-relaxed">
                      Turn-by-turn day plans, departure nudges, and destination vibes always at your fingertips.
                    </p>
                  </div>

                  <!-- Feature 4 -->
                  <div class="p-4 rounded-2xl bg-surface-container/90 border border-outline-variant/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5">
                    <div class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                      <span class="material-symbols-outlined text-[20px]">group</span>
                    </div>
                    <h4 class="font-label-lg text-label-lg font-bold text-on-surface mb-1">Live Group Presence</h4>
                    <p class="font-body-sm text-body-sm text-on-surface-variant text-[13px] leading-relaxed">
                      Real-time updates when travel buddies modify plans, keeping everyone on the exact same page.
                    </p>
                  </div>
                </div>

                <!-- Launch Availability Notice -->
                <div class="w-full mt-1 p-5 rounded-2xl bg-surface-container border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                      <span class="material-symbols-outlined text-[20px]">devices</span>
                    </div>
                    <div>
                      <p class="font-label-lg text-label-lg font-bold text-on-surface">Coming to iOS &amp; Android</p>
                      <p class="font-body-sm text-body-sm text-on-surface-variant text-[12px]">Currently in active development. Stay tuned for beta rollout announcement.</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <!-- iOS Badge (Informational) -->
                    <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high border border-outline-variant/60 text-on-surface font-label-md text-label-md select-none" title="iOS App Store release coming soon">
                      <svg class="w-4 h-4 fill-current text-on-surface" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.58.66-1.09 1.73-.95 2.76.99.08 2.03-.5 2.68-1.26z"/>
                      </svg>
                      <span class="font-medium">iOS</span>
                    </div>
                    <!-- Android Badge (Informational) -->
                    <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high border border-outline-variant/60 text-on-surface font-label-md text-label-md select-none" title="Google Play Store release coming soon">
                      <svg class="w-4 h-4 fill-current text-on-surface" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3.609 1.814L13.793 12 3.61 22.186a1.996 1.996 0 0 1-.22-.916V2.73c0-.337.08-.654.219-.916zm11.238 11.24l2.25 2.25-11.83 6.77 9.58-9.02zm0-2.108L5.267 1.926l11.83 6.77-2.25 2.25zm1.485 1.484l2.583 1.478c.85.486.85 1.28 0 1.766l-2.583 1.478-2.15-2.15 2.15-2.572z"/>
                      </svg>
                      <span class="font-medium">Android</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Smartphone Mockup Column (Main Visual Focus) -->
              <div class="lg:col-span-6 flex justify-center items-center order-1 lg:order-2">
                <div class="relative flex items-center justify-center">
                  
                  <!-- Soft Radial Glow Backdrop -->
                  <div class="absolute -inset-6 sm:-inset-10 bg-primary/25 rounded-full blur-[70px] pointer-events-none -z-10 animate-pulse" style="animation-duration: 4s;"></div>
                  <div class="absolute -top-12 -right-8 w-44 h-44 bg-secondary-container/40 rounded-full blur-[60px] pointer-events-none -z-10"></div>

                  <!-- Realistic Smartphone Frame -->
                  <div class="relative w-[310px] sm:w-[340px] h-[640px] sm:h-[680px] rounded-[50px] sm:rounded-[54px] bg-[#1a1f1d] p-[10px] sm:p-[12px] shadow-[0_25px_70px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.12),inset_0_0_0_2px_#2c3732] animate-phone-float transition-transform duration-500 hover:scale-[1.015]">
                    
                    <!-- Hardware Buttons (Left side: Volume, Right side: Power) -->
                    <div class="absolute -left-[3px] top-28 w-[3px] h-9 bg-[#35403a] rounded-l-sm shadow-sm"></div>
                    <div class="absolute -left-[3px] top-40 w-[3px] h-9 bg-[#35403a] rounded-l-sm shadow-sm"></div>
                    <div class="absolute -right-[3px] top-32 w-[3px] h-14 bg-[#35403a] rounded-r-sm shadow-sm"></div>

                    <!-- Inner Bezel and Display Area -->
                    <div class="relative w-full h-full rounded-[40px] sm:rounded-[44px] overflow-hidden bg-[#0e1311] border border-outline-variant/40 flex flex-col justify-between text-on-surface select-none shadow-inner">
                      
                      <!-- Subtle Screen Glare Overlay -->
                      <div class="absolute inset-0 pointer-events-none z-30 bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.08]"></div>

                      <!-- ── Phone Top: Status Bar & Dynamic Island ── -->
                      <div class="relative z-20 pt-2.5 px-6 flex flex-col items-center">
                        <!-- Status Bar Top Row -->
                        <div class="w-full flex items-center justify-between text-[11px] font-semibold text-on-surface-variant/90 tracking-tight">
                          <!-- Time -->
                          <span>9:41</span>

                          <!-- Dynamic Island Notch -->
                          <div class="w-24 h-5 rounded-full bg-black border border-white/10 flex items-center justify-between px-2.5 shadow-md -mt-0.5">
                            <div class="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse"></div>
                            <div class="flex items-center gap-1.5">
                              <span class="w-2 h-2 rounded-full bg-[#0a1824] border border-cyan-400/30 flex items-center justify-center">
                                <span class="w-0.5 h-0.5 rounded-full bg-cyan-400"></span>
                              </span>
                            </div>
                          </div>

                          <!-- Icons: Signal, WiFi, Battery -->
                          <div class="flex items-center gap-1.5 text-on-surface-variant">
                            <span class="material-symbols-outlined text-[13px]">signal_cellular_alt</span>
                            <span class="material-symbols-outlined text-[13px]">wifi</span>
                            <div class="w-4 h-2 border border-on-surface-variant rounded-sm p-[1px] flex items-center">
                              <div class="h-full w-full bg-primary rounded-[1px]"></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- ── Phone Screen Content (Scrollable Container) ── -->
                      <div class="relative z-10 flex-1 px-4 pt-3 pb-2 flex flex-col justify-between overflow-hidden">
                        
                        <!-- Top Mini App Bar: TravelSync Branding & Sync status -->
                        <div class="flex items-center justify-between pb-2 border-b border-outline-variant/30">
                          <div class="flex items-center gap-2">
                            <img :src="logoUrl" alt="TravelSync" class="h-6 w-auto object-contain filter drop-shadow-sm" />
                            <span class="font-bold text-[14px] text-on-surface tracking-tight">TravelSync</span>
                          </div>
                          <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container border border-primary/20 text-primary text-[10px] font-medium">
                            <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                            <span>Syncing</span>
                          </div>
                        </div>

                        <!-- Main Screen Announcement Area -->
                        <div class="my-auto py-2 flex flex-col items-start gap-2.5">
                          <!-- Coming Soon Badge -->
                          <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/20 border border-primary/40 text-primary text-[10px] font-bold tracking-wider uppercase shadow-sm">
                            <span class="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                            <span>COMING SOON</span>
                          </div>

                          <!-- Main Text -->
                          <h3 class="font-headline-sm text-[18px] sm:text-[20px] font-extrabold text-on-surface leading-tight tracking-tight">
                            Your next adventure is almost here!
                          </h3>

                          <!-- Short Subtitle -->
                          <p class="font-body-sm text-[12px] text-on-surface-variant leading-relaxed">
                            TravelSync is coming to your phone.
                          </p>

                          <!-- Travel-Themed App Preview Card -->
                          <div class="w-full mt-1 rounded-2xl overflow-hidden bg-surface-container border border-outline-variant/60 shadow-lg relative group">
                            <!-- Destination Image Header -->
                            <div class="relative h-28 sm:h-32 w-full overflow-hidden">
                              <img
                                :src="heroAlpineImg"
                                alt="Alpine Destination"
                                class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                              />
                              <div class="absolute inset-0 bg-gradient-to-t from-surface-container via-surface-container/30 to-transparent"></div>
                              
                              <!-- Floating Preview Badges on Image -->
                              <div class="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold border border-white/10">
                                <span class="material-symbols-outlined text-primary text-[12px]">location_on</span>
                                <span>Dolomites, IT</span>
                              </div>

                              <div class="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold shadow-sm">
                                <span class="material-symbols-outlined text-[11px]">star</span>
                                <span>4.9</span>
                              </div>

                              <!-- Overlay Trip Title -->
                              <div class="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                                <div>
                                  <p class="text-white text-[13px] font-bold leading-tight drop-shadow-md">Alpine Lake Expedition</p>
                                  <p class="text-white/80 text-[10px]">Aug 14 – 18 · 4 Friends</p>
                                </div>
                                <span class="px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 text-[9px] font-semibold backdrop-blur-md flex items-center gap-1">
                                  <span class="material-symbols-outlined text-[10px]">check_circle</span> Offline
                                </span>
                              </div>
                            </div>

                            <!-- Mini In-App Trip Details Inside Preview Card -->
                            <div class="p-2.5 flex flex-col gap-2">
                              <!-- Itinerary Day Sneak Peek -->
                              <div class="flex items-center justify-between text-[11px] p-2 rounded-xl bg-surface-container-high/80 border border-outline-variant/40">
                                <div class="flex items-center gap-2">
                                  <div class="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                                    02
                                  </div>
                                  <div>
                                    <p class="text-on-surface font-semibold text-[11px] leading-tight">Braies Lake Kayak &amp; Trek</p>
                                    <p class="text-on-surface-variant text-[9px]">10:00 AM · Guided hike</p>
                                  </div>
                                </div>
                                <span class="text-primary text-[10px] font-semibold">Ready</span>
                              </div>

                              <!-- Split Expense Snippet -->
                              <div class="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30">
                                <div class="flex items-center gap-1.5 text-on-surface-variant text-[10px]">
                                  <span class="material-symbols-outlined text-primary text-[14px]">account_balance_wallet</span>
                                  <span>Split Expense</span>
                                </div>
                                <div class="text-right">
                                  <span class="text-on-surface font-bold text-[11px]">$48.50</span>
                                  <span class="text-on-surface-variant text-[9px] ml-1">/ person</span>
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>

                        <!-- ── Bottom Mobile Navigation Bar Inside Phone ── -->
                        <div class="pt-1 border-t border-outline-variant/30">
                          <div class="flex items-center justify-around py-1 text-on-surface-variant">
                            <!-- Tab 1: Explore -->
                            <div class="flex flex-col items-center gap-0.5 text-primary">
                              <span class="material-symbols-outlined text-[17px]">explore</span>
                              <span class="text-[9px] font-bold">Explore</span>
                            </div>
                            <!-- Tab 2: Map -->
                            <div class="flex flex-col items-center gap-0.5 hover:text-on-surface transition-colors">
                              <span class="material-symbols-outlined text-[17px]">map</span>
                              <span class="text-[9px]">Map</span>
                            </div>
                            <!-- Tab 3: Trips -->
                            <div class="flex flex-col items-center gap-0.5 hover:text-on-surface transition-colors">
                              <span class="material-symbols-outlined text-[17px]">luggage</span>
                              <span class="text-[9px]">Trips</span>
                            </div>
                            <!-- Tab 4: Profile -->
                            <div class="flex flex-col items-center gap-0.5 hover:text-on-surface transition-colors">
                              <span class="material-symbols-outlined text-[17px]">person</span>
                              <span class="text-[9px]">You</span>
                            </div>
                          </div>
                        </div>

                      </div>

                      <!-- ── Phone Bottom: Home Indicator Bar ── -->
                      <div class="relative z-20 pb-2 pt-1 flex justify-center">
                        <div class="w-32 h-1 bg-white/30 rounded-full"></div>
                      </div>

                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        <!-- 7. FINAL CALL-TO-ACTION SECTION -->
        <section class="w-full py-16 lg:py-24 px-6 lg:px-12 bg-surface">
          <div class="max-w-7xl mx-auto">
            <div class="relative overflow-hidden rounded-[2.5rem] bg-surface-container-high border border-outline-variant/60 text-on-surface p-8 sm:p-12 md:p-16 lg:p-20 shadow-[0_24px_60px_rgba(0,0,0,0.6)] flex flex-col items-center text-center">
              
              <!-- Background Ambient Gradients -->
              <div class="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/15 blur-3xl pointer-events-none"></div>
              <div class="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-secondary-container/40 blur-3xl pointer-events-none"></div>

              <div class="relative z-10 max-w-3xl flex flex-col items-center gap-6">
                <!-- Small Emblem -->
                <div class="w-14 h-14 rounded-full bg-surface-container border border-primary/30 flex items-center justify-center mb-2 shadow-inner">
                  <span class="material-symbols-outlined text-primary text-[28px]">travel_explore</span>
                </div>

                <!-- Headline -->
                <h2 class="font-display-hero text-headline-md sm:text-headline-lg lg:text-display-hero font-extrabold tracking-tight text-on-surface">
                  Your next great journey starts with a single step.
                </h2>

                <!-- Supporting Text -->
                <p class="font-body-lg text-body-md sm:text-body-lg text-on-surface-variant max-w-xl">
                  Start exploring with TravelSync and discover destinations that fit the way you want to travel.
                </p>

                <!-- Primary Accent Button -->
                <div class="pt-4 flex flex-col items-center gap-3">
                  <router-link
                    to="/login"
                    class="inline-flex items-center gap-space-xs px-10 py-4 bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-bold rounded-full transition-all duration-300 shadow-[0_6px_28px_rgba(143,168,155,0.3)] hover:shadow-[0_8px_36px_rgba(143,168,155,0.45)] hover:scale-105 active:scale-100 focus:outline-none focus:ring-2 focus:ring-primary/60"
                  >
                    <span>Continue with TravelSync</span>
                    <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </router-link>
                  <span class="font-body-sm text-body-sm text-on-surface-variant tracking-wide mt-1">Your journey begins here.</span>
                </div>
              </div>

            </div>
          </div>
        </section>

      </div>
    </main>

    <!-- ── FOOTER ────────────────────────────────────────────────────── -->
    <footer class="w-full bg-surface-container-low border-t border-outline-variant/40">
      <div class="max-w-7xl mx-auto px-6 lg:px-12 py-space-2xl">
        <div class="flex flex-col md:flex-row md:items-start justify-between gap-space-xl pb-space-xl">
          
          <div class="max-w-sm flex flex-col gap-space-sm">
            <div class="flex items-center gap-space-sm">
              <img :src="logoUrl" alt="TravelSync" class="h-8 w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" />
              <span class="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold">TravelSync</span>
            </div>
            <p class="font-body-md text-body-md text-on-surface-variant">
              Discover destinations that match your interests, budget, and travel style.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-x-space-lg gap-y-space-sm font-label-lg text-label-lg">
            <a href="#hero" @click.prevent="scrollToSection('hero')" class="text-on-surface-variant hover:text-on-surface transition-colors">Home</a>
            <a href="#categories" @click.prevent="scrollToSection('categories')" class="text-on-surface-variant hover:text-on-surface transition-colors">Discover</a>
            <a href="#how-it-works" @click.prevent="scrollToSection('how-it-works')" class="text-on-surface-variant hover:text-on-surface transition-colors">How It Works</a>
            <a href="#mobile-app" @click.prevent="scrollToSection('mobile-app')" class="text-on-surface-variant hover:text-on-surface transition-colors">Mobile App</a>
            <a href="#about" @click.prevent="scrollToSection('about')" class="text-on-surface-variant hover:text-on-surface transition-colors">About Us</a>
            <router-link to="/login" class="text-on-surface-variant hover:text-on-surface transition-colors">Log in</router-link>
          </div>

        </div>

        <div class="pt-space-lg text-center md:text-left text-on-surface-variant/70 font-body-sm text-body-sm border-t border-outline-variant/30">
          © 2026 TravelSync. All rights reserved.
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import logoUrl from '../assets/logo.png';

const authStore = useAuthStore();
const mobileMenuOpen = ref(false);
const activeSection = ref('hero');

// Stable Unsplash CDN image URLs (permanent, no auth required)
const heroAlpineImg = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&auto=format&fit=crop&q=80';
const catNatureImg = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=80';
const catBeachImg = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80';
const catCultureImg = 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600&auto=format&fit=crop&q=80';
const catAdventureImg = 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&auto=format&fit=crop&q=80';

const navLinks = [
  { id: 'hero', label: 'Home' },
  { id: 'categories', label: 'Discover' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'mobile-app', label: 'Mobile App' },
  { id: 'about', label: 'About Us' },
];

function scrollToSection(sectionId) {
  if (typeof document === 'undefined') return;
  const target = document.getElementById(sectionId);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
    activeSection.value = sectionId;
  }
}

let observer = null;

onMounted(() => {
  if (typeof window === 'undefined' || !window.IntersectionObserver) return;

  const sectionIds = ['hero', 'categories', 'how-it-works', 'mobile-app', 'about'];
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          activeSection.value = entry.target.id;
        }
      });
    },
    { threshold: 0.3 }
  );

  sectionIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
});
</script>

<style scoped>
/* Scoped micro-enhancements */
.landing-page {
  /* Prevent horizontal scroll */
  overflow-x: hidden;
}

/* Smooth transitions */
a, button {
  transition-property: color, background-color, border-color, transform, box-shadow, opacity;
}

/* Phone Floating Animation */
@keyframes phoneFloat {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-8px) rotate(0.35deg);
  }
}

.animate-phone-float {
  animation: phoneFloat 6.5s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-phone-float {
    animation: none !important;
  }
}
</style>
